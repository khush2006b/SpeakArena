"""Email notification service using fastapi-mail.

Provides async functions for sending transactional authentication emails.
All email templates are inline HTML — no external template files are
required, keeping the deployment artefact self-contained.

Development mode:
    When ``APP_ENV != 'production'``, emails are logged to stdout at
    INFO level instead of being sent via SMTP. This prevents accidental
    email delivery during development and CI without requiring a live
    SMTP server.

Production mode:
    Emails are sent via the SMTP server configured in
    ``app.config.Settings`` (SMTP_HOST, SMTP_PORT, SMTP_USERNAME, etc.).
    STARTTLS is used; SSL/TLS is disabled to rely on STARTTLS upgrade.

Error handling:
    SMTP errors are caught and logged without re-raising. An email
    delivery failure should not return an error to the end user.
    The token is still valid; the user can request a resend.
"""

from __future__ import annotations

import logging

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# FastMail singleton (lazy-initialised on first use)
# ---------------------------------------------------------------------------

_fast_mail = None


def _get_fast_mail() -> object:
    """Return the shared FastMail instance, creating it on first call.

    Lazy initialization avoids importing fastapi-mail at module load time,
    which would fail if the SMTP settings are not yet configured (e.g.
    during Alembic migration runs where only DATABASE_URL is set).

    Returns:
        FastMail: Configured fastapi-mail sender instance.
    """
    global _fast_mail  # noqa: PLW0603
    if _fast_mail is None:
        from fastapi_mail import ConnectionConfig, FastMail

        conf = ConnectionConfig(
            MAIL_USERNAME=settings.SMTP_USERNAME,
            MAIL_PASSWORD=settings.SMTP_PASSWORD,
            MAIL_FROM=settings.SMTP_FROM_EMAIL,
            MAIL_PORT=settings.SMTP_PORT,
            MAIL_SERVER=settings.SMTP_HOST,
            MAIL_FROM_NAME=settings.SMTP_FROM_NAME,
            MAIL_STARTTLS=True,
            MAIL_SSL_TLS=False,
            USE_CREDENTIALS=True,
            VALIDATE_CERTS=True,
        )
        _fast_mail = FastMail(conf)
    return _fast_mail


# ===========================================================================
# Public email functions
# ===========================================================================


async def send_verification_email(
    *,
    to_email: str,
    to_name: str,
    verification_link: str,
) -> None:
    """Send an email verification link to a newly registered user.

    Called as a FastAPI BackgroundTask immediately after registration
    and resend-verification requests. The raw verification token is
    embedded in the ``verification_link`` URL query parameter.

    Args:
        to_email: Recipient email address.
        to_name: Recipient full name for personalization.
        verification_link: Complete URL the user clicks to verify. Example:
            ``https://speakarena.com/verify-email?token=abc123``
    """
    subject = f"Verify your {settings.APP_NAME} email address"
    body = _build_verification_body(to_name, verification_link)

    if not settings.is_production:
        logger.info(
            "[DEV] Verification email for %s | Link: %s",
            to_email,
            verification_link,
        )
        return

    await _send(to_email=to_email, subject=subject, body=body)


async def send_password_reset_email(
    *,
    to_email: str,
    to_name: str,
    reset_link: str,
) -> None:
    """Send a password reset link to the account owner.

    Called as a FastAPI BackgroundTask after a successful
    forgot-password request. The raw reset token is embedded
    in the ``reset_link`` URL query parameter.

    Args:
        to_email: Recipient email address.
        to_name: Recipient full name for personalization.
        reset_link: Complete URL the user clicks to reset their password.
            Example: ``https://speakarena.com/reset-password?token=abc123``
    """
    subject = f"Reset your {settings.APP_NAME} password"
    body = _build_reset_body(to_name, reset_link)

    if not settings.is_production:
        logger.info(
            "[DEV] Password reset email for %s | Link: %s",
            to_email,
            reset_link,
        )
        return

    await _send(to_email=to_email, subject=subject, body=body)


# ===========================================================================
# Private helpers
# ===========================================================================


async def _send(*, to_email: str, subject: str, body: str) -> None:
    """Send an HTML email via the configured SMTP server.

    Errors are caught and logged at ERROR level without re-raising.
    An email delivery failure must not propagate to the HTTP response.

    Args:
        to_email: Recipient email address.
        subject: Email subject line.
        body: Complete HTML body string.
    """
    try:
        from fastapi_mail import MessageSchema, MessageType

        message = MessageSchema(
            subject=subject,
            recipients=[to_email],
            body=body,
            subtype=MessageType.html,
        )
        await _get_fast_mail().send_message(message)  # type: ignore[union-attr]
        logger.info("Email sent to %s | Subject: %s", to_email, subject)
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Failed to send email to %s: %s",
            to_email,
            exc,
            exc_info=True,
        )


def _build_verification_body(name: str, link: str) -> str:
    """Build the HTML body for a verification email.

    Args:
        name: Recipient's full name.
        link: Verification URL.

    Returns:
        str: Complete HTML email body.
    """
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email — {settings.APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#2563eb;padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">{settings.APP_NAME}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Welcome, {name}!</h2>
            <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
              Thanks for signing up. Click the button below to verify your email address
              and activate your account.
            </p>
            <a href="{link}"
               style="display:inline-block;background:#2563eb;color:#ffffff;padding:14px 32px;
                      border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">
              Verify Email Address
            </a>
            <p style="margin:32px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
              This link expires in <strong>24 hours</strong>. If you did not create a
              {settings.APP_NAME} account, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              &copy; {settings.APP_NAME}. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _build_reset_body(name: str, link: str) -> str:
    """Build the HTML body for a password reset email.

    Args:
        name: Recipient's full name.
        link: Password reset URL.

    Returns:
        str: Complete HTML email body.
    """
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password — {settings.APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#dc2626;padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">{settings.APP_NAME}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Password Reset Request</h2>
            <p style="margin:0 0 8px;color:#374151;font-size:15px;">Hi {name},</p>
            <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
              We received a request to reset your {settings.APP_NAME} password.
              Click the button below to choose a new one:
            </p>
            <a href="{link}"
               style="display:inline-block;background:#dc2626;color:#ffffff;padding:14px 32px;
                      border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">
              Reset My Password
            </a>
            <p style="margin:32px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
              This link expires in <strong>1 hour</strong> and can only be used once.
              If you did not request a password reset, your account remains secure
              and you can safely ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              &copy; {settings.APP_NAME}. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""
