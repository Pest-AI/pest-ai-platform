"""Tests du J12 : règles foncières et accès (MVP-37), contrôle des contours (MVP-36)."""

import datetime

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction

from apps.actors import services as actor_services
from apps.parcels import selectors, services
from apps.parcels.models import (
    AccessBasis,
    AccessLevel,
    CultivationUnit,
    LinkStatus,
    ParcelOperatorAssignment,
    ParcelOwnership,
    ParcelStatus,
)
from apps.parcels.tests.test_parcels import D_LAT, D_LON, LAT, LON, square

pytestmark = pytest.mark.django_db

D1 = datetime.date(2024, 1, 1)
D2 = datetime.date(2025, 6, 1)


@pytest.fixture
def org(make_org):
    return make_org("Coopérative de Guédé")


@pytest.fixture
def other_org(make_org):
    return make_org("Union de Podor")


@pytest.fixture
def farmer(org, user):
    return actor_services.register_producer(
        organization=org,
        registered_by=user,
        first_name="Moussa",
        last_name="Sow",
        locality_text="Guédé",
    )


@pytest.fixture
def independent(make_user):
    """Producteur indépendant (cas B) avec son compte."""
    account = make_user(phone_number="+221770001111")
    return actor_services.create_personal_profile(user=account, first_name="Fatou", last_name="Ba")


@pytest.fixture
def parcel(user, org):
    return services.create_parcel(by=user, organization=org, geometry=square())


@pytest.fixture
def personal_parcel(independent):
    return services.create_parcel(
        by=independent.user, producer=independent, geometry=square(lon=LON + 0.05)
    )


# ── Visibilité : liens et accès ──────────────────────────────────────────


def test_parcelle_d_organisation_visible_par_elle_seule(parcel, org, other_org):
    assert list(selectors.visible_parcels(org)) == [parcel]
    assert not selectors.visible_parcels(other_org).exists()
    link = parcel.organization_links.get()
    assert link.link_type == "registering" and link.status == LinkStatus.ACTIVE


def test_parcelle_declaree_par_le_producteur(personal_parcel, independent, org):
    access = selectors.personal_access(independent, personal_parcel)
    assert access.access_level == AccessLevel.MANAGE
    assert access.basis == AccessBasis.SELF_REGISTERED
    assert list(selectors.personal_parcels(independent)) == [personal_parcel]
    assert not selectors.visible_parcels(org).exists()  # aucune organisation ne la voit


def test_producteur_sans_compte_ne_declare_pas(user, farmer):
    with pytest.raises(ValidationError):
        services.create_parcel(by=user, producer=farmer, geometry=square())


def test_lien_vers_parcelle_personnelle_attend_l_accord(personal_parcel, org, user, independent):
    link = services.request_organization_link(personal_parcel, org, by=user)
    assert link.status == LinkStatus.PENDING_PRODUCER_CONSENT
    assert not selectors.visible_parcels(org).exists()  # aucun accès avant l'accord
    assert list(selectors.pending_link_requests(independent)) == [link]
    with pytest.raises(ValidationError):  # un autre que le producteur ne peut pas accepter
        services.consent_organization_link(link, by=user)
    link = services.consent_organization_link(link, by=independent.user)
    assert link.status == LinkStatus.ACTIVE and link.consented_by == independent.user
    assert list(selectors.visible_parcels(org)) == [personal_parcel]


def test_refus_du_producteur(personal_parcel, org, user, independent):
    link = services.request_organization_link(personal_parcel, org, by=user)
    link = services.decline_organization_link(link, by=independent.user)
    assert link.status == LinkStatus.ENDED and link.end_date
    assert not selectors.visible_parcels(org).exists()
    # Une nouvelle demande reste possible plus tard (historique conservé).
    again = services.request_organization_link(personal_parcel, org, by=user)
    assert again.status == LinkStatus.PENDING_PRODUCER_CONSENT
    assert personal_parcel.organization_links.count() == 2


def test_lien_d_accompagnement_sur_parcelle_d_organisation(parcel, other_org, user):
    link = services.request_organization_link(parcel, other_org, by=user)
    assert link.status == LinkStatus.ACTIVE
    assert parcel in selectors.visible_parcels(other_org)
    with pytest.raises(ValidationError):
        services.request_organization_link(parcel, other_org, by=user)
    services.end_organization_link(link, by=user)
    assert parcel not in selectors.visible_parcels(other_org)


