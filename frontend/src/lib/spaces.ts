/** Libellés et règles d'affichage des espaces de travail du Web OS (ADR-0004). */
export type SpaceKey = "admin" | "cooperative" | "agronome" | "ong";

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

/** Libellés affichés des 7 rôles système (Design System, section « Ton et contenu »). */
export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super-admin",
  organization_admin: "Administrateur d'organisation",
  cooperative_manager: "Gérant de coopérative",
  field_agent: "Agent terrain",
  agronomist: "Agronome",
  producer: "Producteur",
  program_manager: "Gestionnaire de programme",
};

const ROLE_PRIORITY = [
  "organization_admin",
  "cooperative_manager",
  "program_manager",
  "agronomist",
  "field_agent",
  "producer",
];

/** Rôle principal à afficher (le plus élevé), ou « Membre » sans rôle. */
export function primaryRoleLabel(roles: readonly string[]): string {
  const top = ROLE_PRIORITY.find((r) => roles.includes(r));
  return (top && ROLE_LABELS[top]) || "Membre";
}

export const ORGANIZATION_TYPE_LABELS: Record<string, string> = {
  cooperative: "Coopérative",
  union: "Union",
  ngo: "ONG",
  company: "Entreprise",
  institution: "Institution",
  public_agency: "Agence publique",
  pest_ai: "PEST AI",
};

export const ORGANIZATION_STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  active: { label: "Active", tone: "success" },
  pending: { label: "En attente", tone: "warning" },
  suspended: { label: "Suspendue", tone: "danger" },
  closed: { label: "Fermée", tone: "neutral" },
};

/** Initiales d'une organisation : « Coopérative agricole de Ross Béthio » → « RB ». */
export function organizationInitials(name: string): string {
  const stop = new Set(["de", "des", "du", "la", "le", "les", "et", "d", "l", "coopérative", "cooperative", "agricole", "union", "gie"]);
  const words = name
    .split(/[\s'’-]+/)
    .filter(Boolean)
    .filter((w) => !stop.has(w.toLowerCase()));
  const pick = (words.length ? words : name.split(/\s+/)).slice(0, 2);
  return pick.map((w) => w.charAt(0).toUpperCase()).join("") || "?";
}

/** Date courte française : 23/11/2026. */
export function formatDate(iso: string): string {
  // Une date seule (« 2026-11-23 ») est lue en UTC pour ne jamais glisser d'un jour.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(dateOnly ? { timeZone: "UTC" } : {}),
  }).format(new Date(iso));
}

/** Nombre de dates (arrivées dans l'organisation) comprises dans les `days` derniers jours. */
export function countSince(dates: (string | null | undefined)[], days: number, now: number = Date.now()): number {
  const from = now - days * 24 * 3600 * 1000;
  return dates.filter((d) => d && Date.parse(d) >= from && Date.parse(d) <= now).length;
}
