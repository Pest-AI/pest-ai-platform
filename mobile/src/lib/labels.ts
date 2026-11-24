/** Libellés affichés (mêmes que le Web OS). */
export const TYPE_LABELS: Record<string, string> = {
  cooperative: "Coopérative",
  ngo: "ONG",
  program: "Programme",
  agribusiness: "Agro-entreprise",
};

export const ROLE_LABELS: Record<string, string> = {
  organization_admin: "Administrateur",
  cooperative_manager: "Gérant",
  field_agent: "Agent terrain",
  agronomist: "Agronome",
  producer: "Producteur",
  program_manager: "Gestionnaire de programme",
};

export const SEX_LABELS: Record<string, string> = { female: "Femme", male: "Homme", unspecified: "Non précisé" };
export const LANGUAGE_LABELS: Record<string, string> = { fr: "Français", wo: "Wolof", ff: "Pulaar" };
export const RELATIONSHIP_LABELS: Record<string, string> = {
  member: "Membre",
  beneficiary: "Bénéficiaire",
  client: "Client",
};

export function roleLabel(roles: readonly string[]) {
  const first = roles[0];
  return first ? (ROLE_LABELS[first] ?? first) : "Membre";
}
