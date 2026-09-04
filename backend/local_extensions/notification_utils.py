from django.utils import timezone
from .models import Notification


def notify(recipient, module, notification_type, title, message="", link=None,
           entity_type=None, entity_id=None, actor=None):
    return Notification.objects.create(
        recipient=recipient, module=module, notification_type=notification_type,
        title=title, message=message, link=link,
        entity_type=entity_type, entity_id=entity_id, actor=actor,
    )


def mark_email_sent(notification):
    notification.email_sent = True
    notification.email_sent_at = timezone.now()
    notification.save(update_fields=["email_sent", "email_sent_at"])