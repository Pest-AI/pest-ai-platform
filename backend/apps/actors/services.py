"""Écritures du domaine Producteurs. Les auteurs sont toujours passés explicitement."""

from __future__ import annotations

from datetime import date

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.actors import selectors
from apps.actors.models import (
    ContactType,
    Producer,
    ProducerContact,
    ProducerOrganizationAssignment,
    RegistrationChannel,
)
from apps.core.audit import PRODUCER_CHANGE, security_event

PROFILE_FIELDS = (
    "first_name",
    "last_name",
    "sex",
    "birth_year",
    "locality_text",
    "preferred_language",
)


class DuplicateProducerError(Exception):
    """Doublons probables trouvés à la création (D-28) : la création doit être confirmée."""

    def __init__(self, candidates: list[Producer]):
        super().__init__("Producteur probablement déjà enregistré.")
        self.candidates = candidates


def _clean_profile(fields: dict) -> dict:
    data = {k: v for k, v in fields.items() if k in PROFILE_FIELDS}
    for key in ("first_name", "last_name", "locality_text"):
        if key in data and data[key] is not None:
            data[key] = data[key].strip()
    if data.get("sex") is None and "sex" in data:
        data["sex"] = ""
    return data


def _set_primary_phone(producer: Producer, phone: str | None, by) -> None:
    """Fixe le téléphone principal (contact `phone` principal). Vide : retire le principal."""
    current = producer.contacts.filter(is_primary=True).first()
    if current and current.contact_type == ContactType.PHONE and current.value == phone:
        return
    if current:
        current.is_primary = False
        current.updated_by = by
        current.save(update_fields=["is_primary", "updated_by", "updated_at"])
    if not phone:
        return
    contact, created = ProducerContact.objects.get_or_create(
        producer=producer,
        contact_type=ContactType.PHONE,
        value=phone,
        defaults={"is_primary": True, "created_by": by, "updated_by": by},
    )
    if not created:
        contact.is_primary = True
        contact.updated_by = by
        contact.save(update_fields=["is_primary", "updated_by", "updated_at"])


def _open_assignment(producer, organization, by, relationship_type, membership_number, start_date):
    if selectors.active_assignment(producer, organization):
        raise ValidationError({"producer": "Ce producteur est déjà rattaché à votre organisation."})
    try:
        with transaction.atomic():
            return ProducerOrganizationAssignment.objects.create(
                producer=producer,
                organization=organization,
                relationship_type=relationship_type
                or ProducerOrganizationAssignment.Relationship.MEMBER,
                membership_number=(membership_number or "").strip() or None,
                start_date=start_date or timezone.localdate(),
                created_by=by,
                updated_by=by,
            )
    except IntegrityError as exc:
        raise ValidationError(
            {"membership_number": "Ce numéro d'adhérent est déjà utilisé dans votre organisation."}
        ) from exc


@transaction.atomic
def register_producer(
    *,
    organization,
    registered_by,
    phone_number: str | None = None,
    relationship_type: str | None = None,
    membership_number: str | None = None,
    start_date: date | None = None,
    confirm_new: bool = False,
    **profile,
) -> Producer:
    """Cas A : une organisation enregistre un producteur (sans compte) et le rattache.

    Si des doublons probables existent (D-28) et que la création n'est pas confirmée,
    lève DuplicateProducerError avec les candidats : l'utilisateur choisit alors de
    rattacher la fiche existante ou de confirmer une nouvelle fiche.
    """
    data = _clean_profile(profile)
    if not confirm_new:
        candidates = selectors.find_duplicates(
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
            phone=phone_number,
            locality=data.get("locality_text", ""),
        )
        if candidates:
            raise DuplicateProducerError(candidates)
    producer = Producer(
        **data,
        registration_channel=RegistrationChannel.ORGANIZATION,
        registered_by_organization=organization,
        server_received_at=timezone.now(),
        created_by=registered_by,
        updated_by=registered_by,
    )
    producer.full_clean()
    producer.save()
    _set_primary_phone(producer, phone_number, registered_by)
    _open_assignment(
        producer, organization, registered_by, relationship_type, membership_number, start_date
    )
    security_event(
        PRODUCER_CHANGE,
        user=registered_by,
        organization=organization,
        change="registered",
        producer_id=producer.pk,
    )
    return producer


