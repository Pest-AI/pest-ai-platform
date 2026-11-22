from django.apps import AppConfig


class CoreConfig(AppConfig):
    """Briques communes : mixins, services d'archivage, contrôles transverses."""

    name = "apps.core"
    label = "core"
    verbose_name = "Socle commun"
