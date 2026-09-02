import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.celery_app import celery_app
from app.core.config import settings

logger = logging.getLogger(__name__)

templates_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates", "emails")
env = Environment(
    loader=FileSystemLoader(templates_dir),
    autoescape=select_autoescape(["html", "xml"]),
)


def send_smtp_email(to_email: str, subject: str, html_content: str) -> bool:
    """Send HTML email via SMTP if enabled in settings, else log dispatch."""
    if not settings.EMAILS_ENABLED or not settings.SMTP_HOST:
        logger.info(f"[SMTP DISPATCH (DEV)] Email to {to_email} | Subject: '{subject}'")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
        msg["To"] = to_email

        html_part = MIMEText(html_content, "html")
        msg.attach(html_part)

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            if settings.SMTP_TLS:
                server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAILS_FROM_EMAIL, [to_email], msg.as_string())

        logger.info(f"[SMTP SUCCESS] Sent email '{subject}' to {to_email}")
        return True
    except Exception as e:
        logger.error(f"[SMTP ERROR] Failed to send email to {to_email}: {e}")
        raise e


@celery_app.task(bind=True, max_retries=3, default_retry_delay=5)
def send_otp_email_task(self, to_email: str, otp_code: str, purpose: str = "registration"):
    try:
        template = env.get_template("otp_verification.html")
        html_content = template.render(otp_code=otp_code, purpose=purpose)
        subject = f"Your SamadhanX Verification Code: {otp_code}"
        
        send_smtp_email(to_email=to_email, subject=subject, html_content=html_content)
        logger.info(f"[EMAIL DISPATCH] Sent OTP verification email to {to_email} (OTP: {otp_code})")
        return {"status": "sent", "to": to_email, "type": "otp"}
    except Exception as exc:
        logger.error(f"[EMAIL ERROR] Failed to send OTP email to {to_email}: {exc}")
        raise self.retry(exc=exc) from exc


@celery_app.task(bind=True, max_retries=3, default_retry_delay=5)
def send_welcome_email_task(self, to_email: str, full_name: str, role: str):
    try:
        template = env.get_template("welcome.html")
        html_content = template.render(
            full_name=full_name,
            role=role,
            login_url="http://localhost:5173/login",
        )
        subject = "Welcome to SamadhanX Community Innovation Platform"

        send_smtp_email(to_email=to_email, subject=subject, html_content=html_content)
        logger.info(f"[EMAIL DISPATCH] Sent Welcome email to {to_email} ({full_name})")
        return {"status": "sent", "to": to_email, "type": "welcome"}
    except Exception as exc:
        logger.error(f"[EMAIL ERROR] Failed to send Welcome email to {to_email}: {exc}")
        raise self.retry(exc=exc) from exc


@celery_app.task(bind=True, max_retries=3, default_retry_delay=5)
def send_approval_email_task(self, to_email: str, org_name: str, org_type: str):
    try:
        template = env.get_template("request_approved.html")
        html_content = template.render(
            org_name=org_name,
            org_type=org_type,
            login_url="http://localhost:5173/login",
        )
        subject = f"Account Approved: Welcome {org_name} to SamadhanX"

        send_smtp_email(to_email=to_email, subject=subject, html_content=html_content)
        logger.info(f"[EMAIL DISPATCH] Sent Approval email to {to_email} ({org_name})")
        return {"status": "sent", "to": to_email, "type": "approved"}
    except Exception as exc:
        logger.error(f"[EMAIL ERROR] Failed to send Approval email to {to_email}: {exc}")
        raise self.retry(exc=exc) from exc


@celery_app.task(bind=True, max_retries=3, default_retry_delay=5)
def send_rejection_email_task(self, to_email: str, org_name: str, reason: str | None = None):
    try:
        template = env.get_template("request_rejected.html")
        html_content = template.render(
            org_name=org_name,
            reason=reason or "Institutional credentials could not be verified.",
        )
        subject = "SamadhanX Access Request Status"

        send_smtp_email(to_email=to_email, subject=subject, html_content=html_content)
        logger.info(f"[EMAIL DISPATCH] Sent Rejection email to {to_email} ({org_name})")
        return {"status": "sent", "to": to_email, "type": "rejected"}
    except Exception as exc:
        logger.error(f"[EMAIL ERROR] Failed to send Rejection email to {to_email}: {exc}")
        raise self.retry(exc=exc) from exc
