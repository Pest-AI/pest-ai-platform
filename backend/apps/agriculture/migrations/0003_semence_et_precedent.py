"""J18d : origine de la semence, mode d'implantation, précédent cultural. Ajouts seulement."""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("actors", "0003_section_du_membre"),
        ("agriculture", "0002_garanties_et_cultures"),
        ("organizations", "0002_numeros_adherent"),
        ("parcels", "0009_profil_site_et_conditions"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="cropcycle",
            name="planting_method",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="cropcycle",
            name="previous_crop",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="+",
                to="agriculture.crop",
            ),
        ),
        migrations.AddField(
            model_name="cropcycle",
            name="previous_fallow",
            field=models.BooleanField(
                default=False, help_text="La saison précédente, la parcelle était en jachère."
            ),
        ),
        migrations.AddField(
            model_name="cropcycle",
            name="seed_source",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddConstraint(
            model_name="cropcycle",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    (
                        "seed_source__in",
                        [
                            "",
                            "certified_purchased",
                            "farm_saved",
                            "program",
                            "local_market",
                            "other",
                            "unknown",
                        ],
                    )
                ),
                name="crop_cycle_seed_source_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="cropcycle",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("planting_method__in", ["", "direct_sowing", "transplanting", "unknown"])
                ),
                name="crop_cycle_planting_method_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="cropcycle",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("previous_crop__isnull", True), ("previous_fallow", False), _connector="OR"
                ),
                name="crop_cycle_previous_crop_or_fallow",
            ),
        ),
    ]