@transaction.atomic
def attach_producer(
    *,
    producer: Producer,
    organization,
    attached_by,
    relationship_type: str | None = None,
    membership_number: str | None = None,
    start_date: date | None = None,
) -> ProducerOrganizationAssignment:
    """Rattache une fiche existante (doublon détecté, ou retour d'un ancien membre).

    Un producteur indépendant (cas B) gère lui-même son profil : son rattachement exigera
    son accord (consentement, à venir). Au MVP, une organisation ne peut pas le rattacher seule.
    """
    if producer.is_archived:
        raise ValidationError({"producer": "Cette fiche producteur est archivée."})
    if producer.registration_channel == RegistrationChannel.SELF_SIGNUP:
        raise ValidationError(
            {
                "producer": "Ce producteur gère son propre compte : "
                "son accord est nécessaire pour le rattacher."
            }
        )
    assignment = _open_assignment(
        producer, organization, attached_by, relationship_type, membership_number, start_date
    )
    security_event(
        PRODUCER_CHANGE,
        user=attached_by,
        organization=organization,
        change="attached",
        producer_id=producer.pk,
    )
    return assignment


@transaction.atomic
def update_producer(*, producer: Producer, updated_by, phone_number=..., **profile) -> Producer:
    """Modifie la fiche. `phone_number` absent : inchangé ; vide : téléphone principal retiré."""
    data = _clean_profile(profile)
    for key, value in data.items():
        setattr(producer, key, value)
    producer.updated_by = updated_by
    producer.full_clean()
    producer.save()
    if phone_number is not ...:
        _set_primary_phone(producer, phone_number or None, updated_by)
    return producer


@transaction.atomic
def end_assignment(
    *, assignment: ProducerOrganizationAssignment, ended_by, end_date: date | None = None
):
    """Clôt le rattachement (jamais supprimé).

    Retire aussi le rôle producteur éventuel dans cette organisation.
    """
    if assignment.end_date is not None:
        raise ValidationError({"assignment": "Ce rattachement est déjà clos."})
    end = end_date or timezone.localdate()
    if end < assignment.start_date:
        raise ValidationError(
            {"end_date": "La date de fin précède la date de début du rattachement."}
        )
    assignment.end_date = end
    assignment.updated_by = ended_by
    assignment.save(update_fields=["end_date", "updated_by", "updated_at"])

    user = assignment.producer.user
    if user is not None:
        from apps.organizations import constants as C
        from apps.organizations.models import MembershipRole

        for role in MembershipRole.objects.active().filter(
            membership__user=user,
            membership__organization=assignment.organization,
            role__code=C.PRODUCER,
        ):
            role.revoked_at = timezone.now()
            role.updated_by = ended_by
            role.save(update_fields=["revoked_at", "updated_by", "updated_at"])
    security_event(
        PRODUCER_CHANGE,
        user=ended_by,
        organization=assignment.organization,
        change="detached",
        producer_id=assignment.producer_id,
    )
    return assignment


@transaction.atomic
def create_personal_profile(*, user, **profile) -> Producer:
    """Cas B : un compte crée son propre profil producteur (espace personnel, sans organisation)."""
    if Producer.objects.filter(user=user).exists():
        raise ValidationError({"user": "Ce compte a déjà un profil producteur."})
    data = _clean_profile(profile)
    producer = Producer(
        **data,
        user=user,
        registration_channel=RegistrationChannel.SELF_SIGNUP,
        server_received_at=timezone.now(),
        created_by=user,
        updated_by=user,
    )
    producer.full_clean()
    producer.save()
    _set_primary_phone(producer, user.phone_number, user)
    security_event(PRODUCER_CHANGE, user=user, change="self_signup", producer_id=producer.pk)
    return producer


@transaction.atomic
def update_assignment(*, assignment: ProducerOrganizationAssignment, updated_by, **fields):
    """Modifie le type de relation ou le numéro d'adhérent du rattachement actif."""
    if assignment.end_date is not None:
        raise ValidationError({"assignment": "Ce rattachement est clos."})
    if "relationship_type" in fields:
        assignment.relationship_type = fields["relationship_type"]
    if "membership_number" in fields:
        assignment.membership_number = (fields["membership_number"] or "").strip() or None
    assignment.updated_by = updated_by
    try:
        with transaction.atomic():
            assignment.save()
    except IntegrityError as exc:
        raise ValidationError(
            {"membership_number": "Ce numéro d'adhérent est déjà utilisé dans votre organisation."}
        ) from exc
    return assignment
