from rest_framework import serializers

from apps.sync.models import Platform
from apps.sync.services import MAX_OPERATIONS, ROUTES

ENTITY_TYPES = sorted({e for e, _ in ROUTES})


class DeviceInfoSerializer(serializers.Serializer):
    installation_id = serializers.UUIDField(help_text="UUID tiré à l'installation de l'app.")
    platform = serializers.ChoiceField(choices=Platform.choices)
    app_version = serializers.CharField(max_length=32, required=False, allow_blank=True)
    os_version = serializers.CharField(max_length=32, required=False, allow_blank=True)
    model = serializers.CharField(max_length=100, required=False, allow_blank=True)


class OperationInputSerializer(serializers.Serializer):
    id = serializers.UUIDField(help_text="UUID tiré sur l'appareil : clé d'idempotence.")
    entity_type = serializers.ChoiceField(choices=ENTITY_TYPES)
    operation = serializers.ChoiceField(choices=["create", "update"])
    entity_id = serializers.CharField(
        required=False, allow_null=True, help_text="Objet modifié : UUID ou « @op:<uuid> »."
    )
    params = serializers.DictField(
        required=False, help_text="Paramètres de chemin (parcel, cycle) : UUID ou « @op:<uuid> »."
    )
    payload = serializers.DictField(help_text="Corps identique à la saisie en ligne.")
    base_row_version = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    client_created_at = serializers.DateTimeField()
    client_sequence = serializers.IntegerField(min_value=0)


class PushRequestSerializer(serializers.Serializer):
    device = DeviceInfoSerializer()
    operations = serializers.ListField(
        child=OperationInputSerializer(), max_length=MAX_OPERATIONS, allow_empty=False
    )


class OperationResultSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    status = serializers.ChoiceField(
        choices=["applied", "duplicate", "conflict", "rejected", "pending", "retry"],
        help_text="pending : dépend d'une opération pas encore appliquée ; retry : serveur "
        "occupé. Dans les deux cas rien n'est enregistré : à renvoyer.",
    )
    original_status = serializers.CharField(required=False)
    error_code = serializers.CharField(allow_blank=True)
    result = serializers.JSONField(required=False, allow_null=True)


class PushResponseSerializer(serializers.Serializer):
    session = serializers.UUIDField()
    status = serializers.CharField()
    results = OperationResultSerializer(many=True)
