"""Référentiel des rôles et permissions.

Les SEPT rôles sont ceux validés par le fondateur (Database Design v2.2, 9.2) :
aucun autre rôle ne peut exister (contrainte CHECK en base).

Le catalogue de permissions ci-dessous ne couvre que le domaine Identité &
organisations. La v2.2 fixe le format « domaine.action » et les portées, mais
pas la matrice complète rôle × permission : ce catalogue est une PROPOSITION
technique à valider par le fondateur. Les autres domaines ajouteront leurs
permissions dans leurs missions.
"""

SUPER_ADMIN = "super_admin"
ORGANIZATION_ADMIN = "organization_admin"
COOPERATIVE_MANAGER = "cooperative_manager"
FIELD_AGENT = "field_agent"
AGRONOMIST = "agronomist"
PRODUCER = "producer"
PROGRAM_MANAGER = "program_manager"

SCOPE_ORGANIZATION = "organization"
SCOPE_PLATFORM = "platform"
SCOPE_PERSONAL = "personal"

# (code, nom métier, portée, description)
SYSTEM_ROLES = [
    (
        SUPER_ADMIN,
        "Super Admin",
        SCOPE_PLATFORM,
        "Administration globale de la plateforme ; accès inter-organisations "
        "justifié, limité et tracé.",
    ),
    (
        ORGANIZATION_ADMIN,
        "Organization Admin",
        SCOPE_ORGANIZATION,
        "Gère l'organisation, ses membres et l'attribution des rôles d'organisation.",
    ),
    (
        COOPERATIVE_MANAGER,
        "Cooperative Manager",
        SCOPE_ORGANIZATION,
        "Gestion opérationnelle : producteurs, parcelles, campagnes, missions, "
        "supervision des agents.",
    ),
    (
        FIELD_AGENT,
        "Field Agent",
        SCOPE_ORGANIZATION,
        "Missions assignées, visites, parcelles, observations, synchronisation.",
    ),
    (
        AGRONOMIST,
        "Agronomist",
        SCOPE_ORGANIZATION,
        "Revue des diagnostics, validation des recommandations.",
    ),
    (
        PRODUCER,
        "Producer",
        SCOPE_ORGANIZATION,
        "Dans une organisation : ses parcelles, cycles et recommandations validées.",
    ),
    (
        PROGRAM_MANAGER,
        "Program Manager",
        SCOPE_ORGANIZATION,
        "Programmes de son organisation, bénéficiaires, indicateurs.",
    ),
]
ROLE_CODES = [code for code, *_ in SYSTEM_ROLES]
ORGANIZATION_ROLE_CODES = [
    code for code, _, scope, _ in SYSTEM_ROLES if scope == SCOPE_ORGANIZATION
]

# Catalogue initial (domaine identité & organisations) : (code, domaine, portée, description)
PERMISSIONS = [
    ("organization.view", "organizations", SCOPE_ORGANIZATION, "Consulter l'organisation active."),
    (
        "organization.manage",
        "organizations",
        SCOPE_ORGANIZATION,
        "Modifier les informations de l'organisation active.",
    ),
    (
        "memberships.view",
        "organizations",
        SCOPE_ORGANIZATION,
        "Consulter les membres de l'organisation active.",
    ),
    (
        "memberships.manage",
        "organizations",
        SCOPE_ORGANIZATION,
        "Inviter, suspendre, réactiver ou révoquer des membres.",
    ),
    (
        "roles.assign",
        "organizations",
        SCOPE_ORGANIZATION,
        "Attribuer ou retirer des rôles d'organisation.",
    ),
    # Domaine Producteurs (J9)
    (
        "producers.view",
        "actors",
        SCOPE_ORGANIZATION,
        "Consulter les producteurs rattachés à l'organisation.",
    ),
    (
        "producers.create",
        "actors",
        SCOPE_ORGANIZATION,
        "Enregistrer un producteur ou rattacher une fiche existante à l'organisation.",
    ),
    (
        "producers.manage",
        "actors",
        SCOPE_ORGANIZATION,
        "Modifier un producteur, ses contacts et clore son rattachement.",
    ),
    # Domaine Parcelles (J13)
    (
        "parcels.view",
        "parcels",
        SCOPE_ORGANIZATION,
        "Consulter les parcelles suivies par l'organisation.",
    ),
    (
        "parcels.create",
        "parcels",
        SCOPE_ORGANIZATION,
        "Enregistrer une parcelle et relever un nouveau contour.",
    ),
    (
        "parcels.manage",
        "parcels",
        SCOPE_ORGANIZATION,
        "Propriétaires, exploitants, unités de culture, retrait et demandes de suivi.",
    ),
    (
        "parcels.validate_geometry",
        "parcels",
        SCOPE_ORGANIZATION,
        "Confirmer ou refuser un contour signalé (D-19).",
    ),
    (
        "parcels.grant_personal_access",
        "parcels",
        SCOPE_ORGANIZATION,
        "Ouvrir à un producteur l'accès à une parcelle dans son espace personnel (D-02).",
    ),
    (
        "platform.organizations.view",
        "platform",
        SCOPE_PLATFORM,
        "Consulter toutes les organisations.",
    ),
    (
        "platform.organizations.manage",
        "platform",
        SCOPE_PLATFORM,
        "Créer, activer, suspendre ou archiver une organisation.",
    ),
]

