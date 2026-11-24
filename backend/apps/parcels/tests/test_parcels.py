"""Tests du J11 : AgroID (F-08, D-05) et géométries versionnées (MVP-34, MVP-35)."""

from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction

from apps.organizations import services as org_services
from apps.parcels import agroid, selectors, services
from apps.parcels.models import CaptureMethod, Parcel, ParcelGeometry, ParcelStatus

pytestmark = pytest.mark.django_db

# Carré d'environ 100 m × 100 m près de Podor (longitude, latitude).
LON, LAT = -14.96, 16.65
D_LON, D_LAT = 0.000937, 0.000904


def square(lon=LON, lat=LAT, dlon=D_LON, dlat=D_LAT):
    return {
        "type": "Polygon",
        "coordinates": [
            [[lon, lat], [lon + dlon, lat], [lon + dlon, lat + dlat], [lon, lat + dlat], [lon, lat]]
        ],
    }


@pytest.fixture
def org(user):
    return org_services.create_organization(
        created_by=user, name="Coopérative de test", organization_type="cooperative"
    )


@pytest.fixture
def parcel(user, org):
    return services.create_parcel(
        by=user, organization=org, local_name="Champ du fleuve", geometry=square()
    )


# ── AgroID ───────────────────────────────────────────────────────────────


def test_format_et_alphabet():
    for _ in range(500):
        value = agroid.generate()
        assert agroid.is_valid(value)
        assert value.startswith("PAI-SN-")
        assert not set(value[7:]) & set("ILOU")


def test_tirages_differents():
    assert len({agroid.generate() for _ in range(2000)}) == 2000


@pytest.mark.parametrize(
    ("saisie", "attendu"),
    [
        ("PAI-SN-7K4M9X2Q", "PAI-SN-7K4M9X2Q"),
        ("pai-sn-7k4m9x2q", "PAI-SN-7K4M9X2Q"),
        ("PAI SN 7K4M 9X2Q", "PAI-SN-7K4M9X2Q"),
        ("PAISN7K4M9X2Q", "PAI-SN-7K4M9X2Q"),
        ("PAI-SN-7K4M9X2O", "PAI-SN-7K4M9X20"),  # O lu comme 0
        ("PAI-SN-IK4M9X2Q", "PAI-SN-1K4M9X2Q"),  # I lu comme 1
        ("PAI-SN-7K4M9X2", None),
        ("PAI-SN-7K4M9X2U", None),  # U n'existe pas dans l'alphabet
        ("bonjour", None),
        ("", None),
    ],
)
def test_normalisation_de_la_saisie(saisie, attendu):
    assert agroid.normalize(saisie) == attendu


def test_creation_en_ligne_attribue_l_agroid(parcel):
    assert agroid.is_valid(parcel.agroid)
    assert parcel.agroid_assigned_at is not None
    assert parcel.status == ParcelStatus.ACTIVE
    assert str(parcel.id) != parcel.agroid  # distinct de l'UUID


def test_brouillon_hors_ligne_sans_agroid_puis_attribution(user, org):
    draft = services.create_parcel(by=user, organization=org, draft=True)
    assert draft.agroid is None
    assert draft.status == ParcelStatus.DRAFT
    done = services.assign_agroid(draft, by=user)
    assert agroid.is_valid(done.agroid)
    assert done.status == ParcelStatus.ACTIVE
    # Attribuer une seconde fois ne change rien.
    assert services.assign_agroid(done, by=user).agroid == done.agroid


def test_collision_nouveau_tirage(user, org, parcel, monkeypatch):
    taken = parcel.agroid
    draws = iter([taken, taken, "PAI-SN-ZZZZZZZZ"])
    monkeypatch.setattr(agroid, "generate", lambda country="SN": next(draws))
    other = services.create_parcel(by=user, organization=org)
    assert other.agroid == "PAI-SN-ZZZZZZZZ"


def test_un_agroid_retire_n_est_jamais_redonne(user, org, parcel, monkeypatch):
    retired = services.retire_parcel(parcel, by=user, reason="Parcelle fusionnée")
    assert retired.status == ParcelStatus.RETIRED
    assert retired.is_archived
    assert retired.agroid == parcel.agroid  # conservé
    draws = iter([parcel.agroid, "PAI-SN-YYYYYYYY"])
    monkeypatch.setattr(agroid, "generate", lambda country="SN": next(draws))
    other = services.create_parcel(by=user, organization=org)
    assert other.agroid == "PAI-SN-YYYYYYYY"


