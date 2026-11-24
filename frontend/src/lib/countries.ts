/**
 * Pays, indicatifs et longueur des numéros mobiles nationaux.
 * Généré par scripts/generate-countries.py (libphonenumber + CLDR) : ne pas modifier à la main.
 * Afrique de l'Ouest seulement (Mauritanie comprise) : Sénégal, voisins, puis les autres pays.
 */
/** keepZero : le 0 initial fait partie du numéro national (Côte d'Ivoire, Bénin). */
export type Country = { iso: string; name: string; dial: string; length: number | null; keepZero: boolean };

export const COUNTRIES: Country[] = [
  { iso: "SN", name: "Sénégal", dial: "221", length: 9, keepZero: false },
  { iso: "ML", name: "Mali", dial: "223", length: 8, keepZero: false },
  { iso: "MR", name: "Mauritanie", dial: "222", length: 8, keepZero: false },
  { iso: "GM", name: "Gambie", dial: "220", length: 7, keepZero: false },
  { iso: "GN", name: "Guinée", dial: "224", length: 9, keepZero: false },
  { iso: "GW", name: "Guinée-Bissau", dial: "245", length: 9, keepZero: false },
  { iso: "CI", name: "Côte d’Ivoire", dial: "225", length: 10, keepZero: true },
  { iso: "BF", name: "Burkina Faso", dial: "226", length: 8, keepZero: false },
  { iso: "NE", name: "Niger", dial: "227", length: 8, keepZero: false },
  { iso: "TG", name: "Togo", dial: "228", length: 8, keepZero: false },
  { iso: "BJ", name: "Bénin", dial: "229", length: 10, keepZero: true },
  { iso: "NG", name: "Nigeria", dial: "234", length: 10, keepZero: false },
  { iso: "GH", name: "Ghana", dial: "233", length: 9, keepZero: false },
  { iso: "CV", name: "Cap-Vert", dial: "238", length: 7, keepZero: false },
  { iso: "SL", name: "Sierra Leone", dial: "232", length: 8, keepZero: false },
  { iso: "LR", name: "Liberia", dial: "231", length: 9, keepZero: false },
];
