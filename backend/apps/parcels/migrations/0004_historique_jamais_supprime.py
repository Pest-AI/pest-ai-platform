"""Historique foncier jamais supprimé (F-09, F-13), garanti par PostgreSQL.

Propriétés, exploitants, liens aux organisations, accès personnels et unités de culture :
une relation se clôt (date de fin) ou s'archive, elle ne se supprime pas.
"""

from django.db import migrations

TABLES = [
    "parcels_ownership",
    "parcels_operator_assignment",
    "parcels_organization_link",
    "parcels_producer_access",
    "parcels_cultivation_unit",
]

SQL = (
    "\n".join(
        f"CREATE TRIGGER {table}_no_delete BEFORE DELETE ON {table} "
        "FOR EACH ROW EXECUTE FUNCTION parcels_forbid_delete();"
        for table in TABLES
    )
    + """
ALTER TABLE parcels_cultivation_unit
    ADD CONSTRAINT unit_geometry_valid CHECK (geometry IS NULL OR ST_IsValid(geometry));
"""
)

REVERSE_SQL = (
    "ALTER TABLE parcels_cultivation_unit DROP CONSTRAINT IF EXISTS unit_geometry_valid;\n"
    + "\n".join(f"DROP TRIGGER IF EXISTS {table}_no_delete ON {table};" for table in TABLES)
)


class Migration(migrations.Migration):
    dependencies = [("parcels", "0003_relations_foncieres")]

    operations = [migrations.RunSQL(SQL, REVERSE_SQL)]
