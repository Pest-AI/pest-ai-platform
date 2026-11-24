"""J18c : identifiant producteur PEST AI (PRD-SN-XXXXXXXX) et données du ménage.

Les producteurs existants reçoivent leur identifiant ici (ajout de données, rien n'est
modifié ni supprimé). PostgreSQL interdit ensuite toute modification de l'identifiant.
"""

import secrets

from django.conf import settings
from django.db import migrations, models

ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def attribuer_identifiants(apps, schema_editor):
    Producer = apps.get_model("actors", "Producer")
    used = set(
        Producer.objects.exclude(producer_code__isnull=True).values_list("producer_code", flat=True)
    )
    for producer in Producer.objects.filter(producer_code__isnull=True).select_related(
        "registered_by_organization"
    ):
        country = getattr(producer.registered_by_organization, "country_code", None) or "SN"
        while True:
            code = f"PRD-{country}-" + "".join(secrets.choice(ALPHABET) for _ in range(8))
            if code not in used:
                break
        used.add(code)
        Producer.objects.filter(pk=producer.pk).update(producer_code=code)


IMMUABLE_SQL = """
CREATE FUNCTION actors_producer_code_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.producer_code IS DISTINCT FROM NEW.producer_code THEN
        RAISE EXCEPTION 'PEST AI : un identifiant producteur ne change jamais (%)', OLD.producer_code
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER producer_code_immutable BEFORE UPDATE OF producer_code ON actors_producer
    FOR EACH ROW EXECUTE FUNCTION actors_producer_code_immutable();
"""
IMMUABLE_REVERSE_SQL = """
DROP TRIGGER IF EXISTS producer_code_immutable ON actors_producer;
DROP FUNCTION IF EXISTS actors_producer_code_immutable();
"""


class Migration(migrations.Migration):

    dependencies = [
        ("actors", "0001_initial"),
        ("organizations", "0002_numeros_adherent"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="producer",
            name="household_farm_workers",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="producer",
            name="household_size",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="producer",
            name="producer_code",
            field=models.CharField(max_length=15, null=True, editable=False),
        ),
        migrations.RunPython(attribuer_identifiants, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="producer",
            name="producer_code",
            field=models.CharField(
                blank=True,
                editable=False,
                help_text="Identifiant producteur PEST AI (PRD-SN-XXXXXXXX), permanent.",
                max_length=15,
                unique=True,
            ),
        ),
        migrations.AddConstraint(
            model_name="producer",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("producer_code__regex", "^PRD-[A-Z]{2}-[0-9A-HJKMNP-TV-Z]{8}$")
                ),
                name="producer_code_format",
            ),
        ),
        migrations.AddConstraint(
            model_name="producer",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("household_size__isnull", True),
                    models.Q(("household_size__gte", 1), ("household_size__lte", 200)),
                    _connector="OR",
                ),
                name="producer_household_size_range",
            ),
        ),
        migrations.AddConstraint(
            model_name="producer",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("household_farm_workers__isnull", True),
                    ("household_size__isnull", True),
                    ("household_farm_workers__lte", models.F("household_size")),
                    _connector="OR",
                ),
                name="producer_household_workers_le_size",
            ),
        ),
        migrations.RunSQL(IMMUABLE_SQL, IMMUABLE_REVERSE_SQL),
    ]