def test_agroid_epuise(user, org, parcel, monkeypatch):
    monkeypatch.setattr(agroid, "generate", lambda country="SN": parcel.agroid)
    with pytest.raises(services.AgroIDUnavailableError):
        services.create_parcel(by=user, organization=org)


def test_agroid_immuable_dans_le_code(parcel):
    parcel.agroid = "PAI-SN-0000000A"
    with pytest.raises(ValidationError):
        parcel.save()


def test_agroid_immuable_dans_la_base(parcel):
    with (
        pytest.raises(Exception, match="AgroID"),
        transaction.atomic(),
        connection.cursor() as cursor,
    ):
        cursor.execute(
            "UPDATE parcels_parcel SET agroid = 'PAI-SN-0000000A' WHERE id = %s", [parcel.id]
        )


def test_parcelle_jamais_supprimee(parcel):
    with pytest.raises(ValidationError):
        parcel.delete()
    with (
        pytest.raises(Exception, match="suppression interdite"),
        transaction.atomic(),
        connection.cursor() as cursor,
    ):
        cursor.execute("DELETE FROM parcels_parcel WHERE id = %s", [parcel.id])


@pytest.mark.parametrize(
    "bad", ["PAI-SN-ABC", "PAI-SN-IIIIIIII", "XYZ-SN-7K4M9X2Q", "pai-sn-7k4m9x2q"]
)
def test_format_refuse_par_la_base(user, org, bad):
    draft = services.create_parcel(by=user, organization=org, draft=True)
    with pytest.raises(IntegrityError), transaction.atomic():
        Parcel.objects.filter(pk=draft.pk).update(agroid=bad)


def test_parcelle_active_sans_agroid_refusee(org):
    with pytest.raises(IntegrityError), transaction.atomic():
        Parcel.objects.create(
            registration_channel="organization", registered_by_organization=org, status="active"
        )


def test_origine_unique_et_coherente(user, org):
    with pytest.raises(ValidationError):
        services.create_parcel(by=user)
    with pytest.raises(IntegrityError), transaction.atomic():
        Parcel.objects.create(registration_channel="producer_self", registered_by_organization=org)


def test_recherche_par_agroid(parcel):
    assert selectors.by_agroid(parcel.agroid.lower().replace("-", " ")) == parcel
    assert selectors.by_agroid("PAI-SN-00000000") is None
    assert selectors.by_agroid("n'importe quoi") is None


def test_brouillon_retire_refuse(user, org):
    draft = services.create_parcel(by=user, organization=org, draft=True)
    with pytest.raises(ValidationError):
        services.retire_parcel(draft, by=user, reason="Erreur")


def test_retrait_motif_obligatoire(user, parcel):
    with pytest.raises(ValidationError):
        services.retire_parcel(parcel, by=user, reason=" ")


# ── Géométries versionnées ───────────────────────────────────────────────


def test_version_1_mesuree(parcel):
    geom = selectors.current_geometry(parcel)
    assert geom.version == 1
    assert geom.is_current and geom.valid_from and geom.valid_to is None
    assert geom.geometry.geom_type == "MultiPolygon"  # Polygon reçu, MultiPolygon stocké
    assert geom.geometry.srid == 4326
    assert Decimal("9000") < geom.area_m2 < Decimal("11000")  # ≈ 1 ha
    assert Decimal("380") < geom.perimeter_m < Decimal("420")
    assert geom.geometry.contains(geom.centroid)
    parcel.refresh_from_db()
    assert parcel.current_area_m2 == geom.area_m2
    assert parcel.centroid.equals(geom.centroid)


def test_nouvelle_version_conserve_l_historique(user, parcel):
    v1 = selectors.current_geometry(parcel)
    v2 = services.add_geometry(
        parcel,
        square(dlon=2 * D_LON),
        by=user,
        capture_method=CaptureMethod.GPS_WALK,
        gps_accuracy_m=4,
    )
    v1.refresh_from_db()
    assert v2.version == 2 and v2.is_current
    assert not v1.is_current and v1.valid_to is not None
    assert [g.version for g in selectors.geometry_history(parcel)] == [2, 1]
    parcel.refresh_from_db()
    assert parcel.current_area_m2 == v2.area_m2 > v1.area_m2
    assert parcel.agroid  # l'identité ne bouge pas quand la forme change


