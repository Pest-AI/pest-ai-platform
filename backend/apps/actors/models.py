"""Domaine Producteurs (Database Design v2.2, domaine 3 « Producteurs, agents et agronomes »).

- `Producer` : profil central du producteur, distinct du compte `User`. Il peut exister
  sans compte (inscrit par une organisation, cas A) ou être inscrit par le producteur
  lui-même (cas B, `self_signup`, compte obligatoire, sans organisation).
- `ProducerContact` : moyens de contact.
- `ProducerOrganizationAssignment` : rattachement historisé à une organisation. C'est lui,
  et lui seul, qui rend un producteur visible par une organisation.

Reportés (documentés dans le README de l'app) :
- `Producer.locality_zone` (FK vers `geo.GeographicZone`) arrive avec l'app `geo` ;
  `locality_text` sert en attendant ;
- `FieldAgent`, `AgronomistProfile`, `AgronomistAssignment` arrivent avec les missions (J17)
  et la revue des diagnostics (J21).
"""

from __future__ import annotations

from django.conf import settings
from django.db import IntegrityError, models, transaction
from django.db.models import Q

from apps.accounts.models import Language  # mêmes langues que le compte (fr, wo, ff)
from apps.actors import producer_code
from apps.core.models import ArchivableModel, BaseModel, ImmutableFieldsMixin, SyncModel


class Sex(models.TextChoices):
    FEMALE = "female", "Femme"
    MALE = "male", "Homme"
    UNSPECIFIED = "unspecified", "Non précisé"


class RegistrationChannel(models.TextChoices):
    ORGANIZATION = "organization", "Inscrit par une organisation"
    SELF_SIGNUP = "self_signup", "Inscrit par lui-même"


class ProducerStatus(models.TextChoices):
    ACTIVE = "active", "Actif"
    INACTIVE = "inactive", "Inactif"


class Producer(BaseModel, ArchivableModel, SyncModel):
    """Profil central du producteur (BASE, ARCH, SYNC)."""

    Sex = Sex
    Language = Language
    Channel = RegistrationChannel
    Status = ProducerStatus

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    sex = models.CharField(max_length=32, choices=Sex.choices, blank=True, default="")
    birth_year = models.PositiveIntegerField(null=True, blank=True)
    locality_text = models.TextField(blank=True, default="")
    preferred_language = models.CharField(
        max_length=32, choices=Language.choices, default=Language.FRENCH
    )
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="producer_profile",
    )
    registration_channel = models.CharField(max_length=32, choices=RegistrationChannel.choices)
    registered_by_organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    status = models.CharField(
        max_length=32, choices=ProducerStatus.choices, default=ProducerStatus.ACTIVE
    )
    producer_code = models.CharField(
        max_length=15,
        unique=True,
        blank=True,
        editable=False,
        help_text="Identifiant producteur PEST AI (PRD-SN-XXXXXXXX), permanent.",
    )
    household_size = models.PositiveSmallIntegerField(null=True, blank=True)
    household_farm_workers = models.PositiveSmallIntegerField(null=True, blank=True)

    CODE_ATTEMPTS = 5

    class Meta:
        db_table = "actors_producer"
        verbose_name = "producteur"
        verbose_name_plural = "producteurs"
        constraints = [
            # Cible future de la FK composite du consentement au diagnostic (D-12).
            models.UniqueConstraint(fields=["id", "user"], name="producer_id_user_uniq"),
            models.CheckConstraint(
                condition=Q(registration_channel__in=RegistrationChannel.values),
                name="producer_channel_valid",
            ),
            models.CheckConstraint(
                condition=Q(status__in=ProducerStatus.values), name="producer_status_valid"
            ),
            models.CheckConstraint(
                condition=Q(sex__in=["", *Sex.values]), name="producer_sex_valid"
            ),
            models.CheckConstraint(
                condition=Q(preferred_language__in=Language.values), name="producer_language_valid"
            ),
            # Cas A : une organisation est à l'origine de la fiche.
            models.CheckConstraint(
                condition=~Q(registration_channel="organization")
                | Q(registered_by_organization__isnull=False),
                name="producer_org_channel_has_org",
            ),
            # Cas B : compte obligatoire, aucune organisation d'origine.
            models.CheckConstraint(
                condition=~Q(registration_channel="self_signup")
                | Q(user__isnull=False, registered_by_organization__isnull=True),
                name="producer_self_signup_has_user",
            ),
            models.CheckConstraint(
                condition=Q(birth_year__isnull=True)
                | Q(birth_year__gte=1900, birth_year__lte=2100),
                name="producer_birth_year_range",
            ),
            models.CheckConstraint(
                condition=Q(producer_code__regex=producer_code.PATTERN),
                name="producer_code_format",
            ),
            models.CheckConstraint(
                condition=Q(household_size__isnull=True)
                | Q(household_size__gte=1, household_size__lte=200),
                name="producer_household_size_range",
            ),
            models.CheckConstraint(
                condition=Q(household_farm_workers__isnull=True)
                | Q(household_size__isnull=True)
                | Q(household_farm_workers__lte=models.F("household_size")),
                name="producer_household_workers_le_size",
            ),
        ]
        indexes = [
            models.Index(fields=["last_name", "first_name"], name="producer_name_idx"),
            models.Index(fields=["registered_by_organization"], name="producer_reg_org_idx"),
        ]

    def full_clean(self, exclude=None, validate_unique=True, validate_constraints=True):
        # Identifiant pas encore tiré (création) : il est attribué par save().
        if not self.producer_code:
            exclude = {*(exclude or ()), "producer_code"}
        return super().full_clean(exclude, validate_unique, validate_constraints)

    def save(self, *args, **kwargs):
        """Attribue l'identifiant producteur à la création (nouveau tirage en cas de collision)."""
        if self.producer_code:
            return super().save(*args, **kwargs)
        country = getattr(self.registered_by_organization, "country_code", None) or "SN"
        for _ in range(self.CODE_ATTEMPTS):
            self.producer_code = producer_code.generate(country)
            try:
                with transaction.atomic():
                    return super().save(*args, **kwargs)
            except IntegrityError as exc:
                if "producer_code" not in str(exc):
                    raise
        raise IntegrityError("Impossible d'attribuer un identifiant producteur unique.")

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}"


