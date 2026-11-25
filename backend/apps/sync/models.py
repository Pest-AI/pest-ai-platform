"""Appareils et synchronisation (J20) — Database Design v2.2 : Device, SyncSession,
SyncOperation, SyncConflict.

Principe : l'app terrain enregistre chaque saisie hors ligne comme une opération dont
l'identifiant (UUID) est tiré sur l'appareil. Rejouer une opération déjà reçue ne crée rien
(idempotence) ; une modification fondée sur une version dépassée devient un conflit, jamais
un écrasement silencieux.
"""

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.core.models import BaseModel


class Platform(models.TextChoices):
    ANDROID = "android", "Android"
    IOS = "ios", "iOS"
    WEB = "web", "Navigateur (PWA)"


class DeviceStatus(models.TextChoices):
    ACTIVE = "active", "Actif"
    REVOKED = "revoked", "Révoqué"
    LOST = "lost", "Perdu"


class Device(BaseModel):
    """Installation de l'application utilisée par un utilisateur. Jamais supprimée."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="devices"
    )
    installation_id = models.UUIDField(unique=True)
    platform = models.CharField(max_length=32, choices=Platform.choices)
    os_version = models.CharField(max_length=32, blank=True, default="")
    app_version = models.CharField(max_length=32, blank=True, default="")
    model = models.CharField(max_length=100, blank=True, default="")
    status = models.CharField(
        max_length=32, choices=DeviceStatus.choices, default=DeviceStatus.ACTIVE
    )
    last_seen_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        db_table = "sync_device"
        verbose_name = "appareil"
        constraints = [
            models.CheckConstraint(
                condition=Q(platform__in=Platform.values), name="device_platform_valid"
            ),
            models.CheckConstraint(
                condition=Q(status__in=DeviceStatus.values), name="device_status_valid"
            ),
        ]
        indexes = [models.Index(fields=["user", "status"], name="device_user_status_idx")]

    def __str__(self) -> str:
        return f"{self.platform} · {self.installation_id}"


def _one_space():
    return Q(organization__isnull=False, personal_producer__isnull=True) | Q(
        organization__isnull=True, personal_producer__isnull=False
    )


class SessionDirection(models.TextChoices):
    PUSH = "push", "Envoi"
    PULL = "pull", "Réception"
    BOTH = "both", "Les deux"


class SessionStatus(models.TextChoices):
    RUNNING = "running", "En cours"
    COMPLETED = "completed", "Terminée"
    PARTIAL = "partial", "Partielle"
    FAILED = "failed", "Échouée"


class SyncSession(BaseModel):
    """Un échange entre un appareil et le serveur (historique)."""

    device = models.ForeignKey(Device, on_delete=models.PROTECT, related_name="sessions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    personal_producer = models.ForeignKey(
        "actors.Producer", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    direction = models.CharField(
        max_length=32, choices=SessionDirection.choices, default=SessionDirection.PUSH
    )
    started_at = models.DateTimeField()
    finished_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=32, choices=SessionStatus.choices, default=SessionStatus.RUNNING
    )
    ops_received = models.PositiveIntegerField(default=0)
    ops_applied = models.PositiveIntegerField(default=0)
    ops_duplicate = models.PositiveIntegerField(default=0)
    ops_conflict = models.PositiveIntegerField(default=0)
    ops_rejected = models.PositiveIntegerField(default=0)
    app_version = models.CharField(max_length=32, blank=True, default="")

    class Meta:
        db_table = "sync_session"
        verbose_name = "session de synchronisation"
        constraints = [
            models.CheckConstraint(condition=_one_space(), name="sync_session_one_space")
        ]
        indexes = [
            models.Index(fields=["device", "-started_at"], name="sync_session_device_idx"),
            models.Index(fields=["organization", "started_at"], name="sync_session_org_idx"),
        ]


class OperationKind(models.TextChoices):
    CREATE = "create", "Création"
    UPDATE = "update", "Modification"
    ARCHIVE = "archive", "Archivage"


class OperationStatus(models.TextChoices):
    RECEIVED = "received", "Reçue"
    APPLIED = "applied", "Appliquée"
    DUPLICATE = "duplicate", "Déjà reçue"
    CONFLICT = "conflict", "Conflit"
    REJECTED = "rejected", "Refusée"


class SyncOperation(BaseModel):
    """Opération unitaire envoyée par un appareil ; son id (UUID de l'appareil) fait
    l'idempotence. Le `result` garde l'identifiant créé, que les opérations suivantes
    peuvent citer (« @op:<uuid> ») avant d'avoir été synchronisées."""

    id = models.UUIDField(primary_key=True, editable=False)
    session = models.ForeignKey(SyncSession, on_delete=models.PROTECT, related_name="operations")
    device = models.ForeignKey(Device, on_delete=models.PROTECT, related_name="operations")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    personal_producer = models.ForeignKey(
        "actors.Producer", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    entity_type = models.CharField(max_length=64)
    entity_id = models.UUIDField(null=True, blank=True)
    operation = models.CharField(max_length=32, choices=OperationKind.choices)
    payload = models.JSONField()
    base_row_version = models.PositiveIntegerField(null=True, blank=True)
    client_created_at = models.DateTimeField()
    client_sequence = models.PositiveIntegerField()
    received_at = models.DateTimeField()
    processed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=32, choices=OperationStatus.choices, default=OperationStatus.RECEIVED
    )
    error_code = models.CharField(max_length=64, blank=True, default="")
    result = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "sync_operation"
        verbose_name = "opération de synchronisation"
        constraints = [
            models.UniqueConstraint(
                fields=["device", "client_sequence"], name="sync_op_device_sequence"
            ),
            models.CheckConstraint(condition=_one_space(), name="sync_op_one_space"),
            models.CheckConstraint(
                condition=Q(operation__in=OperationKind.values), name="sync_op_kind_valid"
            ),
            models.CheckConstraint(
                condition=Q(status__in=OperationStatus.values), name="sync_op_status_valid"
            ),
        ]
        indexes = [
            models.Index(fields=["entity_type", "entity_id"], name="sync_op_entity_idx"),
            models.Index(fields=["organization", "status"], name="sync_op_org_status_idx"),
        ]


class ConflictType(models.TextChoices):
    CONCURRENT_UPDATE = "concurrent_update", "Modifié entre-temps sur le serveur"
    ARCHIVED_ON_SERVER = "archived_on_server", "Archivé sur le serveur"
    PERMISSION_REVOKED = "permission_revoked", "Droit retiré"
    VALIDATION_FAILED = "validation_failed", "Contrôle non passé"
    LOCKED_RECORD = "locked_record", "Fiche verrouillée"


class ResolutionStatus(models.TextChoices):
    OPEN = "open", "À trancher"
    KEPT_SERVER = "kept_server", "Version du serveur gardée"
    APPLIED_CLIENT = "applied_client", "Saisie terrain appliquée"
    MERGED = "merged", "Fusionnée"
    DISCARDED = "discarded", "Écartée"


class SyncConflict(BaseModel):
    """Conflit détecté à l'application d'une opération. Jamais résolu silencieusement."""

    operation = models.OneToOneField(
        SyncOperation, on_delete=models.PROTECT, related_name="conflict"
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="+",
    )
    personal_producer = models.ForeignKey(
        "actors.Producer", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    entity_type = models.CharField(max_length=64)
    entity_id = models.UUIDField()
    conflict_type = models.CharField(max_length=32, choices=ConflictType.choices)
    server_row_version = models.PositiveIntegerField()
    client_base_row_version = models.PositiveIntegerField(null=True, blank=True)
    server_snapshot = models.JSONField()
    client_payload = models.JSONField()
    is_sensitive = models.BooleanField(default=False)
    resolution_status = models.CharField(
        max_length=32, choices=ResolutionStatus.choices, default=ResolutionStatus.OPEN
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "sync_conflict"
        verbose_name = "conflit de synchronisation"
        constraints = [
            models.CheckConstraint(condition=_one_space(), name="sync_conflict_one_space"),
            models.CheckConstraint(
                condition=Q(conflict_type__in=ConflictType.values), name="sync_conflict_type_valid"
            ),
            models.CheckConstraint(
                condition=Q(resolution_status__in=ResolutionStatus.values),
                name="sync_conflict_resolution_valid",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "resolution_status"], name="sync_conflict_org_idx"
            ),
            models.Index(fields=["entity_type", "entity_id"], name="sync_conflict_entity_idx"),
        ]