def test_une_seule_version_courante_en_base(user, parcel):
    v1 = selectors.current_geometry(parcel)
    with pytest.raises(IntegrityError), transaction.atomic():
        ParcelGeometry.objects.create(
            parcel=parcel,
            version=2,
            geometry=v1.geometry,
            area_m2=v1.area_m2,
            perimeter_m=v1.perimeter_m,
            centroid=v1.centroid,
            capture_method="manual_drawing",
            captured_by=user,
            captured_at=v1.captured_at,
            is_current=True,
        )


def test_contour_d_une_version_immuable(parcel):
    v1 = selectors.current_geometry(parcel)
    v1.area_m2 = Decimal("1.00")
    with pytest.raises(ValidationError):
        v1.save()
    with (
        pytest.raises(Exception, match="géométrie"),
        transaction.atomic(),
        connection.cursor() as cursor,
    ):
        cursor.execute(
            "UPDATE parcels_parcel_geometry SET geometry = ST_Multi(ST_Buffer(geometry, 0.001))"
            " WHERE id = %s",
            [v1.id],
        )


def test_version_jamais_supprimee(parcel):
    v1 = selectors.current_geometry(parcel)
    with pytest.raises(ValidationError):
        v1.delete()
    with (
        pytest.raises(Exception, match="suppression interdite"),
        transaction.atomic(),
        connection.cursor() as cursor,
    ):
        cursor.execute("DELETE FROM parcels_parcel_geometry WHERE id = %s", [v1.id])


def test_validation_peut_evoluer(user, parcel):
    """Le statut de contrôle (J12) se met à jour sans toucher au contour."""
    v1 = selectors.current_geometry(parcel)
    v1.validation_status = "valid"
    v1.validated_by = user
    v1.save(update_fields=["validation_status", "validated_by", "updated_at"])
    v1.refresh_from_db()
    assert v1.validation_status == "valid"


@pytest.mark.parametrize(
    ("geometry", "message"),
    [
        ({"type": "Point", "coordinates": [LON, LAT]}, "Polygon"),
        ({"type": "Polygon", "coordinates": "abc"}, "invalides"),
        (square(lon=LAT, lat=LON * 10), "hors limites"),
        (
            {  # nœud papillon : côtés qui se croisent
                "type": "Polygon",
                "coordinates": [
                    [
                        [LON, LAT],
                        [LON + D_LON, LAT + D_LAT],
                        [LON + D_LON, LAT],
                        [LON, LAT + D_LAT],
                        [LON, LAT],
                    ]
                ],
            },
            "invalide",
        ),
        ("{pas du json", "illisible"),
    ],
)
def test_contours_refuses(user, org, geometry, message):
    with pytest.raises(ValidationError, match=message):
        services.create_parcel(by=user, organization=org, geometry=geometry)
    assert not Parcel.objects.exists()  # rien n'est créé à moitié


def test_feature_et_multipolygon_acceptes(user, org):
    feature = {"type": "Feature", "properties": {}, "geometry": square()}
    p1 = services.create_parcel(by=user, organization=org, geometry=feature)
    multi = {
        "type": "MultiPolygon",
        "coordinates": [square()["coordinates"], square(lon=LON + 0.01)["coordinates"]],
    }
    p2 = services.create_parcel(by=user, organization=org, geometry=multi)
    assert selectors.current_geometry(p1).geometry.num_geom == 1
    assert selectors.current_geometry(p2).geometry.num_geom == 2


def test_parcelle_retiree_contour_fige(user, parcel):
    services.retire_parcel(parcel, by=user, reason="Disparue")
    with pytest.raises(ValidationError):
        services.add_geometry(parcel, square(), by=user)


def test_row_version_augmente(user, parcel):
    before = Parcel.objects.get(pk=parcel.pk).row_version
    services.add_geometry(parcel, square(dlat=2 * D_LAT), by=user)
    assert Parcel.objects.get(pk=parcel.pk).row_version > before
