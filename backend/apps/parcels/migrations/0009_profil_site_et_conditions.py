"""J18d : profil de site (sol, eau, irrigation, accès), affectation communale, conditions
d'exploitation (loyer, part de récolte). Ajouts seulement."""

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models

# Profil de site historisé : une version ne se modifie ni ne se supprime (addendum v2.3).
HISTORY_SQL = """
CREATE FUNCTION parcels_site_profile_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'PEST AI : une version du profil de site ne se modifie pas : ajoutez-en une'
        USING ERRCODE = 'check_violation';
END;
$$;
CREATE TRIGGER parcels_site_profile_no_update BEFORE UPDATE ON parcels_site_profile
    FOR EACH ROW EXECUTE FUNCTION parcels_site_profile_append_only();
CREATE TRIGGER parcels_site_profile_no_delete BEFORE DELETE ON parcels_site_profile
    FOR EACH ROW EXECUTE FUNCTION parcels_forbid_delete();
"""
HISTORY_REVERSE_SQL = """
DROP TRIGGER IF EXISTS parcels_site_profile_no_delete ON parcels_site_profile;
DROP TRIGGER IF EXISTS parcels_site_profile_no_update ON parcels_site_profile;
DROP FUNCTION IF EXISTS parcels_site_profile_append_only();
"""


