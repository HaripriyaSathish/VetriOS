from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    audit_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        db_column='user_id', related_name='audit_logs'
    )
    action = models.CharField(max_length=255)
    entity_type = models.CharField(max_length=255)
    entity_id = models.CharField(max_length=255)
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    source = models.CharField(max_length=255, null=True, blank=True)
    remarks = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'audit_log'
        ordering = ['-created_at']


class AccessLog(models.Model):
    EVENT_STATUS_CHOICES = [
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('DENIED', 'Denied'),
    ]

    access_log_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        db_column='user_id', related_name='access_logs'
    )
    event_type = models.CharField(max_length=255)
    resource_type = models.CharField(max_length=255, null=True, blank=True)
    resource_id = models.CharField(max_length=255, null=True, blank=True)
    event_status = models.CharField(max_length=20, default='SUCCESS')
    session_reference = models.CharField(max_length=255, null=True, blank=True)
    ip_reference = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'access_log'
        ordering = ['-created_at']


class SystemEvent(models.Model):
    EVENT_STATUS_CHOICES = [
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('WARNING', 'Warning'),
        ('INFO', 'Info'),
    ]

    system_event_id = models.BigAutoField(primary_key=True)
    event_code = models.CharField(max_length=255)
    event_type = models.CharField(max_length=255)
    event_source = models.CharField(max_length=255, null=True, blank=True)
    entity_type = models.CharField(max_length=255, null=True, blank=True)
    entity_id = models.CharField(max_length=255, null=True, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        db_column='user_id', related_name='system_events'
    )
    correlation_id = models.CharField(max_length=255, null=True, blank=True)
    event_status = models.CharField(max_length=20, default='SUCCESS')
    event_message = models.TextField(null=True, blank=True)
    event_payload = models.JSONField(null=True, blank=True)
    occurred_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'system_event'
        ordering = ['-occurred_at']