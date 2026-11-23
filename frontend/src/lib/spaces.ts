/** Espaces applicatifs du Web OS selon les rôles (ADR-0004). */
export type SpaceKey = "admin" | "cooperative" | "agronome" | "ong";

export const SPACES: Record<SpaceKey, { label: string; description: string }> = {
  admin: { label: "Console Admin PEST AI", description: "Administration de la plateforme" },
  cooperative: { label: "Espace Coopérative", description: "Membres, producteurs, parcelles, campagnes" },
  agronome: { label: "Espace Agronome", description: "Observations et validation des diagnostics" },
  ong: { label: "Espace ONG", description: "Programmes et indicateurs agrégés" },
};

const ROLE_TO_SPACE: Record<string, SpaceKey> = {
  organization_admin: "cooperative",
  cooperative_manager: "cooperative",
  agronomist: "agronome",
  program_manager: "ong",
};

/** Espaces accessibles pour une liste de rôles d'organisation (sans doublon, ordre stable). */
export function spacesForRoles(roles: readonly string[]): SpaceKey[] {
  const order: SpaceKey[] = ["cooperative", "agronome", "ong"];
  const found = new Set(roles.map((r) => ROLE_TO_SPACE[r]).filter(Boolean));
  return order.filter((key) => found.has(key));
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  organization_admin: "Administrateur",
  cooperative_manager: "Gestionnaire",
  field_agent: "Agent de terrain",
  agronomist: "Agronome",
  producer: "Producteur",
  program_manager: "Responsable de programme",
};

export const ORGANIZATION_TYPE_LABELS: Record<string, string> = {
  cooperative: "Coopérative",
  union: "Union",
  ngo: "ONG",
  company: "Entreprise",
  institution: "Institution",
  public_agency: "Agence publique",
  pest_ai: "PEST AI",
};
