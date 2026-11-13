import asyncio
import logging

from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client

from app.core.errors import ProviderError
from app.providers.base import AvailableNumber, PurchasedNumber, TelephonyProvider

logger = logging.getLogger("calme.twilio")


class TwilioTelephony(TelephonyProvider):
    def __init__(
        self,
        account_sid: str,
        auth_token: str,
        bundle_sid: str = "",
        address_sid: str = "",
    ) -> None:
        self._client = Client(account_sid, auth_token)
        self._bundle_sid = bundle_sid
        self._address_sid = address_sid

    async def _run(self, fn, *args):
        try:
            return await asyncio.to_thread(fn, *args)
        except TwilioRestException as exc:
            logger.warning("Twilio error %s: %s", exc.code, exc.msg)
            raise ProviderError(f"Twilio: {exc.msg}") from exc

    # --- search ---
    async def search_numbers(
        self,
        country: str,
        number_type: str,
        contains: str | None = None,
        area_code: str | None = None,
        limit: int = 20,
    ) -> list[AvailableNumber]:
        return await self._run(self._search, country, number_type, contains, area_code, limit)

    def _search(self, country, number_type, contains, area_code, limit):
        country = country.upper()
        listing = self._client.available_phone_numbers(country)
        resource = {
            "local": listing.local,
            "mobile": listing.mobile,
            "toll_free": listing.toll_free,
        }[number_type]
        kwargs: dict = {"voice_enabled": True, "limit": limit}
        if contains:
            kwargs["contains"] = contains
        if area_code:
            kwargs["area_code"] = area_code
        return [
            AvailableNumber(
                phone_number=n.phone_number,
                friendly_name=n.friendly_name,
                locality=getattr(n, "locality", None),
                region=getattr(n, "region", None),
                country=country,
                number_type=number_type,
                address_required=getattr(n, "address_requirements", "none") not in ("none", None),
            )
            for n in resource.list(**kwargs)
        ]

    # --- buy / update / release ---
    async def buy_number(self, phone_number: str, route: str) -> PurchasedNumber:
        return await self._run(self._buy, phone_number, route)

    def _buy(self, phone_number: str, voice_url: str) -> PurchasedNumber:
        kwargs: dict = {
            "phone_number": phone_number,
            "voice_url": voice_url,
            "voice_method": "POST",
        }
        if self._bundle_sid:
            kwargs["bundle_sid"] = self._bundle_sid
        if self._address_sid:
            kwargs["address_sid"] = self._address_sid
        number = self._client.incoming_phone_numbers.create(**kwargs)
        return PurchasedNumber(sid=number.sid, phone_number=number.phone_number)

    async def update_route(self, sid: str, route: str) -> None:
        await self._run(self._update, sid, route)

    def _update(self, sid: str, voice_url: str) -> None:
        self._client.incoming_phone_numbers(sid).update(
            voice_url=voice_url, voice_method="POST"
        )

    async def release_number(self, sid: str) -> None:
        await self._run(self._release, sid)

    def _release(self, sid: str) -> None:
        self._client.incoming_phone_numbers(sid).delete()