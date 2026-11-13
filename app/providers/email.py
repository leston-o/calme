import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.errors import ProviderError

logger = logging.getLogger("calme.email")


class SmtpEmail:
    """Sends plain-text email through an SMTP server (e.g. Gmail with an app password)."""

    def __init__(self, host: str, port: int, username: str, password: str) -> None:
        self._host = host
        self._port = port
        self._username = username
        self._password = password

    async def send(
        self,
        to: str,
        subject: str,
        body: str,
        reply_to: str | None = None,
        attachments: list[tuple[str, str, bytes]] | None = None,  # (filename, mime type, data)
    ) -> None:
        msg = EmailMessage()
        msg["From"] = self._username
        msg["To"] = to
        msg["Subject"] = subject.replace("\r", " ").replace("\n", " ")
        if reply_to:
            msg["Reply-To"] = reply_to
        msg.set_content(body)
        for filename, mime, data in attachments or []:
            maintype, subtype = mime.split("/", 1)
            msg.add_attachment(data, maintype=maintype, subtype=subtype, filename=filename)
        try:
            await asyncio.to_thread(self._send, msg)
        except (smtplib.SMTPException, OSError) as exc:
            logger.exception("Sending email failed")
            raise ProviderError("We couldn't send that just now. Please try again.") from exc

    def _send(self, msg: EmailMessage) -> None:
        context = ssl.create_default_context()
        if self._port == 465:
            with smtplib.SMTP_SSL(self._host, self._port, context=context, timeout=20) as smtp:
                smtp.login(self._username, self._password)
                smtp.send_message(msg)
            return
        with smtplib.SMTP(self._host, self._port, timeout=20) as smtp:
            smtp.starttls(context=context)
            smtp.login(self._username, self._password)
            smtp.send_message(msg)
