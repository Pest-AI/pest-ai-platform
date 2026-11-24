"""Attribue un numéro d'adhérent aux membres actuels qui n'en ont pas (J18c).

À lancer une fois après le déploiement, d'abord à blanc :
    python manage.py assign_membership_numbers --dry-run
    python manage.py assign_membership_numbers
Ajoute des numéros seulement : aucun numéro existant n'est modifié, aucune ligne supprimée.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.actors import membership_numbers
from apps.actors.models import ProducerOrganizationAssignment, RelationshipType


class Command(BaseCommand):
    help = "Attribue un numéro d'adhérent aux membres actifs qui n'en ont pas."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Compter sans rien écrire.")
        parser.add_argument("--organization", help="Identifiant d'une seule organisation.")

    def handle(self, *args, dry_run=False, organization=None, **options):
        queryset = (
            ProducerOrganizationAssignment.objects.active()
            .filter(relationship_type=RelationshipType.MEMBER, membership_number__isnull=True)
            .select_related("organization")
            .order_by("organization__name", "start_date", "created_at")
        )
        if organization:
            queryset = queryset.filter(organization_id=organization)
        rows = list(queryset)
        if dry_run:
            self.stdout.write(f"{len(rows)} membre(s) sans numéro d'adhérent (rien n'est écrit).")
            return
        for row in rows:
            with transaction.atomic():
                row.membership_number = membership_numbers.allocate(row.organization)
                row.save(update_fields=["membership_number", "updated_at"])
        self.stdout.write(self.style.SUCCESS(f"{len(rows)} numéro(s) d'adhérent attribué(s)."))
