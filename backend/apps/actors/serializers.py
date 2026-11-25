from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.models import Language
from apps.accounts.validators import normalize_phone_number, validate_e164
from apps.actors.models import (
    ContactType,
    Producer,
    ProducerContact,
    ProducerOrganizationAssignment,
    RelationshipType,
    Sex,
)


def _phone(value):
    if value in (None, ""):
        return ""
    phone = normalize_phone_number(value)
    try:
        validate_e164(phone)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(exc.messages) from exc
    return phone


class ProducerContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProducerContact
        fields = ["id", "contact_type", "value", "relay_name", "is_primary", "sms_consent"]
        read_only_fields = fields


class AssignmentSerializer(serializers.ModelSerializer):
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = ProducerOrganizationAssignment
        fields = [
            "id",
            "relationship_type",
            "membership_number",
            "section",
            "start_date",
            "end_date",
            "is_active",
        ]
        read_only_fields = fields

    def get_is_active(self, obj) -> bool:
        return obj.end_date is None


class ProducerSerializer(serializers.ModelSerializer):
    """Fiche producteur vue par l'organisation du contexte."""

    phone_number = serializers.SerializerMethodField(
        help_text="Téléphone principal (E.164) ou vide."
    )
    has_account = serializers.SerializerMethodField(help_text="Le producteur a un compte PEST AI.")
    contacts = ProducerContactSerializer(many=True, read_only=True)
    assignment = serializers.SerializerMethodField(
        help_text="Rattachement actif à votre organisation."
    )
    history = serializers.SerializerMethodField(
        help_text="Rattachements à votre organisation, du plus récent."
    )

    class Meta:
        model = Producer
        fields = [
            "id",
            "producer_code",
            "first_name",
            "last_name",
            "sex",
            "birth_year",
            "locality_text",
            "preferred_language",
            "household_size",
            "household_farm_workers",
            "registration_channel",
            "status",
            "phone_number",
            "has_account",
            "contacts",
            "assignment",
            "history",
            "created_at",
            "updated_at",
            "row_version",
        ]
        read_only_fields = fields

    def _org_assignments(self, obj):
        items = getattr(obj, "org_assignments", None)
        if items is None:
            organization = self.context.get("organization")
            items = list(obj.assignments.filter(organization=organization).order_by("-start_date"))
        return items

    def get_phone_number(self, obj) -> str:
        for contact in obj.contacts.all():
            if contact.is_primary and contact.contact_type == ContactType.PHONE:
                return contact.value
        return ""

    def get_has_account(self, obj) -> bool:
        return obj.user_id is not None

    @extend_schema_field(AssignmentSerializer(allow_null=True))
    def get_assignment(self, obj):
        active = next((a for a in self._org_assignments(obj) if a.end_date is None), None)
        return AssignmentSerializer(active).data if active else None

    @extend_schema_field(AssignmentSerializer(many=True))
    def get_history(self, obj):
        return AssignmentSerializer(self._org_assignments(obj), many=True).data


class _ProfileFields(serializers.Serializer):
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    sex = serializers.ChoiceField(choices=Sex.choices, required=False, allow_blank=True)
    birth_year = serializers.IntegerField(
        min_value=1900, max_value=2100, required=False, allow_null=True
    )
    locality_text = serializers.CharField(required=False, allow_blank=True, max_length=200)
    preferred_language = serializers.ChoiceField(choices=Language.choices, required=False)
    household_size = serializers.IntegerField(
        min_value=1,
        max_value=200,
        required=False,
        allow_null=True,
        help_text="Personnes du ménage.",
    )
    household_farm_workers = serializers.IntegerField(
        min_value=0,
        max_value=200,
        required=False,
        allow_null=True,
        help_text="Membres du ménage qui travaillent aux champs.",
    )

    def validate(self, attrs):
        size, workers = attrs.get("household_size"), attrs.get("household_farm_workers")
        if size is not None and workers is not None and workers > size:
            raise serializers.ValidationError(
                {"household_farm_workers": "Pas plus d'actifs que de personnes dans le ménage."}
            )
        return attrs


class ProducerCreateSerializer(_ProfileFields):
    phone_number = serializers.CharField(
        required=False, allow_blank=True, help_text="Téléphone principal, format E.164 (+221…)."
    )
    relationship_type = serializers.ChoiceField(choices=RelationshipType.choices, required=False)
    membership_number = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=50,
        help_text="Vide pour un membre : numéro attribué automatiquement (PRÉFIXE-000123).",
    )
    section = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        help_text="Section, groupement ou village de rattachement dans l'organisation.",
    )
    start_date = serializers.DateField(
        required=False, help_text="Début du rattachement (défaut : aujourd'hui)."
    )
    confirm_new = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Créer la fiche même si des doublons probables ont été signalés (réponse 409).",
    )

    def validate_phone_number(self, value):
        return _phone(value)


class ProducerUpdateSerializer(_ProfileFields):
    first_name = serializers.CharField(max_length=100, required=False)
    last_name = serializers.CharField(max_length=100, required=False)
    phone_number = serializers.CharField(required=False, allow_blank=True)
    relationship_type = serializers.ChoiceField(choices=RelationshipType.choices, required=False)
    membership_number = serializers.CharField(required=False, allow_blank=True, max_length=50)
    section = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        help_text="Section, groupement ou village de rattachement dans l'organisation.",
    )

    def validate_phone_number(self, value):
        return _phone(value)


class AttachProducerSerializer(serializers.Serializer):
    producer_id = serializers.UUIDField()
    relationship_type = serializers.ChoiceField(choices=RelationshipType.choices, required=False)
    membership_number = serializers.CharField(required=False, allow_blank=True, max_length=50)
    section = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        help_text="Section, groupement ou village de rattachement dans l'organisation.",
    )
    start_date = serializers.DateField(required=False)


class DetachProducerSerializer(serializers.Serializer):
    end_date = serializers.DateField(
        required=False, help_text="Fin du rattachement (défaut : aujourd'hui)."
    )


class DuplicateCandidateSerializer(serializers.Serializer):
    """Doublon probable, avec le minimum d'informations (minimisation, D-08)."""

    id = serializers.UUIDField()
    display_name = serializers.CharField(
        help_text="Prénom et initiale du nom, ou nom complet si déjà rattaché."
    )
    locality = serializers.CharField()
    phone_hint = serializers.CharField(help_text="Deux derniers chiffres du téléphone, ou vide.")
    in_organization = serializers.BooleanField(help_text="Déjà rattaché à votre organisation.")
    can_attach = serializers.BooleanField(help_text="Peut être rattaché par votre organisation.")


class DuplicateResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    candidates = DuplicateCandidateSerializer(many=True)


class PersonalProfileSerializer(serializers.ModelSerializer):
    """Profil producteur du compte connecté (espace personnel)."""

    class Meta:
        model = Producer
        fields = [
            "id",
            "producer_code",
            "first_name",
            "last_name",
            "sex",
            "birth_year",
            "locality_text",
            "preferred_language",
            "household_size",
            "household_farm_workers",
            "registration_channel",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "producer_code", "registration_channel", "status", "created_at"]
        extra_kwargs = {"sex": {"required": False}, "preferred_language": {"required": False}}


class MembershipNumberProposalSerializer(serializers.Serializer):
    proposed = serializers.CharField(help_text="Numéro qui serait attribué maintenant.")
    prefix = serializers.CharField()
