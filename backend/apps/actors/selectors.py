"""Lectures du domaine Producteurs.

Règle de visibilité (Design v2.2) : une organisation voit un producteur uniquement
via un `ProducerOrganizationAssignment` ACTIF. Aucune autre voie au MVP (les
bénéficiaires de programmes arriveront avec l'app `programs`).
"""

from __future__ import annotations

import re
import unicodedata

from django.db.models import Exists, OuterRef, Prefetch, Q, QuerySet

from apps.actors.models import Producer, ProducerContact, ProducerOrganizationAssignment


def visible_producers(organization) -> QuerySet[Producer]:
    """Producteurs rattachés (lien actif) à l'organisation, fiches archivées exclues."""
    open_link = ProducerOrganizationAssignment.objects.filter(
        producer=OuterRef("pk"), organization=organization, end_date__isnull=True
    )
    return (
        Producer.objects.filter(Exists(open_link), is_archived=False)
        .prefetch_related(
            Prefetch(
                "contacts", queryset=ProducerContact.objects.order_by("-is_primary", "created_at")
            ),
            Prefetch(
                "assignments",
                queryset=ProducerOrganizationAssignment.objects.filter(
                    organization=organization
                ).order_by("-start_date", "-created_at"),
                to_attr="org_assignments",
            ),
        )
        .order_by("last_name", "first_name")
    )


def active_assignment(producer: Producer, organization) -> ProducerOrganizationAssignment | None:
    return (
        ProducerOrganizationAssignment.objects.active()
        .filter(producer=producer, organization=organization)
        .first()
    )


def has_active_assignment(*, user, organization) -> bool:
    """Le compte `user` a-t-il une fiche producteur rattachée (lien actif) à `organization` ?"""
    return (
        ProducerOrganizationAssignment.objects.active()
        .filter(producer__user=user, producer__is_archived=False, organization=organization)
        .exists()
    )


def active_personal_profile(user) -> Producer | None:
    """Profil producteur actif du compte (condition de l'espace personnel, D-01)."""
    if not user or not user.is_authenticated:
        return None
    return Producer.objects.filter(
        user=user, status=Producer.Status.ACTIVE, is_archived=False
    ).first()


def normalize_name(value: str) -> str:
    """Nom comparable : sans accents, minuscules, espaces réduits."""
    text = unicodedata.normalize("NFKD", value or "")
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", text).strip().lower()


def find_duplicates(
    *, first_name: str, last_name: str, phone: str | None, locality: str
) -> list[Producer]:
    """Doublons probables (D-28) : même téléphone, ou même nom complet dans la même localité.

    Recherche sur tout le registre (le registre des producteurs est partagé) ; la vue
    décide de ce qui peut être montré à l'organisation.
    """
    conditions = Q()
    if phone:
        conditions |= Q(contacts__contact_type__in=["phone", "whatsapp"], contacts__value=phone)
    locality_norm = normalize_name(locality)
    if locality_norm:
        name_candidates = [
            p.pk
            for p in Producer.objects.filter(
                first_name__iexact=first_name.strip(),
                last_name__iexact=last_name.strip(),
                is_archived=False,
            )
            if normalize_name(p.locality_text) == locality_norm
        ]
        conditions |= Q(pk__in=name_candidates)
    if not conditions:
        return []
    return list(
        Producer.objects.filter(conditions, is_archived=False)
        .distinct()
        .prefetch_related("contacts")[:5]
    )
