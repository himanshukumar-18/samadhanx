"""Celery tasks package."""

from app.tasks.email import (
    send_approval_email_task,
    send_otp_email_task,
    send_rejection_email_task,
    send_welcome_email_task,
)

__all__ = [
    "send_otp_email_task",
    "send_welcome_email_task",
    "send_approval_email_task",
    "send_rejection_email_task",
]
