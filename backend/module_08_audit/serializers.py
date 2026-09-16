from rest_framework import serializers
from .models import AuditLog, AccessLog, SystemEvent


def _display_name(user):
    if not user:
        return None
    person = getattr(user, "person", None)
    if person:
        full = f"{person.first_name} {person.last_name or ''}".strip()
        if full:
            return full
    return user.username


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "audit_id", "user", "user_name", "action", "entity_type",
            "entity_id", "old_value", "new_value", "source", "remarks", "created_at"
        ]

    def get_user_name(self, obj):
        return _display_name(obj.user)


class AccessLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AccessLog
        fields = [
            "access_log_id", "user", "user_name", "event_type", "resource_type",
            "resource_id", "event_status", "session_reference", "ip_reference", "created_at"
        ]

    def get_user_name(self, obj):
        return _display_name(obj.user)


class SystemEventSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = SystemEvent
        fields = [
            "system_event_id", "event_code", "event_type", "event_source",
            "entity_type", "entity_id", "user", "user_name", "correlation_id",
            "event_status", "event_message", "event_payload", "occurred_at", "created_at"
        ]

    def get_user_name(self, obj):
        return _display_name(obj.user)