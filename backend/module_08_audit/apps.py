from django.apps import AppConfig


class Module08AuditConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "module_08_audit"

    def ready(self):
        from . import signals
        signals.register_signals()