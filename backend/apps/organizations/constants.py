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

# Matrice initiale proposée (à valider) : rôle -> permissions.
ROLE_PERMISSIONS = {
    SUPER_ADMIN: ["platform.organizations.view", "platform.organizations.manage"],
    ORGANIZATION_ADMIN: [
        "organization.view",
        "organization.manage",
        "memberships.view",
        "memberships.manage",
        "roles.assign",
    ],
    COOPERATIVE_MANAGER: ["organization.view", "memberships.view"],
    FIELD_AGENT: ["organization.view"],
    AGRONOMIST: ["organization.view"],
    PRODUCER: ["organization.view"],
    PROGRAM_MANAGER: ["organization.view"],
}
