"""Attribue super_admin.

Usage :
    python manage.py grant_super_admin --phone +221... --granted-by +221... \\
        --justification "..." [--days 30]

Attribue le rôle de portée plateforme super_admin (PlatformRoleAssignment).
L'auteur (--granted-by) doit être un superutilisateur technique Django ou un
super_admin actif. Justification obligatoire ; durée limitée recommandée.
"""

from datetime import timedelta

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.validators import normalize_phone_number
from apps.organizations import selectors, services


class Command(BaseCommand):
    help = "Attribue le rôle super_admin à un utilisateur (avec justification)."

    def add_arguments(self, parser):
        parser.add_argument("--phone", required=True, help="Numéro de l'utilisateur bénéficiaire.")
        parser.add_argument(
            "--granted-by", required=True, help="Numéro de l'auteur de l'attribution."
        )
        parser.add_argument("--justification", required=True)
        parser.add_argument(
            "--days", type=int, default=None, help="Durée de validité en jours (recommandé)."
        )

    def handle(self, *args, **options):
        try:
            user = User.objects.get(
                phone_number=normalize_phone_number(options["phone"]), is_active=True
            )
            author = User.objects.get(
                phone_number=normalize_phone_number(options["granted_by"]), is_active=True
            )
        except User.DoesNotExist as exc:
            raise CommandError("Utilisateur actif introuvable pour l'un des numéros.") from exc
        if not (author.is_superuser or selectors.has_active_platform_role(author)):
            raise CommandError(
                "L'auteur doit être superutilisateur technique ou super_admin actif."
            )
        valid_until = timezone.now() + timedelta(days=options["days"]) if options["days"] else None
        try:
            assignment = services.grant_platform_role(
                user=user,
                granted_by=author,
                justification=options["justification"],
                valid_until=valid_until,
            )
        except ValidationError as exc:
            raise CommandError("; ".join(exc.messages)) from exc
        until = assignment.valid_until.isoformat() if assignment.valid_until else "sans date de fin"
        self.stdout.write(self.style.SUCCESS(f"super_admin attribué à {user} ({until})."))
