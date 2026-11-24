"""Numéros d'adhérent (J18c, décision du fondateur du 24/11/2026).

- Obligatoire pour tout **membre** d'une coopérative ; facultatif pour un bénéficiaire ou
  un client (producteur suivi sans adhésion).
- Unique dans l'organisation et jamais réutilisé, même après la fin du rattachement
  (contrainte UNIQUE en base sur toutes les lignes, closes comprises).
- Proposé automatiquement : « PRÉFIXE-000123 » ; le préfixe est réglable par organisation
  (sinon déduit de son nom court). Un numéro saisi à la main reste accepté (reprise de la
  numérotation existante de la coopérative) ; le compteur ne redescend jamais.
"""

from __future__ import annotations

import re
import unicodedata

from apps.organizations.models import Organization

WIDTH = 6
STOP_WORDS = {"DE", "DES", "DU", "LA", "LE", "LES", "ET", "D", "L", "COOPERATIVE", "AGRICOLE"}


def default_prefix(organization: Organization) -> str:
    """Préfixe déduit : premier mot du nom court, sinon initiales du nom (« FPIP », « CARB »)."""

    def plain(text: str) -> str:
        return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().upper()

    short = re.findall(r"[A-Z0-9]+", plain(organization.short_name or ""))
    if short:
        return short[0][:8]
    words = [w for w in re.findall(r"[A-Z0-9]+", plain(organization.name)) if w not in STOP_WORDS]
    return ("".join(w[0] for w in words[:4]) or "ADH")[:8]


def prefix_for(organization: Organization) -> str:
    return organization.member_number_prefix or default_prefix(organization)


def _highest_used(organization: Organization, prefix: str) -> int:
    from apps.actors.models import ProducerOrganizationAssignment

    pattern = re.compile(rf"^{re.escape(prefix)}-(\d+)$")
    numbers = ProducerOrganizationAssignment.objects.filter(
        organization=organization, membership_number__startswith=f"{prefix}-"
    ).values_list("membership_number", flat=True)
    return max((int(m.group(1)) for n in numbers if (m := pattern.match(n))), default=0)


def propose(organization: Organization) -> str:
    """Numéro qui serait attribué maintenant (sans le réserver)."""
    prefix = prefix_for(organization)
    n = max(organization.member_number_seq, _highest_used(organization, prefix)) + 1
    return f"{prefix}-{n:0{WIDTH}d}"


def allocate(organization: Organization) -> str:
    """Réserve le numéro suivant (verrou sur l'organisation ; à appeler dans une transaction)."""
    locked = Organization.objects.select_for_update().get(pk=organization.pk)
    prefix = prefix_for(locked)
    n = max(locked.member_number_seq, _highest_used(locked, prefix)) + 1
    Organization.objects.filter(pk=locked.pk).update(member_number_seq=n)
    return f"{prefix}-{n:0{WIDTH}d}"


def note_manual(organization: Organization, number: str) -> None:
    """Un numéro saisi au format du préfixe fait avancer le compteur (pas de futur doublon)."""
    prefix = prefix_for(organization)
    m = re.fullmatch(rf"{re.escape(prefix)}-(\d+)", number or "")
    if m:
        Organization.objects.filter(
            pk=organization.pk, member_number_seq__lt=int(m.group(1))
        ).update(member_number_seq=int(m.group(1)))
