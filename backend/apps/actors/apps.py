from django.apps import AppConfig


class ActorsConfig(AppConfig):
    """Producteurs (cas A et B) et leurs rattachements aux organisations."""

    name = "apps.actors"
    label = "actors"
    verbose_name = "Producteurs"
