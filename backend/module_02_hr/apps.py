from django.apps import AppConfig


class Module02HrConfig(AppConfig):
    name = 'module_02_hr'

    def ready(self):
        from . import signals  # noqa: F401