class Migration(migrations.Migration):

    dependencies = [
        ("actors", "0003_section_du_membre"),
        ("organizations", "0002_numeros_adherent"),
        ("parcels", "0008_unite_cible_cycle"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ParcelSiteProfile",
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
                ("soil_local_type", models.CharField(blank=True, default="", max_length=32)),
                ("soil_texture", models.CharField(blank=True, default="", max_length=32)),
                ("salinity", models.CharField(blank=True, default="", max_length=32)),
                ("flooding", models.CharField(blank=True, default="", max_length=32)),
                ("slope", models.CharField(blank=True, default="", max_length=32)),
                ("perceived_fertility", models.CharField(blank=True, default="", max_length=32)),
                ("water_regime", models.CharField(blank=True, default="", max_length=32)),
                ("water_source", models.CharField(blank=True, default="", max_length=32)),
                ("irrigation_method", models.CharField(blank=True, default="", max_length=32)),
                ("scheme_type", models.CharField(blank=True, default="", max_length=32)),
                (
                    "scheme_name",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Périmètre, casier ou maille.",
                        max_length=150,
                    ),
                ),
                ("pump_access", models.CharField(blank=True, default="", max_length=32)),
                ("water_availability", models.CharField(blank=True, default="", max_length=32)),
                ("road_access", models.CharField(blank=True, default="", max_length=32)),
                (
                    "distance_to_village_km",
                    models.DecimalField(blank=True, decimal_places=1, max_digits=5, null=True),
                ),
                (
                    "other_detail",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Précision quand « Autre » est choisi.",
                        max_length=200,
                    ),
                ),
                (
                    "evidence",
                    models.CharField(
                        choices=[
                            ("declared", "Déclaré par le producteur"),
                            ("observed", "Constaté par l'agent"),
                            ("measured", "Mesuré ou analysé"),
                        ],
                        max_length=32,
                    ),
                ),
                ("observed_on", models.DateField()),
                ("notes", models.TextField(blank=True, default="")),
            ],
            options={
                "verbose_name": "profil de site de parcelle",
                "verbose_name_plural": "profils de site de parcelles",
                "db_table": "parcels_site_profile",
            },
        ),
        migrations.RemoveConstraint(
            model_name="parcelownership",
            name="ownership_tenure_valid",
        ),
        migrations.AddField(
            model_name="parceloperatorassignment",
            name="agreement_end_date",
            field=models.DateField(blank=True, help_text="Fin de l'accord, si connue.", null=True),
        ),
        migrations.AddField(
            model_name="parceloperatorassignment",
            name="harvest_share_percent",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True),
        ),
        migrations.AddField(
            model_name="parceloperatorassignment",
            name="rent_amount_xof",
            field=models.PositiveIntegerField(
                blank=True, help_text="Loyer en FCFA par campagne (en argent).", null=True
            ),
        ),
        migrations.AddField(
            model_name="parceloperatorassignment",
            name="rent_type",
            field=models.CharField(
                blank=True,
                choices=[
                    ("cash", "En argent"),
                    ("harvest_share", "Part de la récolte"),
                    ("in_kind", "En nature"),
                    ("free", "Gratuit"),
                    ("unknown", "Ne sait pas"),
                ],
                default="",
                max_length=32,
            ),
        ),
        migrations.AlterField(
            model_name="parcelownership",
            name="tenure_type",
            field=models.CharField(
                choices=[
                    ("titled_property", "Titre foncier"),
                    ("communal_allocation", "Affectation communale (domaine national)"),
                    ("customary_right", "Droit coutumier"),
                    ("family_land", "Terre familiale"),
                    ("lease", "Bail"),
                    ("communal", "Terre communautaire"),
                    ("other", "Autre"),
                    ("unknown", "Inconnu"),
                ],
                max_length=32,
            ),
        ),
        migrations.AddConstraint(
            model_name="parceloperatorassignment",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("rent_type__in", ["", "cash", "harvest_share", "in_kind", "free", "unknown"])
                ),
                name="operator_rent_type_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="parceloperatorassignment",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("harvest_share_percent__isnull", True),
                    models.Q(("harvest_share_percent__gt", 0), ("harvest_share_percent__lte", 100)),
                    _connector="OR",
                ),
                name="operator_harvest_share_range",
            ),
        ),
        migrations.AddConstraint(
            model_name="parcelownership",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    (
                        "tenure_type__in",
                        [
                            "titled_property",
                            "communal_allocation",
                            "customary_right",
                            "family_land",
                            "lease",
                            "communal",
                            "other",
                            "unknown",
                        ],
                    )
                ),
                name="ownership_tenure_valid",
            ),
        ),
        migrations.AddField(
            model_name="parcelsiteprofile",
            name="created_by",
            field=models.ForeignKey(
                blank=True,
                editable=False,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="parcelsiteprofile",
            name="parcel",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="site_profiles",
                to="parcels.parcel",
            ),
        ),
        migrations.AddField(
            model_name="parcelsiteprofile",
            name="recorded_by_organization",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="+",
                to="organizations.organization",
            ),
        ),
        migrations.AddField(
            model_name="parcelsiteprofile",
            name="recorded_by_producer",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="+",
                to="actors.producer",
            ),
        ),
        migrations.AddField(
            model_name="parcelsiteprofile",
            name="updated_by",
            field=models.ForeignKey(
                blank=True,
                editable=False,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddIndex(
            model_name="parcelsiteprofile",
            index=models.Index(fields=["parcel", "-created_at"], name="site_parcel_recent_idx"),
        ),
        migrations.AddConstraint(
            model_name="parcelsiteprofile",
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
                name="site_one_recorder",
            ),
        ),
        migrations.AddConstraint(
            model_name="parcelsiteprofile",
            constraint=models.CheckConstraint(
                condition=models.Q(("evidence__in", ["declared", "observed", "measured"])),
                name="site_evidence_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="parcelsiteprofile",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("distance_to_village_km__isnull", True),
                    models.Q(
                        ("distance_to_village_km__gte", 0), ("distance_to_village_km__lte", 500)
                    ),
                    _connector="OR",
                ),
                name="site_distance_range",
            ),
        ),
        migrations.AddConstraint(
            model_name="parcelsiteprofile",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    (
                        "soil_local_type__in",
                        [
                            "",
                            "hollalde",
                            "fonde",
                            "falo",
                            "dieri",
                            "dior",
                            "deck",
                            "deck_dior",
                            "other",
                            "unknown",
                        ],
                    )
                ),
                name="site_soil_local_type_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="parcelsiteprofile",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    (
                        "soil_texture__in",
                        ["", "sandy", "sandy_loam", "loam", "clay_loam", "clay", "unknown"],
                    )
                ),
                name="site_soil_texture_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="parcelsiteprofile",
            constraint=models.CheckConstraint(
                condition=models.Q(("salinity__in", ["", "none", "slight", "strong", "unknown"])),
                name="site_salinity_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="parcelsiteprofile",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("flooding__in", ["", "never", "rainy_season", "prolonged", "unknown"])
                ),
                name="site_flooding_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="parcelsiteprofile",
            constraint=models.CheckConstraint(
                condition=models.Q(("slope__in", ["", "flat", "gentle", "steep", "unknown"])),
                name="site_slope_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="parcelsiteprofile",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("perceived_fertility__in", ["", "good", "medium", "poor", "unknown"])
                ),
                name="site_perceived_fertility_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="parcelsiteprofile",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    (
                        "water_regime__in",
                        ["", "rainfed", "irrigated", "flood_recession", "mixed", "unknown"],
                    )
                ),
                name="site_water_regime_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="parcelsiteprofile",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    (
                        "water_source__in",
                        [
                            "",
                            "river_canal",
                            "borehole",
                            "well",
                            "pond",
                            "network",
                            "other",
                            "unknown",
                        ],
                    )
                ),
                name="site_water_source_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="parcelsiteprofile",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    (
                        "irrigation_method__in",
                        [
                            "",
                            "gravity",
                            "pump_gravity",
                            "sprinkler",
                            "drip",
                            "manual",
                            "none",
                            "unknown",
                        ],
                    )
                ),
                name="site_irrigation_method_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="parcelsiteprofile",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("scheme_type__in", ["", "saed_large", "piv", "private", "none", "unknown"])
                ),
                name="site_scheme_type_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="parcelsiteprofile",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    (
                        "pump_access__in",
                        ["", "individual", "collective", "rented", "none", "unknown"],
                    )
                ),
                name="site_pump_access_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="parcelsiteprofile",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("water_availability__in", ["", "year_round", "seasonal", "unknown"])
                ),
                name="site_water_availability_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="parcelsiteprofile",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("road_access__in", ["", "all_season", "dry_season", "unknown"])
                ),
                name="site_road_access_valid",
            ),
        ),
        migrations.RunSQL(HISTORY_SQL, HISTORY_REVERSE_SQL),
    ]
