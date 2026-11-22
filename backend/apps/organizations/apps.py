from django.apps import AppConfig
from django.db.models.signals import post_migrate


def _seed_system_roles(sender, **kwargs):
    """Après chaque `migrate`, (re)charge les 7 rôles système et leurs permissions.

    Idempotent : sans effet si tout est déjà à jour. Garantit que les rôles existent
    dans toutes les bases (locale, test, CI, staging, production) sans étape manuelle.
    """
    from apps.organizations.services import sync_system_roles

    sync_system_roles()


class OrganizationsConfig(AppConfig):
    """Organisations, adhésions, rôles et permissions (multi-organisation)."""

    name = "apps.organizations"
    label = "organizations"
    verbose_name = "Organisations"

    def ready(self):
        post_migrate.connect(_seed_system_roles, sender=self)
