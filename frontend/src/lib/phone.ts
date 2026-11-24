/**
 * Saisie du numéro de téléphone (Web OS et app terrain, même code).
 *
 * L'API attend un numéro international E.164 (+221771234567). L'écran propose un pays
 * (Sénégal par défaut) et la saisie du numéro national ; un numéro tapé avec son indicatif
 * (+33…, 0033…) est pris tel quel. Le « 0 » national initial (06…, 07…) est retiré.
 */
import { COUNTRIES, type Country } from "./countries";

const SEPARATORS = /[\s.\-()]/g;
export const DEFAULT_COUNTRY = "SN";

export function findCountry(iso: string | null | undefined): Country {
  return COUNTRIES.find((c) => c.iso === iso) ?? (COUNTRIES[0] as Country);
}

/** Drapeau en émoji à partir du code ISO (sur Windows, les lettres s'affichent à la place). */
export function flag(iso: string): string {
  return iso
    .toUpperCase()
    .replace(/[A-Z]/g, (ch) => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65));
}

/** Numéro national (ou international) + pays → E.164. */
export function toInternationalPhone(input: string, countryIso: string = DEFAULT_COUNTRY): string {
  const cleaned = input.trim().replace(SEPARATORS, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return `+${cleaned.slice(2)}`;
  const country = findCountry(countryIso);
  if (cleaned.startsWith(country.dial) && country.length && cleaned.length === country.dial.length + country.length) {
    return `+${cleaned}`;
  }
  const national = country.dial !== "39" ? cleaned.replace(/^0+/, "") : cleaned; // Italie : le 0 fait partie du numéro
  return `+${country.dial}${national}`;
}

/** Pays d'un numéro E.164 (indicatif le plus long qui correspond) et numéro national. */
export function splitPhone(e164: string): { country: Country; national: string } {
  const digits = (e164 || "").replace(/^\+/, "");
  let best: Country | null = null;
  for (const c of COUNTRIES) {
    if (digits.startsWith(c.dial) && (!best || c.dial.length > best.dial.length)) best = c;
  }
  if (!best) return { country: findCountry(DEFAULT_COUNTRY), national: digits };
  // Indicatifs partagés (+1, +7…) : le premier pays de la liste porte la valeur par défaut.
  return { country: best, national: digits.slice(best.dial.length) };
}

/** Indication de saisie : « 9 chiffres » ou rien si la longueur varie. */
export function lengthHint(country: Country, national: string): string | null {
  const digits = national.replace(/\D/g, "").replace(/^0+/, "");
  if (!country.length || !digits || national.trim().startsWith("+")) return null;
  return digits.length === country.length ? null : `${country.length} chiffres attendus pour ${country.name}`;
}

/** Affichage lisible : +221 78 436 35 37 pour le Sénégal, sinon indicatif séparé. */
export function formatPhone(e164: string): string {
  const m = /^\+221(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  if (m) return `+221 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  if (!e164?.startsWith("+")) return e164;
  const { country, national } = splitPhone(e164);
  return national ? `+${country.dial} ${national}` : e164;
}
