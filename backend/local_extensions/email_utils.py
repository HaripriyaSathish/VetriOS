from django.core.mail import EmailMultiAlternatives
from module_08_audit.log_utils import log_system_event


def send_email(to, subject, html_body, cc=None):
    """to can be a single address or a list. Empty/None entries are
    filtered out automatically so a missing official_email doesn't
    crash the send — it just skips that recipient slot. Returns True/False
    instead of raising, so callers can report per-recipient success."""
    if isinstance(to, str):
        to = [to]
    to = [t for t in to if t]
    if not to:
        log_system_event(
            event_code="EMAIL_FAILED", event_type="EMAIL",
            event_status="FAILED", event_source="email_utils",
            event_message="No valid recipients after filtering.",
        )
        return False

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=html_body,
            to=to,
            cc=[c for c in (cc or []) if c],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send()
        log_system_event(
            event_code="EMAIL_SENT", event_type="EMAIL",
            event_status="SUCCESS", event_source="email_utils",
            event_message=f"Sent to {len(to)} recipient(s): {subject}",
            event_payload={"to": to, "cc": cc or []},
        )
        return True
    except Exception as e:
        log_system_event(
            event_code="EMAIL_FAILED", event_type="EMAIL",
            event_status="FAILED", event_source="email_utils",
            event_message=str(e),
            event_payload={"to": to, "subject": subject},
        )
        return False