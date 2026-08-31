import logging
import os

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.celery_app import celery_app

logger = logging.getLogger(__name__)

templates_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates", "emails")
env = Environment(
    loader=FileSystemLoader(templates_dir),
    autoescape=select_autoescape(["html", "xml"]),
)

@celery_app.task(bind=True, max_retries=3, default_retry_delay=5)
def send_otp_email_task(self, to_email: str, otp_code: str, purpose: str = "registration"):
    try:
        template = env.get_template("otp_verification.html")
        _ = template.render(otp_code=otp_code, purpose=purpose)
        logger.info(f"[EMAIL DISPATCH] Sent OTP verification email to {to_email} (OTP: {otp_code})")
        return {"status": "sent", "to": to_email, "type": "otp"}
    except Exception as exc:
        logger.error(f"[EMAIL ERROR] Failed to send OTP email to {to_email}: {exc}")
        raise self.retry(exc=exc) from exc

@celery_app.task(bind=True, max_retries=3, default_retry_delay=5)
def send_welcome_email_task(self, to_email: str, full_name: str, role: str):
    try:
        template = env.get_template("welcome.html")
        _ = template.render(
            full_name=full_name,
            role=role,
            login_url="http://localhost:5173/login",
        )
        logger.info(f"[EMAIL DISPATCH] Sent Welcome email to {to_email} ({full_name})")
        return {"status": "sent", "to": to_email, "type": "welcome"}
    except Exception as exc:
        logger.error(f"[EMAIL ERROR] Failed to send Welcome email to {to_email}: {exc}")
        raise self.retry(exc=exc) from exc

@celery_app.task(bind=True, max_retries=3, default_retry_delay=5)
def send_approval_email_task(self, to_email: str, org_name: str, org_type: str):
    try:
        template = env.get_template("request_approved.html")
        _ = template.render(
            org_name=org_name,
            org_type=org_type,
            login_url="http://localhost:5173/login",
        )
        logger.info(f"[EMAIL DISPATCH] Sent Approval email to {to_email} ({org_name})")
        return {"status": "sent", "to": to_email, "type": "approved"}
    except Exception as exc:
        logger.error(f"[EMAIL ERROR] Failed to send Approval email to {to_email}: {exc}")
        raise self.retry(exc=exc) from exc

@celery_app.task(bind=True, max_retries=3, default_retry_delay=5)
def send_rejection_email_task(self, to_email: str, org_name: str, reason: str | None = None):
    try:
        template = env.get_template("request_rejected.html")
        _ = template.render(
            org_name=org_name,
            reason=reason or "Institutional credentials could not be verified.",
        )
        logger.info(f"[EMAIL DISPATCH] Sent Rejection email to {to_email} ({org_name})")
        return {"status": "sent", "to": to_email, "type": "rejected"}
    except Exception as exc:
        logger.error(f"[EMAIL ERROR] Failed to send Rejection email to {to_email}: {exc}")
        raise self.retry(exc=exc) from exc
