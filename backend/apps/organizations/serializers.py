"""Sérialiseurs des organisations, adhésions et rôles.

Règle (section 9.5) : l'organisation d'un objet n'est jamais lue dans le payload,
elle vient du contexte vérifié de la requête.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.validators import normalize_phone_number, validate_e164
from apps.organizations import constants as C
from apps.organizations.models import Organization, OrganizationMembership


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "short_name",
            "organization_type",
            "status",
            "legal_identifier",
            "country_code",
            "address",
            "phone_number",
            "email",
            "parent_organization",
            "is_archived",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "organization_type",
            "status",
            "legal_identifier",
            "country_code",
            "parent_organization",
            "is_archived",
            "created_at",
        ]


class PlatformOrganizationSerializer(serializers.ModelSerializer):
    """Création et gestion par le Super Admin (portée plateforme)."""

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "short_name",
            "organization_type",
            "status",
            "legal_identifier",
            "country_code",
            "address",
            "phone_number",
            "email",
            "parent_organization",
            "is_archived",
            "archived_at",
            "archive_reason",
            "created_at",
        ]
        read_only_fields = ["id", "is_archived", "archived_at", "archive_reason", "created_at"]


class MemberUserSerializer(serializers.ModelSerializer):
    account_activated = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "first_name", "last_name", "phone_number", "account_activated"]
        read_only_fields = fields

    def get_account_activated(self, obj) -> bool:
        """Faux tant que la personne invitée n'a pas choisi son mot de passe."""
        return obj.has_usable_password()


class MembershipSerializer(serializers.ModelSerializer):
    user = MemberUserSerializer(read_only=True)
    roles = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationMembership
        fields = [
            "id",
            "user",
            "status",
            "roles",
            "invited_by",
            "joined_at",
            "ended_at",
            "created_at",
        ]
        read_only_fields = fields

    def get_roles(self, obj) -> list[str]:
        return sorted(a.role.code for a in obj.role_assignments.all() if a.revoked_at is None)


class InviteMemberSerializer(serializers.Serializer):
    """Invitation par numéro. Prénom et nom sont requis si aucun compte n'existe encore."""

    phone_number = serializers.CharField(max_length=32)
    first_name = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=C.ORGANIZATION_ROLE_CODES),
        required=False,
        default=list,
    )

    def validate_phone_number(self, value):
        phone = normalize_phone_number(value)
        try:
            validate_e164(phone)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return phone


class InvitationResultSerializer(MembershipSerializer):
    """Adhésion créée, avec le code d'activation à transmettre (affiché une seule fois)."""

    activation_code = serializers.CharField(
        allow_null=True,
        read_only=True,
        help_text="Code à remettre à la personne si son compte n'est pas encore activé, "
        "sinon null. Affiché une seule fois.",
    )

    class Meta(MembershipSerializer.Meta):
        fields = [*MembershipSerializer.Meta.fields, "activation_code"]
        read_only_fields = fields


class ActivationCodeSerializer(serializers.Serializer):
    activation_code = serializers.CharField(read_only=True)
    expires_at = serializers.DateTimeField(read_only=True)


class RoleCodeSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=C.ROLE_CODES)


class OrganizationAdminSerializer(serializers.Serializer):
    """Désignation d'un administrateur d'organisation par le Super Admin.

    Même règle que l'invitation : sans compte existant, le compte est créé (prénom et nom
    requis) et un code d'activation est renvoyé.
    """

    phone_number = serializers.CharField(max_length=32)
    first_name = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")

    def validate_phone_number(self, value):
        phone = normalize_phone_number(value)
        try:
            validate_e164(phone)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return phone


class ArchiveSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=3)