def test_acces_personnel_accorde_par_l_organisation(parcel, org, other_org, user, independent):
    with pytest.raises(ValidationError):  # une organisation qui ne suit pas la parcelle
        services.grant_personal_access(parcel, independent, organization=other_org, by=user)
    access = services.grant_personal_access(parcel, independent, organization=org, by=user)
    assert access.access_level == AccessLevel.VIEW
    assert access.basis == AccessBasis.GRANTED_BY_ORGANIZATION
    assert parcel in selectors.personal_parcels(independent)
    with pytest.raises(ValidationError):
        services.grant_personal_access(parcel, independent, organization=org, by=user)
    with pytest.raises(ValidationError):
        services.revoke_personal_access(access, by=user, reason="")
    services.revoke_personal_access(access, by=user, reason="Erreur de producteur")
    assert parcel not in selectors.personal_parcels(independent)


def test_producteur_sans_compte_n_a_pas_d_acces_personnel(parcel, org, user, farmer):
    with pytest.raises(ValidationError):
        services.grant_personal_access(parcel, farmer, organization=org, by=user)


def test_propriete_et_exploitation_n_ouvrent_aucun_acces(parcel, org, user, independent):
    services.record_ownership(
        parcel,
        by=user,
        tenure_type="customary_right",
        start_date=D1,
        owner_producer=independent,
        recorded_by_organization=org,
    )
    services.assign_operator(
        parcel, independent, by=user, role="primary", start_date=D1, recorded_by_organization=org
    )
    assert not selectors.personal_parcels(independent).exists()


def test_acces_par_revendication_reserve(parcel, org, user, independent):
    with pytest.raises(IntegrityError), transaction.atomic():
        parcel.personal_accesses.create(
            producer=independent,
            access_level="view",
            basis="granted_by_organization",
            granted_by=user,
            start_date=D1,
        )  # sans organisation : refusé par la base


# ── Propriété (D-07) ─────────────────────────────────────────────────────


def test_proprietaire_non_enregistre_par_son_nom(parcel, org, user):
    own = services.record_ownership(
        parcel,
        by=user,
        tenure_type="family_land",
        start_date=D1,
        owner_name="Famille Diallo",
        recorded_by_organization=org,
    )
    assert own.verification_status == "declared"
    assert list(selectors.current_owners(parcel)) == [own]


@pytest.mark.parametrize(
    "owners",
    [{}, {"owner_name": "A", "owner_organization": "ORG"}],
)
def test_un_seul_proprietaire_par_ligne(parcel, org, user, owners):
    if owners.get("owner_organization"):
        owners["owner_organization"] = org
    with pytest.raises(ValidationError):
        services.record_ownership(
            parcel,
            by=user,
            tenure_type="unknown",
            start_date=D1,
            recorded_by_organization=org,
            **owners,
        )


def test_un_seul_proprietaire_aussi_en_base(parcel, org):
    with pytest.raises(IntegrityError), transaction.atomic():
        ParcelOwnership.objects.create(
            parcel=parcel,
            tenure_type="unknown",
            start_date=D1,
            owner_name="A",
            owner_organization=org,
            recorded_by_organization=org,
        )


def test_changement_de_proprietaire_conserve_l_historique(parcel, org, user, independent):
    old = services.record_ownership(
        parcel,
        by=user,
        tenure_type="family_land",
        start_date=D1,
        owner_name="Famille Diallo",
        recorded_by_organization=org,
    )
    services.end_ownership(old, end_date=D2, by=user)
    new = services.record_ownership(
        parcel,
        by=user,
        tenure_type="titled_property",
        start_date=D2,
        owner_producer=independent,
        recorded_by_organization=org,
    )
    assert list(selectors.current_owners(parcel)) == [new]
    assert parcel.ownerships.count() == 2
    with pytest.raises(ValidationError):
        services.end_ownership(old, end_date=D2, by=user)  # déjà close


def test_propriete_jamais_reecrite(parcel, org, user):
    own = services.record_ownership(
        parcel,
        by=user,
        tenure_type="family_land",
        start_date=D1,
        owner_name="Famille Diallo",
        recorded_by_organization=org,
    )
    own.owner_name = "Autre nom"
    with pytest.raises(ValidationError):
        own.save()
    own.refresh_from_db()
    assert own.owner_name == "Famille Diallo"
    services.set_ownership_verification(own, status="disputed", by=user)
    own.refresh_from_db()
    assert own.verification_status == "disputed"


