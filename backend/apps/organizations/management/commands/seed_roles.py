"""python manage.py seed_roles : charge les 7 rôles système et le catalogue de permissions.

Idempotente : peut être relancée après chaque déploiement.
"""

from django.core.management.base import BaseCommand

from apps.organizations.models import Permission, Role
from apps.organizations.services import sync_system_roles


class Command(BaseCommand):
    help = "Crée ou met à jour les 7 rôles système, les permissions et leur matrice."

    def handle(self, *args, **options):
        sync_system_roles()
        self.stdout.write(
            self.style.SUCCESS(
                f"Rôles système : {Role.objects.count()} · "
                f"permissions : {Permission.objects.count()}"
            )
        )
        for role in Role.objects.order_by("scope", "code"):
            codes = ", ".join(role.permissions.order_by("code").values_list("code", flat=True))
            self.stdout.write(f"  {role.code:<20} [{role.scope}] {codes}")
