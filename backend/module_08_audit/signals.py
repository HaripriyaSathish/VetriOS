from django.db.models.signals import post_save, post_delete
from django.utils import timezone

from .models import AuditLog
from .middleware import get_current_user

# Models to audit, grouped by app for readability. Each entry is
# (app_label, model_name) — resolved lazily via apps.get_model in
# apps.py's ready(), so this file never directly imports other apps'
# models (avoids import-order/circular-import issues at startup).
AUDITED_MODELS = [
    ("module_01_identity_access", "UserAccount"),
    ("module_01_identity_access", "Role"),
    ("module_01_identity_access", "UserRole"),
    ("module_05_clients_projects", "Client"),
    ("module_05_clients_projects", "Project"),
    ("module_05_clients_projects", "ClientPayment"),
    ("module_04_interns", "Intern"),
    ("module_04_interns", "InternshipRecommendation"),
    ("module_06_documents", "Document"),
]

# Fields never written into old_value/new_value — password hashes and
# similarly sensitive columns should never land in a readable audit log.
SENSITIVE_FIELDS = {"password", "password_hash"}


def _serialize_instance(instance):
    """Best-effort flat dict of an instance's concrete field values,
    for storing in audit_log.new_value. Skips sensitive fields and
    anything that doesn't serialize cleanly to JSON (falls back to str)."""
    data = {}
    for field in instance._meta.concrete_fields:
        name = field.name
        if name in SENSITIVE_FIELDS:
            continue
        try:
            value = getattr(instance, name)
        except Exception:
            continue
        if value is None or isinstance(value, (str, int, float, bool)):
            data[name] = value
        else:
            data[name] = str(value)
    return data


def _entity_id(instance):
    return str(instance.pk)


def make_save_handler(model_label):
    def handler(sender, instance, created, **kwargs):
        try:
            AuditLog.objects.create(
                user=get_current_user(),
                action="CREATE" if created else "UPDATE",
                entity_type=sender.__name__,
                entity_id=_entity_id(instance),
                old_value=None,
                new_value=_serialize_instance(instance),
                source="web",
                remarks=None,
                created_at=timezone.now(),
            )
        except Exception:
            # Never let audit logging break the actual save.
            pass
    return handler


def make_delete_handler(model_label):
    def handler(sender, instance, **kwargs):
        try:
            AuditLog.objects.create(
                user=get_current_user(),
                action="DELETE",
                entity_type=sender.__name__,
                entity_id=_entity_id(instance),
                old_value=_serialize_instance(instance),
                new_value=None,
                source="web",
                remarks=None,
                created_at=timezone.now(),
            )
        except Exception:
            pass
    return handler


def register_signals():
    """Called once from AuditConfig.ready(). Uses apps.get_model so this
    module never imports other apps' models at module-load time."""
    from django.apps import apps

    for app_label, model_name in AUDITED_MODELS:
        try:
            model = apps.get_model(app_label, model_name)
        except LookupError:
            continue

        model_label = f"{app_label}.{model_name}"
        post_save.connect(make_save_handler(model_label), sender=model, weak=False)
        post_delete.connect(make_delete_handler(model_label), sender=model, weak=False)