def test_declaration_du_producteur_reste_declaree(personal_parcel, independent):
    with pytest.raises(ValidationError):
        services.record_ownership(
            personal_parcel,
            by=independent.user,
            tenure_type="customary_right",
            start_date=D1,
            owner_producer=independent,
            recorded_by_producer=independent,
            verification_status="documented",
        )
    own = services.record_ownership(
        personal_parcel,
        by=independent.user,
        tenure_type="customary_right",
        start_date=D1,
        owner_producer=independent,
        recorded_by_producer=independent,
    )
    with pytest.raises(ValidationError):
        services.set_ownership_verification(own, status="documented", by=independent.user)


def test_date_de_fin_coherente(parcel, org, user):
    own = services.record_ownership(
        parcel,
        by=user,
        tenure_type="lease",
        start_date=D2,
        owner_name="X",
        recorded_by_organization=org,
    )
    with pytest.raises(ValidationError):
        services.end_ownership(own, end_date=D1, by=user)


# ── Exploitation (D-06) ──────────────────────────────────────────────────


def test_un_seul_exploitant_principal(parcel, org, user, farmer, independent):
    first = services.assign_operator(
        parcel, farmer, by=user, role="primary", start_date=D1, recorded_by_organization=org
    )
    assert first.verification_status == "confirmed_by_organization"
    with pytest.raises(ValidationError):
        services.assign_operator(
            parcel,
            independent,
            by=user,
            role="primary",
            start_date=D2,
            recorded_by_organization=org,
        )
    co = services.assign_operator(
        parcel,
        independent,
        by=user,
        role="co_operator",
        start_date=D2,
        recorded_by_organization=org,
    )
    assert {a.id for a in selectors.current_operators(parcel)} == {first.id, co.id}


