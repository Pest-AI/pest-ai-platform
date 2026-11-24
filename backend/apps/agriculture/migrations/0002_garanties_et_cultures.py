"""Garanties PostgreSQL (Design v2.2, T-01) et référentiel des 5 cultures du MVP.

- Clés étrangères composites d'espace : un cycle ne cite qu'une campagne du même espace ;
  une opération ou une récolte ne cite qu'un cycle du même espace.
- Unité de culture d'un cycle : forcément une unité de la parcelle du cycle.
- Espace immuable (trigger commun) sur les 4 tables SPACE ; un cycle n'est jamais supprimé.
- Cultures : riz, oignon, tomate, maïs, piment (is_ai_supported). Noms en wolof et en pulaar
  laissés vides : à renseigner par l'équipe agronomique.
"""

from django.db import migrations

from apps.core.models import space_foreign_key_sql, space_trigger_sql

SPACE_TABLES = (
    "agriculture_campaign",
    "agriculture_crop_cycle",
    "agriculture_operation",
    "agriculture_harvest",
)
SAME_SPACE = (
    ("agriculture_crop_cycle", "campaign_id", "agriculture_campaign"),
    ("agriculture_operation", "crop_cycle_id", "agriculture_crop_cycle"),
    ("agriculture_harvest", "crop_cycle_id", "agriculture_crop_cycle"),
)

UNIT_OF_PARCEL = (
    "ALTER TABLE agriculture_crop_cycle ADD CONSTRAINT agriculture_crop_cycle_unit_of_parcel "
    "FOREIGN KEY (cultivation_unit_id, parcel_id) "
    "REFERENCES parcels_cultivation_unit (id, parcel_id);",
    "ALTER TABLE agriculture_crop_cycle DROP CONSTRAINT IF EXISTS "
    "agriculture_crop_cycle_unit_of_parcel;",
)

NO_DELETE = (
    """
    CREATE OR REPLACE FUNCTION agriculture_forbid_delete() RETURNS trigger AS $$
    BEGIN
        RAISE EXCEPTION 'Suppression interdite sur % : archivez l''enregistrement.', TG_TABLE_NAME
            USING ERRCODE = 'integrity_constraint_violation';
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER agriculture_crop_cycle_no_delete BEFORE DELETE ON agriculture_crop_cycle
        FOR EACH ROW EXECUTE FUNCTION agriculture_forbid_delete();
    CREATE TRIGGER agriculture_harvest_no_delete BEFORE DELETE ON agriculture_harvest
        FOR EACH ROW EXECUTE FUNCTION agriculture_forbid_delete();
    """,
    """
    DROP TRIGGER IF EXISTS agriculture_crop_cycle_no_delete ON agriculture_crop_cycle;
    DROP TRIGGER IF EXISTS agriculture_harvest_no_delete ON agriculture_harvest;
    DROP FUNCTION IF EXISTS agriculture_forbid_delete();
    """,
)

CROPS = [
    ("rice", "Riz", "Oryza sativa"),
    ("onion", "Oignon", "Allium cepa"),
    ("tomato", "Tomate", "Solanum lycopersicum"),
    ("maize", "Maïs", "Zea mays"),
    ("chili", "Piment", "Capsicum spp."),
]


def load_crops(apps, schema_editor):
    Crop = apps.get_model("agriculture", "Crop")
    for code, name, scientific in CROPS:
        Crop.objects.update_or_create(
            code=code,
            defaults={"name_fr": name, "scientific_name": scientific, "is_ai_supported": True},
        )


class Migration(migrations.Migration):
    dependencies = [
        ("agriculture", "0001_initial"),
        ("parcels", "0008_unite_cible_cycle"),
    ]

    operations = [
        *[migrations.RunSQL(*space_foreign_key_sql(*args)) for args in SAME_SPACE],
        migrations.RunSQL(*UNIT_OF_PARCEL),
        *[migrations.RunSQL(*space_trigger_sql(table)) for table in SPACE_TABLES],
        migrations.RunSQL(*NO_DELETE),
        migrations.RunPython(load_crops, migrations.RunPython.noop),
    ]
