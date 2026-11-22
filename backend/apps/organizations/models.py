"""Organisations, adhésions, rôles et permissions (Database Design v2.2, domaine 1).

Règles portées par ce fichier :
- 7 rôles système exactement (CHECK sur Role.code et cohérence code/portée) ;
- une seule adhésion non révoquée par couple (utilisateur, organisation) ;
- adhésions, rôles d'adhésion et attributions plateforme jamais supprimés : historisés ;
- un rôle d'adhésion est de portée organization, l'attribution plateforme de portée platform.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.models import ArchivableModel, BaseModel, ImmutableFieldsMixin
from apps.organizations import constants as C


# ---------------------------------------------------------------------------
# Énumérations (niveau module : utilisables dans les contraintes Meta)
# ---------------------------------------------------------------------------
class OrganizationType(models.TextChoices):
    COOPERATIVE = "cooperative", "Coopérative"
    UNION = "union", "Union"
    NGO = "ngo", "ONG"
    COMPANY = "company", "Entreprise"
    INSTITUTION = "institution", "Institution"
    PUBLIC_AGENCY = "public_agency", "Agence publique"
    PEST_AI = "pest_ai", "PEST AI"


class OrganizationStatus(models.TextChoices):
    PENDING = "pending", "En attente"
    ACTIVE = "active", "Active"
    SUSPENDED = "suspended", "Suspendue"
    CLOSED = "closed", "Fermée"


class MembershipStatus(models.TextChoices):
    INVITED = "invited", "Invitée"
    ACTIVE = "active", "Active"
    SUSPENDED = "suspended", "Suspendue"
    REVOKED = "revoked", "Révoquée"


class Scope(models.TextChoices):
    ORGANIZATION = C.SCOPE_ORGANIZATION, "Organisation"
    PLATFORM = C.SCOPE_PLATFORM, "Plateforme"
    PERSONAL = C.SCOPE_PERSONAL, "Personnel"


# ---------------------------------------------------------------------------
# Organisation
# ---------------------------------------------------------------------------
class Organization(BaseModel, ArchivableModel):
    """Structure utilisatrice : coopérative, ONG, entreprise, institution ou PEST AI."""

    OrganizationType = OrganizationType
    Status = OrganizationStatus

    name = models.CharField(max_length=200)
    short_name = models.CharField(max_length=50, blank=True, default="")
    organization_type = models.CharField(max_length=32, choices=OrganizationType.choices)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.PENDING)
    # NULL quand absent : l'unicité (pays, identifiant) ne s'applique qu'aux valeurs renseignées.
    legal_identifier = models.CharField(  # noqa: DJ001
        max_length=64,
        null=True,
        blank=True,
        help_text="Identifiant légal (ex. NINEA) si disponible.",
    )
    country_code = models.CharField(max_length=2, default="SN", help_text="ISO 3166-1 alpha-2.")
    # administrative_zone (FK GeographicZone) : ajoutée avec l'application geo (mission ultérieure).
    address = models.TextField(blank=True, default="")
    phone_number = models.CharField(max_length=16, blank=True, default="")
    email = models.EmailField(max_length=254, blank=True, default="")
    parent_organization = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="child_organizations",
        help_text="Ex. union de coopératives. Ne donne AUCUN droit d'accès implicite.",
    )

    class Meta:
        db_table = "organizations_organization"
        verbose_name = "organisation"
        verbose_name_plural = "organisations"
        constraints = [
            models.UniqueConstraint(
                fields=["country_code", "legal_identifier"],
                condition=models.Q(legal_identifier__isnull=False),
                name="org_legal_identifier_unique_per_country",
            ),
            models.CheckConstraint(
                condition=models.Q(organization_type__in=OrganizationType.values),
                name="org_type_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=OrganizationStatus.values),
                name="org_status_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(country_code__regex=r"^[A-Z]{2}$"),
                name="org_country_code_iso2",
            ),
            models.CheckConstraint(
                condition=~models.Q(parent_organization=models.F("id")),
                name="org_not_its_own_parent",
            ),
        ]
        indexes = [
            models.Index(fields=["organization_type"], name="org_type_idx"),
            models.Index(fields=["status"], name="org_status_idx"),
            models.Index(fields=["parent_organization"], name="org_parent_idx"),
        ]

    def save(self, *args, **kwargs):
        if self.legal_identifier == "":
            self.legal_identifier = None
        if self.country_code:
            self.country_code = self.country_code.upper()
        super().save(*args, **kwargs)

    @property
    def is_operational(self) -> bool:
        """Une organisation n'ouvre un espace de travail que si elle est active et non archivée."""
        return self.status == self.Status.ACTIVE and not self.is_archived

    def __str__(self) -> str:
        return self.name


