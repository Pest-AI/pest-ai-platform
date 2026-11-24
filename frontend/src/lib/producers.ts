/** Libellés et petites règles d'affichage du registre des producteurs. */

export const SEX_LABELS: Record<string, string> = { female: "Femme", male: "Homme", unspecified: "Non précisé" };

export const LANGUAGE_LABELS: Record<string, string> = { fr: "Français", wo: "Wolof", ff: "Pulaar" };

export const RELATIONSHIP_LABELS: Record<string, string> = {
  member: "Membre",
  beneficiary: "Bénéficiaire",
  client: "Client",
};

export function producerInitials(first: string, last: string): string {
  return `${first.trim().charAt(0)}${last.trim().charAt(0)}`.toUpperCase() || "?";
}

/** Âge approximatif à partir de l'année de naissance (seule donnée conservée, D-08). */
export function approximateAge(birthYear: number | null | undefined, today = new Date()): number | null {
  if (!birthYear) return null;
  const age = today.getFullYear() - birthYear;
  return age >= 0 && age < 130 ? age : null;
}

/** Année de naissance saisie : nombre entier plausible, sinon null. */
export function parseBirthYear(value: string, today = new Date()): number | null {
  const n = Number(value.trim());
  if (!value.trim() || !Number.isInteger(n)) return null;
  return n >= 1900 && n <= today.getFullYear() ? n : null;
}

/** Effectif du ménage saisi : entier de 0 à 200, sinon null (vide : non renseigné). */
export function parseCount(value: string, min = 0): number | null {
  const n = Number(value.trim());
  if (!value.trim() || !Number.isInteger(n)) return null;
  return n >= min && n <= 200 ? n : null;
}
