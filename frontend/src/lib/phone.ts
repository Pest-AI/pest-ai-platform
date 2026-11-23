/**
 * Saisie du numéro de téléphone sur le Web OS.
 *
 * L'API attend un numéro international E.164 (+221771234567). Sur l'écran de connexion,
 * l'indicatif +221 est affiché : un numéro sénégalais à 9 chiffres saisi sans indicatif
 * est donc complété automatiquement. Un numéro étranger se saisit avec son indicatif.
 */
const SEPARATORS = /[\s.\-()]/g;
const SENEGAL_LOCAL = /^[37]\d{8}$/;

export function toInternationalPhone(input: string): string {
  const cleaned = input.trim().replace(SEPARATORS, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return `+${cleaned.slice(2)}`;
  if (cleaned.startsWith("221") && cleaned.length === 12) return `+${cleaned}`;
  if (SENEGAL_LOCAL.test(cleaned)) return `+221${cleaned}`;
  return cleaned;
}