# ---------------------------------------------------------------------------
# Rôles et permissions (référentiel système)
# ---------------------------------------------------------------------------
class Role(BaseModel):
    """Un des 7 rôles système validés (D-15 : non personnalisables au MVP)."""

    class Code(models.TextChoices):
        SUPER_ADMIN = C.SUPER_ADMIN, "Super Admin"
        ORGANIZATION_ADMIN = C.ORGANIZATION_ADMIN, "Organization Admin"
        COOPERATIVE_MANAGER = C.COOPERATIVE_MANAGER, "Cooperative Manager"
        FIELD_AGENT = C.FIELD_AGENT, "Field Agent"
        AGRONOMIST = C.AGRONOMIST, "Agronomist"
        PRODUCER = C.PRODUCER, "Producer"
        PROGRAM_MANAGER = C.PROGRAM_MANAGER, "Program Manager"

    code = models.CharField(max_length=64, unique=True, choices=Code.choices)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    scope = models.CharField(
        max_length=32,
        choices=[(C.SCOPE_ORGANIZATION, "Organisation"), (C.SCOPE_PLATFORM, "Plateforme")],
    )
    is_system = models.BooleanField(default=True)
    permissions = models.ManyToManyField(
        "Permission", through="RolePermission", related_name="roles"
    )

    class Meta:
        db_table = "organizations_role"
        verbose_name = "rôle"
        verbose_name_plural = "rôles"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(code__in=C.ROLE_CODES), name="role_code_is_one_of_seven"
            ),
            # super_admin est le seul rôle de portée platform ;
            # les 6 autres sont de portée organization.
            models.CheckConstraint(
                condition=(
                    models.Q(code=C.SUPER_ADMIN, scope=C.SCOPE_PLATFORM)
                    | (~models.Q(code=C.SUPER_ADMIN) & models.Q(scope=C.SCOPE_ORGANIZATION))
                ),
                name="role_scope_matches_code",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class Permission(BaseModel):
    """Autorisation élémentaire « domaine.action ».

    La portée personal n'est jamais donnée par un rôle.
    """

    code = models.CharField(max_length=100, unique=True)
    domain = models.CharField(max_length=50)
    scope = models.CharField(max_length=32, choices=Scope.choices)
    description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "organizations_permission"
        verbose_name = "permission"
        verbose_name_plural = "permissions"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(scope__in=Scope.values), name="permission_scope_valid"
            ),
        ]

    def __str__(self) -> str:
        return self.code


class RolePermission(BaseModel):
    """Association rôle ↔ permission : même portée, jamais personal.

    Contrôle applicatif + tests.
    """

    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(
        Permission, on_delete=models.CASCADE, related_name="role_permissions"
    )

    class Meta:
        db_table = "organizations_role_permission"
        verbose_name = "permission de rôle"
        verbose_name_plural = "permissions de rôle"
        constraints = [
            models.UniqueConstraint(fields=["role", "permission"], name="role_permission_unique"),
        ]

    def clean(self):
        if self.permission.scope == C.SCOPE_PERSONAL:
            raise ValidationError(
                "Une permission de portée personal n'est jamais attribuée par un rôle."
            )
        if self.permission.scope != self.role.scope:
            raise ValidationError("La portée de la permission doit être celle du rôle.")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Adhésions
# ---------------------------------------------------------------------------
class MembershipQuerySet(models.QuerySet):
    def for_organization(self, organization):
        """Seule voie d'accès des vues métier : filtre sur l'organisation du contexte."""
        return self.filter(organization=organization)

    def not_revoked(self):
        return self.exclude(status=OrganizationMembership.Status.REVOKED)

    def active(self):
        return self.filter(status=OrganizationMembership.Status.ACTIVE)