# Permissions de portée personal (décision D-11) : accordées par un profil Producer actif
# (espace « personal »), JAMAIS par un rôle. Les conditions détaillées de chaque permission
# (accès à la parcelle, consentement…) sont vérifiées par les fonctionnalités concernées.
# Agriculture (J16) : campagnes, cycles, opérations, récoltes. Proposition à valider.
PERMISSIONS += [
    ("campaigns.view", "agriculture", SCOPE_ORGANIZATION, "Consulter les campagnes agricoles."),
    (
        "campaigns.manage",
        "agriculture",
        SCOPE_ORGANIZATION,
        "Créer, modifier et clôturer les campagnes.",
    ),
    (
        "crop_cycles.view",
        "agriculture",
        SCOPE_ORGANIZATION,
        "Consulter cycles, opérations et récoltes.",
    ),
    (
        "crop_cycles.manage",
        "agriculture",
        SCOPE_ORGANIZATION,
        "Enregistrer et modifier cycles, opérations et récoltes.",
    ),
    ("crop_cycles.confirm", "agriculture", SCOPE_ORGANIZATION, "Confirmer la culture d'un cycle."),
]

PERSONAL_PERMISSIONS = [
    ("personal.parcels.register", "Enregistrer une parcelle dans son espace personnel."),
    ("personal.parcels.view", "Consulter une parcelle accessible et son historique."),
    ("personal.parcels.manage", "Modifier une parcelle accessible en gestion."),
    (
        "personal.parcels.consent_link",
        "Accepter ou refuser le suivi de sa parcelle par une organisation.",
    ),
    ("personal.crop_cycles.manage", "Gérer ses campagnes, cycles, opérations et récoltes."),
    ("personal.observations.create", "Enregistrer des observations et des photos."),
    ("personal.diagnostics.request", "Demander un diagnostic IA (consentement explicite)."),
    ("personal.diagnostics.view", "Consulter ses diagnostics validés."),
    ("personal.workspace.sync", "Synchroniser son espace personnel hors ligne."),
]
PERSONAL_PERMISSION_CODES = [code for code, _ in PERSONAL_PERMISSIONS]
PERMISSIONS += [
    (code, "personal", SCOPE_PERSONAL, description) for code, description in PERSONAL_PERMISSIONS
]

# Matrice rôle -> permissions. Validé par le fondateur le 23/11/2026 : le gérant de
# coopérative invite et gère les rôles comme l'administrateur, sans jamais pouvoir nommer
# ni modifier un administrateur d'organisation (contrôle dans les vues des adhésions).
# Le reste de la matrice reste une proposition technique à valider.
# Parcelles : administrateur et gérant ont tous les droits (D-02 : seuls eux accordent
# l'accès personnel). Proposition J13, à valider par le fondateur.
PARCEL_MANAGERS = [
    "parcels.view",
    "parcels.create",
    "parcels.manage",
    "parcels.validate_geometry",
    "parcels.grant_personal_access",
]

# Agriculture (proposition J16, à valider) : administrateur et gérant ont tous les droits ;
# l'agent terrain suit cycles, opérations et récoltes ; l'agronome confirme la culture ;
# le responsable de programme consulte.
AGRICULTURE_MANAGERS = [
    "campaigns.view",
    "campaigns.manage",
    "crop_cycles.view",
    "crop_cycles.manage",
    "crop_cycles.confirm",
]
AGRICULTURE_READERS = ["campaigns.view", "crop_cycles.view"]

ROLE_PERMISSIONS = {
    SUPER_ADMIN: ["platform.organizations.view", "platform.organizations.manage"],
    ORGANIZATION_ADMIN: [
        "organization.view",
        "organization.manage",
        "memberships.view",
        "memberships.manage",
        "roles.assign",
        "producers.view",
        "producers.create",
        "producers.manage",
        *PARCEL_MANAGERS,
        *AGRICULTURE_MANAGERS,
    ],
    COOPERATIVE_MANAGER: [
        "organization.view",
        "memberships.view",
        "memberships.manage",
        "roles.assign",
        "producers.view",
        "producers.create",
        "producers.manage",
        *PARCEL_MANAGERS,
        *AGRICULTURE_MANAGERS,
    ],
    # L'agent terrain enregistre producteurs et parcelles sur le terrain (proposition, à valider).
    FIELD_AGENT: [
        "organization.view",
        "producers.view",
        "producers.create",
        "parcels.view",
        "parcels.create",
        *AGRICULTURE_READERS,
        "crop_cycles.manage",
    ],
    # L'agronome tranche les contours signalés (proposition J13, à valider).
    AGRONOMIST: [
        "organization.view",
        "producers.view",
        "parcels.view",
        "parcels.validate_geometry",
        *AGRICULTURE_READERS,
        "crop_cycles.confirm",
    ],
    PRODUCER: ["organization.view"],
    PROGRAM_MANAGER: [
        "organization.view",
        "producers.view",
        "parcels.view",
        *AGRICULTURE_READERS,
    ],
}
