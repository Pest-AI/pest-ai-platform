/**
 * Données terrain disponibles sans réseau (J20).
 *
 * - Parcelles et cycles : la fiche serveur (copie gardée), ou, pour un objet saisi hors ligne
 *   et pas encore envoyé (« @op:<uuid> »), une fiche reconstruite depuis la file d'envoi.
 * - Producteurs : copie de la liste de l'espace (recherche de l'exploitant hors ligne), plus les
 *   producteurs enrôlés hors ligne.
 * - Référentiels (cultures, campagnes) : dernière copie.
 */
import { NetworkError, type ApiClient } from "./api";
import { type Position } from "./geo";
import { cachedGet, cachedOnly, putCached } from "./offline-cache";
import { REF, findOp, isLocalRef, listOps, serverId, type OutboxOp } from "./outbox";
import { loadSnapshot } from "./parcel-cache";
import type { components } from "./schema";
import type { Paginated } from "./types";

type S = components["schemas"];

export type FieldUnit = { id: string; code: string; name: string; status: string; geometry: unknown; pending: boolean };
export type FieldParcel = {
  /** UUID serveur, ou « @op:<uuid> » pour une parcelle pas encore envoyée. */
  id: string;
  agroid: string | null;
  local_name: string;
  geometry: unknown;
  units: FieldUnit[];
  /** Pas encore envoyée : l'AgroID sera attribué à l'envoi. */
  pending: boolean;
  /** Fiche lue dans la copie du téléphone (pas de réseau). */
  offline: boolean;
};

function pendingUnits(ops: OutboxOp[], parcelRef: string): FieldUnit[] {
  return ops
    .filter((o) => o.entity_type === "cultivation_unit" && o.status === "pending" && o.params.parcel === parcelRef)
    .map((o, i) => ({
      id: `${REF}${o.id}`,
      code: `U?${i + 1}`,
      name: String(o.payload.name ?? ""),
      status: "active",
      geometry: o.payload.geometry ?? null,
      pending: true,
    }));
}

/** Parcelle pour les saisies terrain (unité, cycle, sol et eau), avec ou sans réseau. */
export async function loadFieldParcel(api: ApiClient, workspace: string, id: string): Promise<FieldParcel> {
  const ops = await listOps();
  let target = id;
  if (isLocalRef(id)) {
    const sent = await serverId(id);
    if (!sent) {
      const op = await findOp(id);
      if (!op) throw new Error("Parcelle introuvable sur ce téléphone.");
      return {
        id,
        agroid: null,
        local_name: String(op.payload.local_name ?? ""),
        geometry: op.payload.geometry ?? null,
        units: pendingUnits(ops, id),
        pending: true,
        offline: true,
      };
    }
    target = sent;
  }
  try {
    const { data, offline } = await cachedGet<S["ParcelDetail"]>(api, `/api/v1/parcels/${target}/`, { workspace });
    return {
      id: data.id,
      agroid: data.agroid,
      local_name: data.local_name,
      geometry: data.current_geometry?.geometry ?? null,
      units: [
        ...data.units.map((u) => ({ id: u.id, code: u.code, name: u.name, status: u.status, geometry: u.geometry, pending: false })),
        ...pendingUnits(ops, target),
      ],
      pending: false,
      offline,
    };
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // Jamais ouverte sur ce téléphone : la copie de la liste des parcelles suffit.
    const known = (await loadSnapshot(workspace))?.parcels.find((p) => p.id === target);
    if (!known) throw e;
    return {
      id: known.id,
      agroid: known.agroid,
      local_name: known.local_name,
      geometry: known.geometry,
      units: pendingUnits(ops, target),
      pending: false,
      offline: true,
    };
  }
}

/** Anneaux extérieurs d'un Polygon / MultiPolygon GeoJSON. */
export function rings(geometry: unknown): Position[][] {
  const g = geometry as { type?: string; coordinates?: unknown } | null;
  if (!g?.coordinates) return [];
  if (g.type === "Polygon") return [(g.coordinates as Position[][])[0] ?? []];
  if (g.type === "MultiPolygon") return (g.coordinates as Position[][][]).map((p) => p[0] ?? []);
  return [];
}

// ── Référentiels ────────────────────────────────────────────────────────

export async function loadCropReferentials(api: ApiClient, workspace: string) {
  const [crops, campaigns] = await Promise.all([
    cachedGet<S["Crop"][]>(api, "/api/v1/crops/", { workspace }),
    cachedGet<Paginated<S["Campaign"]>>(api, "/api/v1/campaigns/", { workspace }),
  ]);
  return {
    crops: crops.data,
    campaigns: campaigns.data.results.filter((x) => x.status !== "closed" && !x.is_archived),
    offline: crops.offline || campaigns.offline,
  };
}

