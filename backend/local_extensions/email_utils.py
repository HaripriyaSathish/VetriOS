from django.core.mail import EmailMultiAlternatives


def send_email(to, subject, html_body, cc=None):
    """to can be a single address or a list. Empty/None entries are
    filtered out automatically so a missing official_email doesn't
    crash the send — it just skips that recipient slot. Returns True/False
    instead of raising, so callers can report per-recipient success."""
    if isinstance(to, str):
        to = [to]
    to = [t for t in to if t]
    if not to:
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
        return True
    except Exception:
        return False