class OrganizationMembership(ImmutableFieldsMixin, BaseModel):
    """Appartenance d'un utilisateur à une organisation. Jamais supprimée : révoquée."""

    Status = MembershipStatus

    IMMUTABLE_FIELDS = ("user", "organization")

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="memberships"
    )
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="memberships"
    )
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.INVITED)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    joined_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    objects = MembershipQuerySet.as_manager()

    class Meta:
        db_table = "organizations_membership"
        verbose_name = "adhésion"
        verbose_name_plural = "adhésions"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "organization"],
                condition=models.Q(status__in=["invited", "active", "suspended"]),
                name="membership_one_open_per_user_org",
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=MembershipStatus.values),
                name="membership_status_valid",
            ),
            # Révoquée <=> date de fin renseignée.
            models.CheckConstraint(
                condition=(
                    models.Q(status="revoked", ended_at__isnull=False)
                    | (~models.Q(status="revoked") & models.Q(ended_at__isnull=True))
                ),
                name="membership_revoked_iff_ended",
            ),
            # Une adhésion active ou suspendue a forcément été rejointe.
            models.CheckConstraint(
                condition=~models.Q(status__in=["active", "suspended"])
                | models.Q(joined_at__isnull=False),
                name="membership_joined_when_active",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status"], name="membership_org_status_idx"),
            models.Index(fields=["user", "status"], name="membership_user_status_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.user} @ {self.organization} ({self.status})"


class MembershipRoleQuerySet(models.QuerySet):
    def active(self):
        return self.filter(revoked_at__isnull=True)


class MembershipRole(ImmutableFieldsMixin, BaseModel):
    """Rôle attribué dans le cadre d'une adhésion. Historisé par revoked_at."""

    IMMUTABLE_FIELDS = ("membership", "role")

    membership = models.ForeignKey(
        OrganizationMembership, on_delete=models.PROTECT, related_name="role_assignments"
    )
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name="membership_assignments")
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    assigned_at = models.DateTimeField(default=timezone.now)
    revoked_at = models.DateTimeField(null=True, blank=True)

    objects = MembershipRoleQuerySet.as_manager()

    class Meta:
        db_table = "organizations_membership_role"
        verbose_name = "rôle d'adhésion"
        verbose_name_plural = "rôles d'adhésion"
        constraints = [
            models.UniqueConstraint(
                fields=["membership", "role"],
                condition=models.Q(revoked_at__isnull=True),
                name="membership_role_one_active",
            ),
            models.CheckConstraint(
                condition=models.Q(revoked_at__isnull=True)
                | models.Q(revoked_at__gte=models.F("assigned_at")),
                name="membership_role_revoked_after_assigned",
            ),
        ]
        indexes = [
            models.Index(
                fields=["membership"],
                condition=models.Q(revoked_at__isnull=True),
                name="membership_role_active_idx",
            ),
        ]

    def clean(self):
        if self.role.scope != C.SCOPE_ORGANIZATION:
            raise ValidationError(
                {"role": "Seuls les rôles de portée organization s'attribuent par adhésion."}
            )

    def save(self, *args, **kwargs):
        if self._state.adding:
            self.clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.role.code} — {self.membership}"


# ---------------------------------------------------------------------------
# Rôle de portée plateforme
# ---------------------------------------------------------------------------
class PlatformRoleAssignmentQuerySet(models.QuerySet):
    def active(self, at=None):
        at = at or timezone.now()
        return self.filter(valid_from__lte=at).filter(
            models.Q(valid_until__isnull=True) | models.Q(valid_until__gt=at)
        )


class PlatformRoleAssignment(ImmutableFieldsMixin, BaseModel):
    """Attribution du rôle super_admin. Exception contrôlée à l'isolation, toujours justifiée."""

    IMMUTABLE_FIELDS = ("user", "role", "granted_by", "valid_from", "justification")

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="platform_roles"
    )
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name="platform_assignments")
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    valid_from = models.DateTimeField(default=timezone.now)
    valid_until = models.DateTimeField(
        null=True, blank=True, help_text="Accès à durée limitée recommandé."
    )
    justification = models.TextField()

    objects = PlatformRoleAssignmentQuerySet.as_manager()

    class Meta:
        db_table = "organizations_platform_role_assignment"
        verbose_name = "attribution plateforme"
        verbose_name_plural = "attributions plateforme"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "role"],
                condition=models.Q(valid_until__isnull=True),
                name="platform_role_one_open_per_user",
            ),
            models.CheckConstraint(
                condition=models.Q(valid_until__isnull=True)
                | models.Q(valid_until__gt=models.F("valid_from")),
                name="platform_role_valid_period",
            ),
            models.CheckConstraint(
                condition=~models.Q(justification__regex=r"^\s*$"),
                name="platform_role_justification_required",
            ),
        ]

    def clean(self):
        if self.role.scope != C.SCOPE_PLATFORM:
            raise ValidationError(
                {"role": "Seul un rôle de portée platform (super_admin) s'attribue ici."}
            )

    def save(self, *args, **kwargs):
        if self._state.adding:
            self.clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.role.code} — {self.user}"