class ContactType(models.TextChoices):
    PHONE = "phone", "Téléphone"
    WHATSAPP = "whatsapp", "WhatsApp"
    EMAIL = "email", "E-mail"
    RELAY_PERSON = "relay_person", "Personne relais"


class ProducerContact(BaseModel, SyncModel):
    """Moyen de contact d'un producteur (BASE, SYNC). Suppression autorisée, tracée."""

    Type = ContactType

    producer = models.ForeignKey(Producer, on_delete=models.CASCADE, related_name="contacts")
    contact_type = models.CharField(max_length=32, choices=ContactType.choices)
    value = models.CharField(max_length=254)
    relay_name = models.CharField(max_length=100, blank=True, default="")
    is_primary = models.BooleanField(default=False)
    sms_consent = models.BooleanField(default=False)

    class Meta:
        db_table = "actors_producer_contact"
        verbose_name = "contact du producteur"
        verbose_name_plural = "contacts des producteurs"
        constraints = [
            models.UniqueConstraint(
                fields=["producer", "contact_type", "value"], name="producer_contact_uniq"
            ),
            models.UniqueConstraint(
                fields=["producer"],
                condition=Q(is_primary=True),
                name="producer_one_primary_contact",
            ),
            models.CheckConstraint(
                condition=Q(contact_type__in=ContactType.values), name="producer_contact_type_valid"
            ),
        ]
        indexes = [models.Index(fields=["value"], name="producer_contact_value_idx")]

    def __str__(self) -> str:
        return f"{self.contact_type}: {self.value}"


class RelationshipType(models.TextChoices):
    MEMBER = "member", "Membre"
    BENEFICIARY = "beneficiary", "Bénéficiaire"
    CLIENT = "client", "Client"


class AssignmentQuerySet(models.QuerySet):
    def active(self):
        return self.filter(end_date__isnull=True)


class ProducerOrganizationAssignment(ImmutableFieldsMixin, BaseModel):
    """Rattachement historisé producteur ↔ organisation (BASE).

    Jamais supprimé : clos par end_date.
    """

    Relationship = RelationshipType

    IMMUTABLE_FIELDS = ("producer", "organization")

    producer = models.ForeignKey(Producer, on_delete=models.PROTECT, related_name="assignments")
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.PROTECT, related_name="producer_assignments"
    )
    relationship_type = models.CharField(
        max_length=32, choices=RelationshipType.choices, default=RelationshipType.MEMBER
    )
    membership_number = models.CharField(max_length=50, null=True, blank=True)  # noqa: DJ001
    section = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Section, groupement ou village de rattachement dans l'organisation.",
    )
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)

    objects = AssignmentQuerySet.as_manager()

    class Meta:
        db_table = "actors_producer_org_assignment"
        verbose_name = "rattachement producteur"
        verbose_name_plural = "rattachements producteurs"
        constraints = [
            models.UniqueConstraint(
                fields=["producer", "organization"],
                condition=Q(end_date__isnull=True),
                name="producer_assignment_one_open",
            ),
            models.UniqueConstraint(
                fields=["organization", "membership_number"],
                condition=Q(membership_number__isnull=False),
                name="producer_assignment_number_uniq",
            ),
            models.CheckConstraint(
                condition=Q(relationship_type__in=RelationshipType.values),
                name="producer_assignment_type_valid",
            ),
            models.CheckConstraint(
                condition=Q(end_date__isnull=True) | Q(end_date__gte=models.F("start_date")),
                name="producer_assignment_dates_ordered",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization"],
                condition=Q(end_date__isnull=True),
                name="producer_assignment_open_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.producer} @ {self.organization}"
