"""J20c : mesures du sol (kit de terrain, laboratoire, capteur). Ajouts seulement."""

import django.contrib.gis.db.models.fields
import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models

# Mesures du sol historisées : une mesure ne se modifie ni ne se supprime.
SOIL_SQL = """
CREATE FUNCTION parcels_soil_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'PEST AI : une mesure du sol ne se modifie pas : ajoutez-en une'
        USING ERRCODE = 'check_violation';
END;
$$;
CREATE TRIGGER parcels_soil_test_no_update BEFORE UPDATE ON parcels_soil_test
    FOR EACH ROW EXECUTE FUNCTION parcels_soil_append_only();
CREATE TRIGGER parcels_soil_test_no_delete BEFORE DELETE ON parcels_soil_test
    FOR EACH ROW EXECUTE FUNCTION parcels_forbid_delete();
CREATE TRIGGER parcels_soil_value_no_update BEFORE UPDATE ON parcels_soil_test_value
    FOR EACH ROW EXECUTE FUNCTION parcels_soil_append_only();
CREATE TRIGGER parcels_soil_value_no_delete BEFORE DELETE ON parcels_soil_test_value
    FOR EACH ROW EXECUTE FUNCTION parcels_forbid_delete();
"""
SOIL_REVERSE_SQL = """
DROP TRIGGER IF EXISTS parcels_soil_value_no_delete ON parcels_soil_test_value;
DROP TRIGGER IF EXISTS parcels_soil_value_no_update ON parcels_soil_test_value;
DROP TRIGGER IF EXISTS parcels_soil_test_no_delete ON parcels_soil_test;
DROP TRIGGER IF EXISTS parcels_soil_test_no_update ON parcels_soil_test;
DROP FUNCTION IF EXISTS parcels_soil_append_only();
"""


class Migration(migrations.Migration):

    dependencies = [
        ("actors", "0003_section_du_membre"),
        ("organizations", "0002_numeros_adherent"),
        ("parcels", "0009_profil_site_et_conditions"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SoilTest",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("client_created_at", models.DateTimeField(blank=True, null=True)),
                ("server_received_at", models.DateTimeField(blank=True, null=True)),
                ("row_version", models.PositiveIntegerField(default=1, editable=False)),
                (
                    "method",
                    models.CharField(
                        choices=[
                            ("field_kit", "Kit de terrain"),
                            ("laboratory", "Laboratoire"),
                            ("sensor", "Capteur installé"),
                        ],
                        max_length=32,
                    ),
                ),
                (
                    "device_model",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Modèle du kit ou du capteur.",
                        max_length=100,
                    ),
                ),
                ("measured_at", models.DateTimeField()),
                (
                    "depth_cm",
                    models.PositiveSmallIntegerField(
                        blank=True, help_text="Profondeur de la sonde ou du prélèvement.", null=True
                    ),
                ),
                (
                    "position",
                    django.contrib.gis.db.models.fields.PointField(
                        blank=True, null=True, srid=4326
                    ),
                ),
                ("notes", models.TextField(blank=True, default="")),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        editable=False,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "cultivation_unit",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="soil_tests",
                        to="parcels.cultivationunit",
                    ),
                ),
                (
                    "parcel",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="soil_tests",
                        to="parcels.parcel",
                    ),
                ),
                (
                    "recorded_by_organization",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="organizations.organization",
                    ),
                ),
                (
                    "recorded_by_producer",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="actors.producer",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        editable=False,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "mesure du sol",
                "verbose_name_plural": "mesures du sol",
                "db_table": "parcels_soil_test",
            },
        ),
        migrations.CreateModel(
            name="SoilTestValue",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("parameter", models.CharField(max_length=32)),
                ("value", models.DecimalField(decimal_places=3, max_digits=10)),
                ("unit", models.CharField(blank=True, default="", max_length=16)),
                (
                    "soil_test",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="values",
                        to="parcels.soiltest",
                    ),
                ),
            ],
            options={
                "verbose_name": "valeur mesurée du sol",
                "db_table": "parcels_soil_test_value",
            },
        ),
        migrations.AddIndex(
            model_name="soiltest",
            index=models.Index(
                fields=["parcel", "-measured_at"], name="soil_test_parcel_recent_idx"
            ),
        ),
        migrations.AddConstraint(
            model_name="soiltest",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(
                        ("recorded_by_organization__isnull", False),
                        ("recorded_by_producer__isnull", True),
                    ),
                    models.Q(
                        ("recorded_by_organization__isnull", True),
                        ("recorded_by_producer__isnull", False),
                    ),
                    _connector="OR",
                ),
                name="soil_test_one_recorder",
            ),
        ),
        migrations.AddConstraint(
            model_name="soiltest",
            constraint=models.CheckConstraint(
                condition=models.Q(("method__in", ["field_kit", "laboratory", "sensor"])),
                name="soil_test_method_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="soiltest",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("depth_cm__isnull", True), ("depth_cm__lte", 200), _connector="OR"
                ),
                name="soil_test_depth_range",
            ),
        ),
        migrations.AddConstraint(
            model_name="soiltestvalue",
            constraint=models.UniqueConstraint(
                fields=("soil_test", "parameter"), name="soil_value_once"
            ),
        ),
        migrations.RunSQL(SOIL_SQL, SOIL_REVERSE_SQL),
    ]
