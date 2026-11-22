"""Crée le compte d'administration initial d'un environnement déployé (idempotent).

Utilisé au démarrage du conteneur (entrypoint.sh) : les offres gratuites de Render
n'ont pas de console, le premier compte est donc créé à partir de variables
d'environnement saisies dans le tableau de bord Render (jamais dans le dépôt).

Variables :
    INITIAL_ADMIN_PHONE        numéro E.164 (+221…)        ─┐ toutes les trois
    INITIAL_ADMIN_PASSWORD     mot de passe                  ├ ou aucune
    INITIAL_ADMIN_FIRST_NAME / INITIAL_ADMIN_LAST_NAME      ─┘ (facultatives)
    INITIAL_ADMIN_SUPER_ADMIN_DAYS   durée du rôle super_admin (défaut 90 ; 0 = ne pas l'attribuer)

Sans effet si les variables sont absentes, ou si le compte et le rôle existent déjà.
Le mot de passe d'un compte existant n'est jamais modifié.
"""

import os
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.validators import normalize_phone_number
from apps.organizations import selectors, services


class Command(BaseCommand):
    help = "Crée le compte d'administration initial à partir des variables d'environnement."

    def handle(self, *args, **options):
        phone = os.environ.get("INITIAL_ADMIN_PHONE", "").strip()
        password = os.environ.get("INITIAL_ADMIN_PASSWORD", "")
        if not phone:
            self.stdout.write("INITIAL_ADMIN_PHONE absent : rien à faire.")
            return
        phone = normalize_phone_number(phone)

        user = User.objects.filter(phone_number=phone).first()
        if user is None:
            if not password:
                raise CommandError("INITIAL_ADMIN_PASSWORD est obligatoire pour créer le compte.")
            user = User.objects.create_superuser(
                phone_number=phone,
                password=password,
                first_name=os.environ.get("INITIAL_ADMIN_FIRST_NAME", "Admin"),
                last_name=os.environ.get("INITIAL_ADMIN_LAST_NAME", "PEST AI"),
            )
            self.stdout.write(self.style.SUCCESS(f"Compte technique créé : {phone}"))
        else:
            self.stdout.write(f"Compte {phone} déjà présent (mot de passe inchangé).")

        days = int(os.environ.get("INITIAL_ADMIN_SUPER_ADMIN_DAYS", "90"))
        if days > 0 and not selectors.has_active_platform_role(user):
            services.grant_platform_role(
                user=user,
                granted_by=user,
                justification="Administration initiale de l'environnement (amorçage automatique).",
                valid_until=timezone.now() + timedelta(days=days),
            )
            self.stdout.write(self.style.SUCCESS(f"Rôle super_admin attribué pour {days} jours."))
