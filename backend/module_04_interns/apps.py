from django.apps import AppConfig


class Module04InternsConfig(AppConfig):
    name = 'module_04_interns'

    def ready(self):
        import module_04_interns.signals  # noqa