def test_un_seul_principal_aussi_en_base(parcel, org, user, farmer, independent):
    services.assign_operator(
        parcel, farmer, by=user, role="primary", start_date=D1, recorded_by_organization=org
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        ParcelOperatorAssignment.objects.create(
            parcel=parcel,
            producer=independent,
            operator_role="primary",
            start_date=D2,
            recorded_by_organization=org,
        )


def test_remplacer_l_exploitant_principal(parcel, org, user, farmer, independent):
    first = services.assign_operator(
        parcel, farmer, by=user, role="primary", start_date=D1, recorded_by_organization=org
    )
    second = services.assign_operator(
        parcel,
        independent,
        by=user,
        role="primary",
        start_date=D2,
        recorded_by_organization=org,
        replace_primary=True,
    )
    first.refresh_from_db()
    assert first.end_date == D2
    assert list(selectors.current_operators(parcel)) == [second]
    assert parcel.operators.count() == 2  # historique gardé


def test_exploitant_declare_par_le_producteur_jamais_confirme_par_lui(personal_parcel, independent):
    a = services.assign_operator(
        personal_parcel,
        independent,
        by=independent.user,
        role="primary",
        start_date=D1,
        recorded_by_producer=independent,
    )
    assert a.verification_status == "declared"
    a.verification_status = "confirmed_by_organization"
    with pytest.raises(IntegrityError), transaction.atomic():
        a.save()


def test_historique_jamais_supprime(parcel, org, user, farmer):
    a = services.assign_operator(
        parcel, farmer, by=user, role="primary", start_date=D1, recorded_by_organization=org
    )
    for table, row_id in [
        ("parcels_operator_assignment", a.id),
        ("parcels_organization_link", parcel.organization_links.get().id),
    ]:
        with (
            pytest.raises(Exception, match="suppression interdite"),
            transaction.atomic(),
            connection.cursor() as c,
        ):
            c.execute(f"DELETE FROM {table} WHERE id = %s", [row_id])  # noqa: S608


# ── Unités de culture (D-16) ─────────────────────────────────────────────


def test_unites_de_culture(parcel, user):
    u1 = services.create_cultivation_unit(parcel, by=user, code="u1", name="Riz", area_m2=4000)
    assert u1.code == "U1"
    with pytest.raises(ValidationError):
        services.create_cultivation_unit(parcel, by=user, code="U1")
    services.retire_cultivation_unit(u1, by=user, reason="Fusion avec U2")
    u1.refresh_from_db()
    assert u1.status == "retired" and u1.is_archived and u1.valid_to
    assert CultivationUnit.objects.filter(parcel=parcel).count() == 1  # gardée


# ── Contrôle des contours (D-19) ─────────────────────────────────────────


def test_contour_normal_valide(parcel):
    v1 = selectors.current_geometry(parcel)
    assert v1.validation_status == "valid"
    assert v1.validation_report["flags"] == []
    assert v1.validation_report["thresholds"]["MAX_OVERLAP_PERCENT"] == 5.0
    assert parcel.status == ParcelStatus.ACTIVE


@pytest.mark.parametrize(
    ("geometry", "accuracy", "flag"),
    [
        (square(dlon=D_LON / 20, dlat=D_LAT / 20), None, "area_too_small"),  # ≈ 25 m²
        (square(dlon=D_LON * 80, dlat=D_LAT * 80), None, "area_too_large"),  # ≈ 64 ha
        (square(), 25, "gps_accuracy_low"),
    ],
)
def test_contours_signales(user, org, geometry, accuracy, flag):
    p = services.create_parcel(
        by=user, organization=org, geometry=geometry, gps_accuracy_m=accuracy
    )
    v1 = selectors.current_geometry(p)
    assert v1.validation_status == "flagged"
    assert flag in v1.validation_report["flags"]
    p.refresh_from_db()
    assert p.status == ParcelStatus.PENDING_VALIDATION  # signalée, pas bloquée
    assert p.agroid  # l'identité est attribuée quand même


def test_chevauchement_signale(user, org, parcel):
    shifted = square(lon=LON + D_LON / 2)  # moitié sur la parcelle existante
    other = services.create_parcel(by=user, organization=org, geometry=shifted)
    report = selectors.current_geometry(other).validation_report
    assert "overlap" in report["flags"]
    hit = report["overlaps"][0]
    assert hit["parcel_id"] == str(parcel.id)
    assert 45 < hit["percent"] < 55


def test_simple_contact_ou_petit_chevauchement_toleres(user, org, parcel):
    touching = services.create_parcel(by=user, organization=org, geometry=square(lon=LON + D_LON))
    assert selectors.current_geometry(touching).validation_status == "valid"
    slight = services.create_parcel(
        by=user, organization=org, geometry=square(lon=LON - D_LON + D_LON / 50, lat=LAT + 0.01)
    )
    assert selectors.current_geometry(slight).validation_status == "valid"


def test_parcelle_retiree_ne_compte_plus(user, org, parcel):
    services.retire_parcel(parcel, by=user, reason="Disparue")
    again = services.create_parcel(by=user, organization=org, geometry=square())
    assert selectors.current_geometry(again).validation_status == "valid"


def test_seuils_parametrables(user, org, settings):
    settings.PARCEL_GEOMETRY_RULES = {**settings.PARCEL_GEOMETRY_RULES, "MIN_AREA_M2": 20_000}
    p = services.create_parcel(by=user, organization=org, geometry=square())
    assert "area_too_small" in selectors.current_geometry(p).validation_report["flags"]


def test_revue_humaine(user, org):
    p = services.create_parcel(by=user, organization=org, geometry=square(), gps_accuracy_m=30)
    v1 = selectors.current_geometry(p)
    with pytest.raises(ValidationError):
        services.review_geometry(v1, decision="rejected", by=user)  # motif obligatoire
    services.review_geometry(v1, decision="valid", by=user, note="Vérifié sur place")
    v1.refresh_from_db()
    p.refresh_from_db()
    assert v1.validation_status == "valid" and v1.validated_by == user
    assert v1.validation_report["review"]["note"] == "Vérifié sur place"
    assert p.status == ParcelStatus.ACTIVE
    with pytest.raises(ValidationError):
        services.review_geometry(v1, decision="rejected", by=user, note="Trop tard")


def test_contour_refuse_puis_nouveau_contour(user, org):
    p = services.create_parcel(by=user, organization=org, geometry=square(), gps_accuracy_m=30)
    services.review_geometry(
        selectors.current_geometry(p), decision="rejected", by=user, note="Faux"
    )
    p.refresh_from_db()
    assert p.status == ParcelStatus.PENDING_VALIDATION
    services.add_geometry(p, square(), by=user, gps_accuracy_m=3)
    p.refresh_from_db()
    assert p.status == ParcelStatus.ACTIVE
    assert [g.validation_status for g in selectors.geometry_history(p)] == ["valid", "rejected"]


def test_brouillon_signale_reste_en_attente_apres_attribution(user, org):
    draft = services.create_parcel(
        by=user, organization=org, geometry=square(), gps_accuracy_m=50, draft=True
    )
    assert draft.status == ParcelStatus.DRAFT
    done = services.assign_agroid(draft, by=user)
    assert done.status == ParcelStatus.PENDING_VALIDATION
