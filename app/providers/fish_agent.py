import logging

import httpx

from app.core.errors import ConflictError, NotFoundError, ProviderError
from app.providers.base import AvailableNumber, PurchasedNumber, TelephonyProvider

logger = logging.getLogger("calme.fish_agent")

# Fish sells numbers only in these countries; others need bring-your-own SIP.
FISH_NUMBER_COUNTRIES = ("US", "CA")


def _error_message(resp: httpx.Response) -> str:
    try:
        body = resp.json()
    except ValueError:
        return resp.text[:300] or resp.reason_phrase
    if isinstance(body, dict):
        return str(body.get("message") or body)[:300]
    if isinstance(body, list):  # 422 is a list of field errors
        return "; ".join(str(e.get("msg", e)) for e in body if isinstance(e, dict))[:300]
    return str(body)[:300]


class FishAgentClient:
    """Thin wrapper around the Fish Audio Agents API (https://api.fish.audio/v1/agent)."""

    def __init__(self, api_key: str) -> None:
        self._client = httpx.AsyncClient(
            base_url="https://api.fish.audio/v1/agent",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=httpx.Timeout(30.0, connect=10.0),
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def request(self, method: str, path: str, **kwargs) -> dict | None:
        try:
            resp = await self._client.request(method, path, **kwargs)
        except httpx.HTTPError as exc:
            logger.exception("Fish Agent request failed: %s %s", method, path)
            raise ProviderError(f"Fish Audio agent request failed: {exc}") from exc
        if resp.status_code == 404:
            raise NotFoundError(f"Fish Audio: {_error_message(resp)}")
        if resp.status_code == 409:
            raise ConflictError(f"Fish Audio: {_error_message(resp)}")
        if resp.status_code >= 400:
            message = _error_message(resp)
            logger.warning("Fish Agent %s %s -> %s: %s", method, path, resp.status_code, message)
            raise ProviderError(f"Fish Audio error {resp.status_code}: {message}")
        if resp.status_code == 204 or not resp.content:
            return None
        return resp.json()


class FishAgents:
    """Creates, configures and publishes hosted voice agents."""

    def __init__(self, client: FishAgentClient) -> None:
        self._client = client

    async def create_agent(self, name: str, description: str, config: dict) -> str:
        body = {"name": name, "description": description, "config": config}
        agent = await self._client.request("POST", "/agents", json=body)
        return agent["agent_id"]

    async def update_config(self, agent_id: str, config: dict) -> None:
        await self._client.request("PATCH", f"/agents/{agent_id}/config", json=config)

    async def publish(self, agent_id: str, title: str | None = None) -> None:
        """Make the draft config live. Sessions and calls only use published versions."""
        body = {"version_title": title[:120]} if title else {}
        await self._client.request("POST", f"/agents/{agent_id}/publish", json=body)

    async def delete_agent(self, agent_id: str) -> None:
        await self._client.request("DELETE", f"/agents/{agent_id}")

    async def create_session(self, agent_id: str, end_user_id: str | None = None) -> dict:
        """Start a browser/app session. Returns LiveKit connection details."""
        body: dict = {"agent_id": agent_id}
        if end_user_id:
            body["end_user_id"] = end_user_id
        return await self._client.request("POST", "/sessions", json=body)


class FishAgentTelephony(TelephonyProvider):
    """Phone numbers bought through Fish Audio. Calls go straight to a Fish agent."""

    def __init__(self, client: FishAgentClient) -> None:
        self._client = client

    async def search_numbers(
        self,
        country: str,
        number_type: str,
        contains: str | None = None,
        area_code: str | None = None,
        limit: int = 20,
    ) -> list[AvailableNumber]:
        country = country.upper()
        if country not in FISH_NUMBER_COUNTRIES:
            raise ConflictError(
                "Fish Audio only sells US and Canadian numbers. "
                "Other countries need a number brought in over SIP."
            )
        if number_type != "local":
            raise ConflictError("Fish Audio only sells local numbers.")
        params: dict = {"country_code": country, "number_type": "local"}
        if area_code:
            params["area_code"] = area_code
        result = await self._client.request(
            "GET", "/available-phone-numbers", params=params
        )
        numbers: list[AvailableNumber] = []
        for item in (result or {}).get("available_phone_numbers", []):
            # Fish forwards these from its provider; field names aren't documented,
            # so accept the common spellings.
            phone = item.get("phone_number") or item.get("number") or ""
            if not phone or (contains and contains not in phone):
                continue
            numbers.append(
                AvailableNumber(
                    phone_number=phone,
                    friendly_name=item.get("friendly_name") or phone,
                    locality=item.get("locality"),
                    region=item.get("region"),
                    country=country,
                    number_type=number_type,
                    address_required=False,
                )
            )
        return numbers[:limit]

    async def buy_number(self, phone_number: str, route: str) -> PurchasedNumber:
        body = {"provider": "twilio", "phone_number": phone_number, "agent_id": route}
        number = await self._client.request("POST", "/phone-numbers", json=body)
        return PurchasedNumber(sid=number["phone_number_id"], phone_number=number["phone_number"])

    async def update_route(self, sid: str, route: str) -> None:
        await self._client.request("PATCH", f"/phone-numbers/{sid}", json={"agent_id": route})

    async def release_number(self, sid: str) -> None:
        await self._client.request("DELETE", f"/phone-numbers/{sid}")
