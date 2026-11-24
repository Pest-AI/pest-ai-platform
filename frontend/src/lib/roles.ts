/**
 * Rôles qu'un gérant ou un administrateur peut attribuer dans une organisation. Les agents
 * terrain n'y figurent pas : PEST AI les recrute et les affecte (console d'administration).
 */
export const PLATFORM_MANAGED_ROLES = ["field_agent"];
export const ASSIGNABLE_ROLES: { code: string; label: string; description: string; adminOnly?: boolean }[] = [
  {
    code: "organization_admin",
    label: "Administrateur d'organisation",
    description: "Tous les droits sur l'organisation, y compris nommer d'autres administrateurs.",
    adminOnly: true,
  },
  {
    code: "cooperative_manager",
    label: "Gérant de coopérative",
    description: "Gère l'équipe, les producteurs, les parcelles et les campagnes.",
  },
  {
    code: "agronomist",
    label: "Agronome",
    description: "Valide les diagnostics et les conseils agronomiques.",
  },
  {
    code: "program_manager",
    label: "Gestionnaire de programme",
    description: "Suit les indicateurs d'un programme (ONG, bailleur).",
  },
];

/** Adhésion gérée par PEST AI (agent terrain) : la coopérative la voit sans la modifier. */
export function managedByPestAi(roles: readonly string[]): boolean {
  return roles.some((r) => PLATFORM_MANAGED_ROLES.includes(r));
}

/** Droits de gestion de l'équipe selon les rôles de l'utilisateur dans l'organisation active. */
export function teamRights(roles: readonly string[]) {
  const isAdmin = roles.includes("organization_admin");
  const canManage = isAdmin || roles.includes("cooperative_manager");
  return { isAdmin, canManage };
}
