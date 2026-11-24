/**
 * AgroID côté app : même règle de saisie tolérante que le serveur (apps/parcels/agroid.py),
 * pour chercher dans le cache hors ligne : « pai sn 7k4m 9x2o » → « PAI-SN-7K4M9X20 ».
 */
const PATTERN = /^PAI-[A-Z]{2}-[0-9A-HJKMNP-TV-Z]{8}$/;

export function normalizeAgroid(value: string): string | null {
  const compact = (value ?? "").toUpperCase().replace(/[\s\-_.]/g, "");
  if (compact.length !== 13 || !compact.startsWith("PAI")) return null;
  const code = compact.slice(5).replace(/[IL]/g, "1").replace(/O/g, "0");
  const candidate = `PAI-${compact.slice(3, 5)}-${code}`;
  return PATTERN.test(candidate) ? candidate : null;
}

/** Recherche dans le cache : AgroID exact (saisie tolérée) ou morceau d'AgroID, de nom, d'exploitant. */
export function matchesParcel(
  query: string,
  parcel: { agroid: string | null; local_name: string; operator_name?: string | null },
): boolean {
  const q = query.trim();
  if (!q) return true;
  const exact = normalizeAgroid(q);
  if (exact) return parcel.agroid === exact;
  const needle = q.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const hay = [parcel.agroid ?? "", parcel.local_name, parcel.operator_name ?? ""]
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return hay.includes(needle) || hay.replace(/-/g, "").includes(needle.replace(/[\s-]/g, ""));
}
