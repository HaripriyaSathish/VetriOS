from django.utils import timezone
from .models import AccessLog, SystemEvent


def _get_client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log_access(request, user=None, event_type="LOGIN", event_status="SUCCESS",
                resource_type=None, resource_id=None, session_reference=None):
    """Writes one row to access_log. Never raises — a logging failure
    should never break the actual login/action itself."""
    try:
        AccessLog.objects.create(
            user=user,
            event_type=event_type,
            resource_type=resource_type,
            resource_id=resource_id,
            event_status=event_status,
            session_reference=session_reference,
            ip_reference=_get_client_ip(request),
        )
    except Exception:
        pass


def log_system_event(event_code, event_type, event_status="SUCCESS",
                      event_source=None, entity_type=None, entity_id=None,
                      user=None, correlation_id=None, event_message=None,
                      event_payload=None):
    """Writes one row to system_event. Never raises — a logging failure
    should never break the actual background job itself."""
    try:
        SystemEvent.objects.create(
            event_code=event_code,
            event_type=event_type,
            event_source=event_source,
            entity_type=entity_type,
            entity_id=entity_id,
            user=user,
            correlation_id=correlation_id,
            event_status=event_status,
            event_message=event_message,
            event_payload=event_payload,
            occurred_at=timezone.now(),
        )
    except Exception:
        pass