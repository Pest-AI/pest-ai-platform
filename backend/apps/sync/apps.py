from django.apps import AppConfig


class SyncConfig(AppConfig):
    """Appareils et synchronisation hors ligne (J20, Database Design v2.2)."""

    name = "apps.sync"
    label = "sync"
    verbose_name = "Synchronisation"
