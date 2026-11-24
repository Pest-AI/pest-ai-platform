"""Garanties tenues par PostgreSQL lui-même, quel que soit le code qui écrit (F-08, D-05).

- Une parcelle n'est jamais supprimée et son AgroID, une fois attribué, ne change jamais :
  un AgroID ne peut donc jamais être réattribué à une autre parcelle.
- Une version de géométrie n'est jamais supprimée et son contour ne change jamais.
- Contour valide (ST_IsValid) en WGS 84 (SRID 4326).
"""

from django.db import migrations

SQL = """
CREATE FUNCTION parcels_forbid_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'PEST AI : suppression interdite sur % (archivage uniquement)', TG_TABLE_NAME
        USING ERRCODE = 'restrict_violation';
END $$;

CREATE FUNCTION parcels_agroid_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.agroid IS NOT NULL AND NEW.agroid IS DISTINCT FROM OLD.agroid THEN
        RAISE EXCEPTION 'PEST AI : un AgroID attribué ne change jamais (%)', OLD.agroid
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END $$;

CREATE FUNCTION parcels_geometry_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.parcel_id IS DISTINCT FROM OLD.parcel_id
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NOT ST_Equals(NEW.geometry, OLD.geometry)
       OR NEW.area_m2 IS DISTINCT FROM OLD.area_m2
       OR NEW.captured_by_id IS DISTINCT FROM OLD.captured_by_id
       OR NEW.captured_at IS DISTINCT FROM OLD.captured_at THEN
        RAISE EXCEPTION 'PEST AI : une version de géométrie ne se modifie pas, créez-en une nouvelle'
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER parcel_no_delete BEFORE DELETE ON parcels_parcel
    FOR EACH ROW EXECUTE FUNCTION parcels_forbid_delete();
CREATE TRIGGER parcel_agroid_immutable BEFORE UPDATE OF agroid ON parcels_parcel
    FOR EACH ROW EXECUTE FUNCTION parcels_agroid_immutable();
CREATE TRIGGER parcel_geometry_no_delete BEFORE DELETE ON parcels_parcel_geometry
    FOR EACH ROW EXECUTE FUNCTION parcels_forbid_delete();
CREATE TRIGGER parcel_geometry_append_only BEFORE UPDATE ON parcels_parcel_geometry
    FOR EACH ROW EXECUTE FUNCTION parcels_geometry_append_only();

ALTER TABLE parcels_parcel_geometry
    ADD CONSTRAINT parcel_geom_is_valid CHECK (ST_IsValid(geometry)),
    ADD CONSTRAINT parcel_geom_srid CHECK (ST_SRID(geometry) = 4326);
"""

REVERSE_SQL = """
ALTER TABLE parcels_parcel_geometry
    DROP CONSTRAINT IF EXISTS parcel_geom_is_valid,
    DROP CONSTRAINT IF EXISTS parcel_geom_srid;
DROP TRIGGER IF EXISTS parcel_geometry_append_only ON parcels_parcel_geometry;
DROP TRIGGER IF EXISTS parcel_geometry_no_delete ON parcels_parcel_geometry;
DROP TRIGGER IF EXISTS parcel_agroid_immutable ON parcels_parcel;
DROP TRIGGER IF EXISTS parcel_no_delete ON parcels_parcel;
DROP FUNCTION IF EXISTS parcels_geometry_append_only();
DROP FUNCTION IF EXISTS parcels_agroid_immutable();
DROP FUNCTION IF EXISTS parcels_forbid_delete();
"""


class Migration(migrations.Migration):
    dependencies = [("parcels", "0001_initial")]

    operations = [migrations.RunSQL(SQL, REVERSE_SQL)]
