"""Sérialiseurs des organisations, adhésions et rôles.

Règle (section 9.5) : l'organisation d'un objet n'est jamais lue dans le payload,
elle vient du contexte vérifié de la requête.
"""

from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.validators import normalize_phone_number
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
    class Meta:
        model = User
        fields = ["id", "first_name", "last_name", "phone_number"]
        read_only_fields = fields


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
    phone_number = serializers.CharField(max_length=32)
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=C.ORGANIZATION_ROLE_CODES),
        required=False,
        default=list,
    )

    def validate_phone_number(self, value):
        phone = normalize_phone_number(value)
        user = User.objects.filter(phone_number=phone, is_active=True).first()
        if user is None:
            # L'inscription autonome avec OTP (D-14) viendra plus tard :
            # l'invité doit déjà avoir un compte.
            raise serializers.ValidationError("Aucun compte actif n'existe pour ce numéro.")
        self.context["invited_user"] = user
        return phone


class RoleCodeSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=C.ROLE_CODES)


class OrganizationAdminSerializer(serializers.Serializer):
    """Désignation du premier administrateur d'une organisation par le Super Admin."""

    phone_number = serializers.CharField(max_length=32)

    def validate_phone_number(self, value):
        phone = normalize_phone_number(value)
        user = User.objects.filter(phone_number=phone, is_active=True).first()
        if user is None:
            raise serializers.ValidationError("Aucun compte actif n'existe pour ce numéro.")
        self.context["admin_user"] = user
        return phone


class ArchiveSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=3)
