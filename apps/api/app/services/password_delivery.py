"""Password reset delivery adapters.

The local adapter is explicitly development-only and writes a mode-0600 mail
capture. The SMTP adapter sends the same reset link without logging it.
"""

import asyncio
import json
import os
import smtplib
import ssl
import tempfile
import uuid
from dataclasses import dataclass
from email.message import EmailMessage
from pathlib import Path
from typing import Protocol

from app.core.config import Settings


class PasswordResetDeliveryError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        retryable: bool = False,
        failure_code: str = "DELIVERY_FAILED",
        bounce_class: str | None = None,
    ):
        super().__init__(message)
        self.retryable = retryable
        self.failure_code = failure_code
        self.bounce_class = bounce_class


@dataclass(frozen=True, repr=False)
class PasswordResetDispatch:
    challenge_id: uuid.UUID
    user_id: uuid.UUID
    recipient: str
    reset_url: str
    expires_at_iso: str


class PasswordResetDelivery(Protocol):
    name: str

    async def deliver(self, message: PasswordResetDispatch) -> None: ...


class DisabledPasswordResetDelivery:
    name = "disabled"

    async def deliver(self, message: PasswordResetDispatch) -> None:
        raise PasswordResetDeliveryError(
            "Password reset delivery is disabled.",
            failure_code="DELIVERY_DISABLED",
        )


class LocalCapturePasswordResetDelivery:
    name = "local_capture"

    def __init__(self, directory: str):
        self.directory = Path(directory)

    async def deliver(self, message: PasswordResetDispatch) -> None:
        await asyncio.to_thread(self._write_capture, message)

    def _write_capture(self, message: PasswordResetDispatch) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        if self.directory.is_symlink() or not self.directory.is_dir():
            raise PasswordResetDeliveryError("Local capture path must be a real directory.")
        os.chmod(self.directory, 0o700)
        payload = {
            "kind": "DEVELOPMENT_ONLY_PASSWORD_RESET_CAPTURE",
            "challenge_id": str(message.challenge_id),
            "recipient": message.recipient,
            "reset_url": message.reset_url,
            "expires_at": message.expires_at_iso,
        }
        fd, temporary = tempfile.mkstemp(prefix=".password-reset-", dir=self.directory)
        target = self.directory / f"password-reset-{message.challenge_id}.json"
        try:
            os.fchmod(fd, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, ensure_ascii=True, separators=(",", ":"))
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, target)
            os.chmod(target, 0o600)
        except Exception:
            try:
                os.close(fd)
            except OSError:
                pass
            try:
                os.unlink(temporary)
            except FileNotFoundError:
                pass
            raise


class SMTPPasswordResetDelivery:
    name = "smtp"

    def __init__(self, settings: Settings):
        self.host = settings.password_reset_smtp_host
        self.port = settings.password_reset_smtp_port
        self.starttls = settings.password_reset_smtp_starttls
        self.username = settings.password_reset_smtp_username
        self.password = (
            settings.password_reset_smtp_password.get_secret_value()
            if settings.password_reset_smtp_password
            else ""
        )
        self.sender = str(settings.password_reset_from_email)

    async def deliver(self, message: PasswordResetDispatch) -> None:
        await asyncio.to_thread(self._send, message)

    def _send(self, message: PasswordResetDispatch) -> None:
        email = EmailMessage()
        email["Subject"] = "Reset your NUR password"
        email["From"] = self.sender
        email["To"] = message.recipient
        sender_domain = self.sender.rsplit("@", 1)[-1]
        email["Message-ID"] = (
            f"<nur-password-reset-{message.challenge_id}@{sender_domain}>"
        )
        email.set_content(
            "A password reset was requested for your NUR account.\n\n"
            f"Open this one-time link: {message.reset_url}\n\n"
            "If you did not request this, you can ignore this message."
        )
        try:
            with smtplib.SMTP(self.host, self.port, timeout=15) as client:
                client.ehlo()
                if self.starttls:
                    client.starttls(context=ssl.create_default_context())
                    client.ehlo()
                if self.username:
                    client.login(self.username, self.password)
                client.send_message(email)
        except smtplib.SMTPRecipientsRefused as exc:
            raise PasswordResetDeliveryError(
                "The mail provider permanently rejected the recipient.",
                failure_code="RECIPIENT_REJECTED",
                bounce_class="PERMANENT",
            ) from exc
        except smtplib.SMTPAuthenticationError as exc:
            raise PasswordResetDeliveryError(
                "The mail provider rejected server credentials.",
                failure_code="PROVIDER_AUTHENTICATION",
            ) from exc
        except smtplib.SMTPResponseException as exc:
            retryable = 400 <= exc.smtp_code < 500
            raise PasswordResetDeliveryError(
                "The mail provider rejected password reset delivery.",
                retryable=retryable,
                failure_code=(
                    "PROVIDER_TEMPORARY" if retryable else "PROVIDER_PERMANENT"
                ),
            ) from exc
        except (smtplib.SMTPServerDisconnected, TimeoutError, OSError) as exc:
            raise PasswordResetDeliveryError(
                "The mail provider is temporarily unavailable.",
                retryable=True,
                failure_code="PROVIDER_UNAVAILABLE",
            ) from exc


def build_password_reset_delivery(settings: Settings) -> PasswordResetDelivery:
    if settings.password_reset_delivery == "smtp":
        return SMTPPasswordResetDelivery(settings)
    if settings.password_reset_delivery == "local_capture":
        if settings.app_env == "production":
            raise ValueError("Local password reset capture is forbidden in production.")
        return LocalCapturePasswordResetDelivery(settings.password_reset_local_capture_dir)
    return DisabledPasswordResetDelivery()
