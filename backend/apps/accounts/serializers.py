"""Sérialiseurs du compte connecté."""

from django.contrib.auth import password_validation
from rest_framework import serializers

from apps.accounts.models import User


class MeSerializer(serializers.ModelSerializer):
    """Profil de l'utilisateur connecté. Le numéro de téléphone n'est pas modifiable ici."""

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
        ]
        read_only_fields = ["id", "phone_number", "phone_verified_at", "date_joined"]

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