// ── Producteurs ─────────────────────────────────────────────────────────

export type PickedProducer = {
  id: string;
  first_name: string;
  last_name: string;
  locality_text: string;
  phone?: string;
  membership_number?: string | null;
  producer_code?: string | null;
  /** Enrôlé hors ligne, pas encore envoyé. */
  pending?: boolean;
};

const PRODUCERS = "/api/v1/producers/";
const OFFLINE_PRODUCERS = 1000;

function fold(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function matchesProducer(q: string, p: PickedProducer) {
  const needle = fold(q.trim());
  if (!needle) return true;
  const hay = fold([p.first_name, p.last_name, p.locality_text, p.phone, p.membership_number, p.producer_code].filter(Boolean).join(" "));
  return needle.split(/\s+/).every((w) => hay.includes(w));
}

function toPicked(p: S["Producer"]): PickedProducer {
  const r = p as S["Producer"] & { phone_number?: string; assignment?: { membership_number?: string | null } | null };
  return {
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    locality_text: p.locality_text ?? "",
    phone: r.phone_number ?? "",
    membership_number: r.assignment?.membership_number ?? null,
    producer_code: (p as { producer_code?: string | null }).producer_code ?? null,
  };
}

/** Copie des producteurs de l'espace, pour chercher l'exploitant hors ligne (1 000 au plus). */
export async function syncProducers(api: ApiClient, workspace: string): Promise<void> {
  if (workspace === "personal") return;
  const all: PickedProducer[] = [];
  for (let page = 1; page <= OFFLINE_PRODUCERS / 50; page++) {
    const data = await api.request<Paginated<S["Producer"]>>(PRODUCERS, { workspace, query: { page } });
    all.push(...data.results.map(toPicked));
    if (!data.next) break;
  }
  await putCached(workspace, "producers:all", all);
}

function pendingProducers(ops: OutboxOp[], workspace: string): PickedProducer[] {
  return ops
    .filter((o) => o.entity_type === "producer" && o.status === "pending" && o.workspace === workspace)
    .map((o) => ({
      id: `${REF}${o.id}`,
      first_name: String(o.payload.first_name ?? ""),
      last_name: String(o.payload.last_name ?? ""),
      locality_text: String(o.payload.locality_text ?? ""),
      phone: String(o.payload.phone_number ?? ""),
      membership_number: (o.payload.membership_number as string) || null,
      pending: true,
    }));
}

/** Recherche de l'exploitant : serveur si possible, sinon copie du téléphone. */
export async function searchProducers(api: ApiClient, workspace: string, q: string): Promise<PickedProducer[]> {
  const local = pendingProducers(await listOps(), workspace).filter((p) => matchesProducer(q, p));
  try {
    const data = await api.request<Paginated<S["Producer"]>>(PRODUCERS, { workspace, query: { q: q.trim() } });
    return [...local, ...data.results.map(toPicked)].slice(0, 8);
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    const copy = (await cachedOnly<PickedProducer[]>("producers:all", { workspace })) ?? [];
    return [...local, ...copy.filter((p) => matchesProducer(q, p))].slice(0, 8);
  }
}

/** Producteur connu du téléphone (copie, ou enrôlé hors ligne). */
export async function findLocalProducer(workspace: string, id: string): Promise<PickedProducer | null> {
  if (isLocalRef(id)) return pendingProducers(await listOps(), workspace).find((p) => p.id === id) ?? null;
  const copy = (await cachedOnly<PickedProducer[]>("producers:all", { workspace })) ?? [];
  return copy.find((p) => p.id === id) ?? null;
}

// ── Cycles ──────────────────────────────────────────────────────────────

type Cycle = S["CropCycleDetail"];
export type FieldCycle = {
  cycle: Cycle;
  /** Référence à citer dans les saisies : UUID serveur ou « @op:<uuid> ». */
  ref: string;
  /** Cycle pas encore envoyé. */
  pending: boolean;
  offline: boolean;
  /** Identifiants des opérations, récoltes et changements de statut pas encore envoyés. */
  pendingIds: Set<string>;
  /** Un changement de statut attend déjà l'envoi. */
  statusPending: boolean;
};

function overlay(base: Cycle, ops: OutboxOp[], refs: string[]): Omit<FieldCycle, "ref" | "pending" | "offline"> {
  const mine = ops.filter(
    (o) => o.status === "pending" && (refs.includes(o.params.cycle ?? "") || refs.includes(o.entity_id ?? "")),
  );
  const pendingIds = new Set<string>();
  const operations = [...base.operations];
  const harvests = [...base.harvests];
  let status = base.status;
  let sowing = base.sowing_date;
  let statusPending = false;
  let total = Number(base.total_harvest_kg ?? 0);
  for (const o of mine) {
    const id = `${REF}${o.id}`;
    pendingIds.add(id);
    const p = o.payload as Record<string, string | null>;
    if (o.entity_type === "crop_operation") {
      operations.push({
        id,
        operation_type: p.operation_type,
        planned_date: p.planned_date ?? null,
        performed_date: p.performed_date ?? null,
        source: "field_agent",
        product_text: p.product_text ?? "",
        quantity: p.quantity ?? null,
        quantity_unit: p.quantity_unit ?? "",
        notes: "",
        created_at: o.client_created_at,
      } as unknown as Cycle["operations"][number]);
    } else if (o.entity_type === "harvest") {
      harvests.push({
        id,
        harvest_date: p.harvest_date,
        quantity_kg: p.quantity_kg,
        original_quantity: p.original_quantity ?? null,
        original_unit: p.original_unit ?? "",
        measurement_method: p.measurement_method,
        notes: "",
        created_at: o.client_created_at,
      } as unknown as Cycle["harvests"][number]);
      total += Number(p.quantity_kg ?? 0);
    } else if (o.entity_type === "crop_cycle" && o.operation === "update") {
      if (p.status) status = p.status as Cycle["status"];
      if (p.sowing_date) sowing = p.sowing_date;
      statusPending = true;
    }
  }
  return {
    cycle: { ...base, operations, harvests, status, sowing_date: sowing, total_harvest_kg: total ? total.toFixed(2) : base.total_harvest_kg },
    pendingIds,
    statusPending,
  };
}

/** Cycle pour le suivi au champ : fiche serveur (ou sa copie), ou cycle saisi hors ligne. */
export async function loadFieldCycle(api: ApiClient, workspace: string, id: string): Promise<FieldCycle> {
  const ops = await listOps();
  let target = id;
  if (isLocalRef(id)) {
    const sent = await serverId(id);
    if (!sent) {
      const op = await findOp(id);
      if (!op) throw new Error("Cycle introuvable sur ce téléphone.");
      const p = op.payload as Record<string, string | null>;
      const crops = (await cachedOnly<S["Crop"][]>("/api/v1/crops/", { workspace })) ?? [];
      const crop = crops.find((c) => c.code === p.declared_crop);
      const cropRef = { id: crop?.id ?? "", code: String(p.declared_crop ?? ""), name_fr: crop?.name_fr ?? String(p.declared_crop ?? "") };
      const parcelRef = String(p.parcel ?? "");
      const parcel = await loadFieldParcel(api, workspace, parcelRef).catch(() => null);
      const base = {
        id,
        parcel: { id: parcelRef, agroid: parcel?.agroid ?? "", local_name: parcel?.local_name ?? "" },
        cultivation_unit: null,
        campaign: null,
        operator: null,
        crop: cropRef,
        declared_crop: cropRef,
        confirmed_crop: null,
        confirmed_at: null,
        variety: null,
        planned_sowing_date: p.planned_sowing_date ?? null,
        sowing_date: p.sowing_date ?? null,
        transplanting_date: null,
        expected_harvest_date: null,
        harvest_end_date: null,
        declared_area_m2: p.declared_area_m2 ?? null,
        status: (p.status ?? "planned") as Cycle["status"],
        seed_source: p.seed_source ?? "",
        planting_method: p.planting_method ?? "",
        previous_crop: null,
        previous_fallow: Boolean(op.payload.previous_fallow),
        total_harvest_kg: null,
        is_archived: false,
        row_version: 0,
        created_at: op.client_created_at,
        updated_at: op.client_created_at,
        operations: [],
        harvests: [],
        overlaps: [],
      } as unknown as Cycle;
      return { ...overlay(base, ops, [id]), ref: id, pending: true, offline: true };
    }
    target = sent;
  }
  const { data, offline } = await cachedGet<Cycle>(api, `/api/v1/crop-cycles/${target}/`, { workspace });
  // Saisies faites hors ligne sur ce cycle avant son envoi : elles le citent par « @op: ».
  const origin = ops.find((o) => o.entity_type === "crop_cycle" && o.operation === "create" && (o.result as { id?: string } | undefined)?.id === target);
  const refs = [target, ...(origin ? [`${REF}${origin.id}`] : [])];
  return { ...overlay(data, ops, refs), ref: target, pending: false, offline };
}
