"""Sérialiseurs du compte connecté."""

from django.contrib.auth import password_validation
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.models import User


class MyMembershipSerializer(serializers.Serializer):
    """Une adhésion de l'utilisateur connecté, avec la valeur X-Workspace à utiliser."""

    id = serializers.UUIDField(read_only=True)
    organization_id = serializers.UUIDField(source="organization.id", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    organization_type = serializers.CharField(
        source="organization.organization_type", read_only=True
    )
    status = serializers.CharField(read_only=True)
    joined_at = serializers.DateTimeField(read_only=True)
    workspace = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()

    def get_workspace(self, obj) -> str:
        """Valeur à envoyer dans l'en-tête X-Workspace pour agir dans cette organisation."""
        return f"org:{obj.organization_id}"

    def get_roles(self, obj) -> list[str]:
        return sorted(a.role.code for a in obj.role_assignments.all() if a.revoked_at is None)


class MeSerializer(serializers.ModelSerializer):
    """Profil de l'utilisateur connecté. Le numéro de téléphone n'est pas modifiable ici."""

    memberships = serializers.SerializerMethodField()
    is_platform_admin = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "phone_number",
            "first_name",
            "last_name",
            "email",
            "preferred_language",
            "phone_verified_at",
            "date_joined",
            "memberships",
            "is_platform_admin",
        ]
        read_only_fields = ["id", "phone_number", "phone_verified_at", "date_joined"]

    @extend_schema_field(MyMembershipSerializer(many=True))
    def get_memberships(self, obj) -> list[dict]:
        from apps.organizations.selectors import memberships_of_user

        return MyMembershipSerializer(memberships_of_user(obj), many=True).data

    def get_is_platform_admin(self, obj) -> bool:
        """Vrai si l'utilisateur a un rôle super_admin actif (accès à la Console Admin)."""
        from apps.organizations.selectors import has_active_platform_role

        return has_active_platform_role(obj)

    def validate_email(self, value):
        if not value:
            return None
        value = User.objects.normalize_email(value)
        others = User.objects.filter(email__iexact=value)
        if self.instance is not None:
            others = others.exclude(pk=self.instance.pk)
        if others.exists():
            raise serializers.ValidationError("Cette adresse e-mail est déjà utilisée.")
        return value


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Mot de passe actuel incorrect.")
        return value

    def validate_new_password(self, value):
        password_validation.validate_password(value, user=self.context["request"].user)
        return value


class AccountActivationSerializer(serializers.Serializer):
    """Activation d'un compte créé par invitation."""

    phone_number = serializers.CharField(max_length=32)
    code = serializers.CharField(max_length=16, trim_whitespace=True)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
