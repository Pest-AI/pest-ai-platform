/**
 * Libellés et calculs du domaine Agriculture (J17, copie du Web OS pour l app terrain J19) : campagnes, cycles, opérations, récoltes.
 * Valeurs issues du Database Design v2.2 ; libellés des saisons (D-18) à relire par l'agronome.
 */
type Tone = "success" | "warning" | "danger" | "neutral";

export const SEASONS: Record<string, string> = {
  rainy: "Hivernage",
  cold_dry: "Contre-saison froide",
  hot_dry: "Contre-saison chaude",
  other: "Autre",
};

export const CAMPAIGN_STATUS: Record<string, { label: string; tone: Tone }> = {
  planned: { label: "Prévue", tone: "neutral" },
  active: { label: "En cours", tone: "success" },
  closed: { label: "Clôturée", tone: "neutral" },
};

export const CYCLE_STATUS: Record<string, { label: string; tone: Tone }> = {
  planned: { label: "Prévu", tone: "neutral" },
  in_progress: { label: "En cours", tone: "success" },
  harvested: { label: "Récolté", tone: "neutral" },
  abandoned: { label: "Abandonné", tone: "danger" },
};

/** Passages de statut proposés à l'écran (l'API applique les mêmes règles). */
export const CYCLE_NEXT: Record<string, { status: string; label: string }[]> = {
  planned: [
    { status: "in_progress", label: "Démarrer le cycle" },
    { status: "abandoned", label: "Abandonner" },
  ],
  in_progress: [
    { status: "harvested", label: "Marquer récolté" },
    { status: "abandoned", label: "Abandonner" },
  ],
  harvested: [],
  abandoned: [],
};

export const CAMPAIGN_NEXT: Record<string, { status: string; label: string }[]> = {
  planned: [
    { status: "active", label: "Ouvrir la campagne" },
    { status: "closed", label: "Clôturer" },
  ],
  active: [{ status: "closed", label: "Clôturer" }],
  closed: [],
};

export const OPERATION_TYPES: Record<string, string> = {
  land_preparation: "Préparation du sol",
  sowing: "Semis",
  transplanting: "Repiquage",
  irrigation: "Irrigation",
  fertilization: "Fertilisation",
  weeding: "Désherbage",
  phytosanitary_treatment: "Traitement phytosanitaire",
  other: "Autre",
};

export const SOURCES: Record<string, string> = {
  field_agent: "Agent de terrain",
  producer_declared: "Déclaré par le producteur",
  agronomist: "Agronome",
};

export const MEASUREMENT_METHODS: Record<string, string> = {
  declared: "Déclarée",
  weighed: "Pesée",
  estimated: "Estimée",
};

/** Date ISO (AAAA-MM-JJ) → « 12 nov. 2026 ». */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function campaignPeriod(start: string, end: string | null | undefined): string {
  return end ? `${shortDate(start)} → ${shortDate(end)}` : `depuis le ${shortDate(start)}`;
}

/** Quantité en kg lisible : « 3 200 kg », « 12,5 t ». */
export function formatKg(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n >= 10_000) return `${(n / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} t`;
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`;
}

/** Rendement en t/ha à partir des kg récoltés et de la surface en m² ; null si incalculable. */
export function yieldTHa(kg: number | string | null | undefined, areaM2: number | string | null | undefined): string | null {
  const k = Number(kg);
  const a = Number(areaM2);
  if (!Number.isFinite(k) || !Number.isFinite(a) || k <= 0 || a <= 0) return null;
  return `${((k / 1000) / (a / 10_000)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} t/ha`;
}

/** Date du jour (fuseau de Dakar = UTC) au format ISO, pour les champs date. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Origine de la semence (J18d, addendum v2.3 ; à valider par l'agronome). */
export const SEED_SOURCES: Record<string, string> = {
  certified_purchased: "Certifiée, achetée",
  farm_saved: "Ressemée (récolte précédente)",
  program: "Fournie par un programme",
  local_market: "Achetée au marché, non certifiée",
  other: "Autre",
  unknown: "Ne sait pas",
};

export const PLANTING_METHODS: Record<string, string> = {
  direct_sowing: "Semis direct",
  transplanting: "Repiquage",
  unknown: "Ne sait pas",
};

/** Champ « précédent cultural » d'un formulaire : « fallow » (jachère), un code de culture, ou vide. */
export function previousFromForm(value: string): { previous_crop: string | null; previous_fallow: boolean } {
  if (value === "fallow") return { previous_crop: null, previous_fallow: true };
  return { previous_crop: value || null, previous_fallow: false };
}
