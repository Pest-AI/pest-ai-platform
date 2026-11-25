/**
 * File d'envoi des saisies terrain (J20).
 *
 * Toute saisie terrain (producteur, parcelle, sol et eau, unité, cycle, opération, récolte)
 * passe par cette file, avec ou sans réseau :
 *   1. elle est d'abord enregistrée sur le téléphone, avec un identifiant tiré ici (UUID) ;
 *   2. elle part aussitôt vers `/api/v1/sync/push/` ; sans réseau, elle attend ;
 *   3. elle repart toute seule au retour du réseau (voir `useAutoSync`).
 *
 * Le serveur est idempotent sur cet identifiant : une saisie renvoyée après une coupure (réponse
 * perdue) n'est jamais créée deux fois. Une saisie peut citer l'objet créé par une saisie
 * précédente encore en attente (« @op:<uuid> ») : parcelle enrôlée hors ligne, puis son unité,
 * son cycle, ses opérations…
 *
 * Les saisies sont rangées par compte (plusieurs agents peuvent se partager un téléphone) et ne
 * sont pas effacées à la déconnexion : elles partent à la prochaine connexion du même compte.
 */
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

import { ApiError, NetworkError, SessionExpiredError, type ApiClient } from "./api";
import { localStore, uuid4, type BlobStore } from "./local-db";

export type EntityType =
  | "producer"
  | "parcel"
  | "parcel_site"
  | "soil_test"
  | "cultivation_unit"
  | "crop_cycle"
  | "crop_operation"
  | "harvest";

export type OutboxStatus = "pending" | "applied" | "rejected" | "conflict";

export type OutboxOp = {
  id: string;
  owner: string;
  workspace: string;
  entity_type: EntityType;
  operation: "create" | "update";
  entity_id?: string | null;
  params: Record<string, string>;
  payload: Record<string, unknown>;
  base_row_version?: number | null;
  client_created_at: string;
  client_sequence: number;
  /** Ce que l'agent a saisi, en une ligne (« Parcelle Champ Nord · Samba Ndiaye »). */
  label: string;
  status: OutboxStatus;
  error_code?: string;
  /** Réponse du serveur : résumé de l'objet créé, ou détail du refus. */
  result?: unknown;
  sent_at?: string;
};

export type OpInput = Pick<OutboxOp, "workspace" | "entity_type" | "params" | "payload" | "label"> &
  Partial<Pick<OutboxOp, "operation" | "entity_id" | "base_row_version">>;

type DeviceState = { installation_id: string; sequence: number };
type ServerResult = {
  id: string;
  status: "applied" | "duplicate" | "conflict" | "rejected" | "pending" | "retry";
  original_status?: "applied" | "conflict" | "rejected";
  error_code: string;
  result?: unknown;
};

export const REF = "@op:";
const BATCH = 50;
const PLATFORM = Platform.OS === "android" || Platform.OS === "ios" ? Platform.OS : "web";
const KEEP_APPLIED_DAYS = 7;

/** Code d'erreur de synchronisation → statut HTTP équivalent de la saisie en ligne. */
const ERROR_STATUS: Record<string, number> = {
  validation_failed: 400,
  bad_parameters: 400,
  unsupported_operation: 400,
  sequence_reused: 400,
  permission_denied: 403,
  foreign_operation: 403,
  not_found: 404,
  duplicate_candidates: 409,
};

export const ERROR_LABELS: Record<string, string> = {
  validation_failed: "Le serveur a refusé une valeur",
  permission_denied: "Votre rôle ne permet pas cette saisie",
  not_found: "Fiche introuvable (supprimée ou hors de votre espace)",
  duplicate_candidates: "Producteur peut-être déjà enregistré",
  concurrent_update: "Modifié entre-temps au bureau",
  archived_on_server: "Archivé entre-temps au bureau",
};

// ── Stockage ────────────────────────────────────────────────────────────

let store: BlobStore = localStore("pestai-envois");
let owner: string | null = null;
const listeners = new Set<() => void>();
let flushing: Promise<FlushReport> | null = null;

/** Pour les tests. */
export function setOutboxStore(next: BlobStore) {
  store = next;
  owner = null;
  flushing = null;
}

const opsKey = (who: string) => `ops:${who}`;
const deviceKey = (who: string) => `device:${who}`;

function notify() {
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Compte connecté (gardé pour retrouver ses saisies si l'app démarre sans réseau). */
export async function setOwner(id: string) {
  owner = id;
  await store.set("owner", id).catch(() => undefined);
  notify();
}

async function currentOwner(): Promise<string | null> {
  if (owner) return owner;
  owner = await store.get("owner").catch(() => null);
  return owner;
}

async function read(who: string): Promise<OutboxOp[]> {
  const raw = await store.get(opsKey(who));
  return raw ? (JSON.parse(raw) as OutboxOp[]) : [];
}

async function write(who: string, ops: OutboxOp[]) {
  const cutoff = Date.now() - KEEP_APPLIED_DAYS * 86_400_000;
  const kept = ops.filter((o) => o.status !== "applied" || !o.sent_at || Date.parse(o.sent_at) > cutoff);
  await store.set(opsKey(who), JSON.stringify(kept));
  notify();
}

async function device(who: string): Promise<DeviceState> {
  const raw = await store.get(deviceKey(who));
  if (raw) return JSON.parse(raw) as DeviceState;
  const fresh = { installation_id: uuid4(), sequence: 0 };
  await store.set(deviceKey(who), JSON.stringify(fresh));
  return fresh;
}

/** Saisies du compte connecté, de la plus ancienne à la plus récente. */
export async function listOps(): Promise<OutboxOp[]> {
  const who = await currentOwner();
  if (!who) return [];
  try {
    return (await read(who)).sort((a, b) => a.client_sequence - b.client_sequence);
  } catch {
    return [];
  }
}

export async function findOp(id: string): Promise<OutboxOp | null> {
  const clean = id.startsWith(REF) ? id.slice(REF.length) : id;
  return (await listOps()).find((o) => o.id === clean) ?? null;
}

/** Identifiant serveur d'une référence : l'UUID lui-même, ou l'objet créé par une saisie envoyée. */
export async function serverId(ref: string): Promise<string | null> {
  if (!ref.startsWith(REF)) return ref;
  const op = await findOp(ref);
  const id = op?.status === "applied" ? (op.result as { id?: string } | undefined)?.id : undefined;
  return id ?? null;
}

export const isLocalRef = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.startsWith(REF);

// ── Mise en file ────────────────────────────────────────────────────────

export async function enqueue(input: OpInput): Promise<OutboxOp> {
  const who = await currentOwner();
  if (!who) throw new Error("Aucun compte connecté sur ce téléphone.");
  const state = await device(who);
  state.sequence += 1;
  await store.set(deviceKey(who), JSON.stringify(state));
  const op: OutboxOp = {
    id: uuid4(),
    owner: who,
    operation: "create",
    entity_id: null,
    base_row_version: null,
    ...input,
    client_created_at: new Date().toISOString(),
    client_sequence: state.sequence,
    status: "pending",
  };
  await write(who, [...(await read(who)), op]);
  return op;
}

function referencesOp(op: OutboxOp, id: string): boolean {
  return JSON.stringify([op.params, op.payload, op.entity_id]).includes(`"${REF}${id}"`);
}

function rewrite<T>(value: T, from: string, to: string): T {
  return JSON.parse(JSON.stringify(value).split(`"${REF}${from}"`).join(JSON.stringify(to))) as T;
}

/** Saisies qui dépendent (directement ou non) de `id`. */
function dependents(ops: OutboxOp[], id: string): Set<string> {
  const found = new Set<string>();
  let frontier = [id];
  while (frontier.length) {
    const next: string[] = [];
    for (const o of ops) {
      if (!found.has(o.id) && frontier.some((f) => referencesOp(o, f))) {
        found.add(o.id);
        next.push(o.id);
      }
    }
    frontier = next;
  }
  return found;
}

/** Nombre de saisies qui attendent `id`. */
export async function dependentCount(id: string): Promise<number> {
  return dependents(await listOps(), id).size;
}

/** Abandonne une saisie et celles qui en dépendent. Renvoie le nombre de saisies retirées. */
export async function discard(id: string): Promise<number> {
  const who = await currentOwner();
  if (!who) return 0;
  const ops = await read(who);
  const gone = dependents(ops, id);
  gone.add(id);
  await write(
    who,
    ops.filter((o) => !gone.has(o.id)),
  );
  return gone.size;
}

/** Remplace une saisie refusée par une version corrigée ; les saisies qui en dépendent suivent. */
export async function retryWith(id: string, payloadPatch: Record<string, unknown>): Promise<OutboxOp> {
  const who = await currentOwner();
  if (!who) throw new Error("Aucun compte connecté sur ce téléphone.");
  const old = (await read(who)).find((o) => o.id === id);
  if (!old) throw new Error("Saisie introuvable.");
  const fresh = await enqueue({
    workspace: old.workspace,
    entity_type: old.entity_type,
    operation: old.operation,
    entity_id: old.entity_id,
    base_row_version: old.base_row_version,
    params: old.params,
    payload: { ...old.payload, ...payloadPatch },
    label: old.label,
  });
  await redirect(who, id, `${REF}${fresh.id}`);
  return fresh;
}

/** La saisie `id` est remplacée par un objet existant (ex. producteur rattaché) : ses dépendantes
 *  le citent directement, et elle est retirée. */
export async function replaceWithExisting(id: string, existingId: string) {
  const who = await currentOwner();
  if (who) await redirect(who, id, existingId);
}

async function redirect(who: string, id: string, target: string) {
  const ops = await read(who);
  const to = target;
  await write(
    who,
    ops
      .filter((o) => o.id !== id)
      .map((o) =>
        referencesOp(o, id)
          ? {
              ...o,
              params: rewrite(o.params, id, to),
              payload: rewrite(o.payload, id, to),
              entity_id: o.entity_id ? rewrite(o.entity_id, id, to) : o.entity_id,
            }
          : o,
      ),
  );
}

// ── Envoi ───────────────────────────────────────────────────────────────

export type FlushReport = {
  sent: number;
  applied: number;
  problems: number;
  waiting: number;
  offline: boolean;
  expired: boolean;
  /** Refus de l'appareil (révoqué, autre compte) ou erreur inattendue du serveur. */
  error: string | null;
};

/** Envoie les saisies en attente, espace par espace, par lots de 50. Un seul envoi à la fois. */
export function flush(api: ApiClient, appVersion = ""): Promise<FlushReport> {
  if (!flushing) {
    flushing = doFlush(api, appVersion).finally(() => {
      flushing = null;
      notify();
    });
    notify();
  }
  return flushing;
}

export const isFlushing = () => flushing !== null;

async function doFlush(api: ApiClient, appVersion: string): Promise<FlushReport> {
  const report: FlushReport = { sent: 0, applied: 0, problems: 0, waiting: 0, offline: false, expired: false, error: null };
  const who = await currentOwner();
  if (!who) return report;
  const state = await device(who);
  const pending = (await read(who)).filter((o) => o.status === "pending");
  const workspaces = [...new Set(pending.map((o) => o.workspace))];
  for (const workspace of workspaces) {
    // Plusieurs passes : une saisie qui attend une autre du même lot repart à la passe suivante.
    for (let pass = 0; pass < 5; pass++) {
      const batch = (await read(who))
        .filter((o) => o.status === "pending" && o.workspace === workspace)
        .sort((a, b) => a.client_sequence - b.client_sequence)
        .slice(0, BATCH);
      if (!batch.length) break;
      let body: { results: ServerResult[] };
      try {
        body = await api.request<{ results: ServerResult[] }>("/api/v1/sync/push/", {
          method: "POST",
          workspace,
          body: {
            device: { installation_id: state.installation_id, platform: PLATFORM, app_version: appVersion },
            operations: batch.map((o) => ({
              id: o.id,
              entity_type: o.entity_type,
              operation: o.operation,
              entity_id: o.entity_id ?? null,
              params: o.params,
              payload: o.payload,
              base_row_version: o.base_row_version ?? null,
              client_created_at: o.client_created_at,
              client_sequence: o.client_sequence,
            })),
          },
        });
      } catch (e) {
        if (e instanceof NetworkError) report.offline = true;
        else if (e instanceof SessionExpiredError) report.expired = true;
        else report.error = e instanceof ApiError ? e.message : "Envoi impossible pour le moment.";
        report.waiting = (await read(who)).filter((o) => o.status === "pending").length;
        return report;
      }
      report.sent += batch.length;
      const byId = new Map(body.results.map((r) => [r.id, r]));
      const now = new Date().toISOString();
      let progressed = false;
      const ops = (await read(who)).map((o) => {
        const r = byId.get(o.id);
        if (!r || r.status === "pending" || r.status === "retry") return o;
        const status = r.status === "duplicate" ? (r.original_status ?? "applied") : r.status;
        progressed = true;
        if (status === "applied") report.applied += 1;
        else report.problems += 1;
        return { ...o, status, error_code: r.error_code || undefined, result: r.result, sent_at: now };
      });
      await write(who, ops);
      if (!progressed) break;
    }
  }
  report.waiting = (await read(who)).filter((o) => o.status === "pending").length;
  return report;
}

export type SubmitResult =
  | { kind: "applied"; op: OutboxOp; id: string; result: Record<string, unknown> }
  | { kind: "queued"; op: OutboxOp }
  | { kind: "conflict"; op: OutboxOp };

/**
 * Saisie terrain : mise en file puis envoi immédiat.
 * - envoyée : renvoie l'objet créé ;
 * - pas de réseau (ou en attente d'une saisie précédente) : reste sur le téléphone ;
 * - refusée (contrôle, droit, doublon) : retirée de la file et levée comme `ApiError`, avec le
 *   même détail qu'une saisie en ligne, pour que l'agent corrige à l'écran.
 */
export async function submit(api: ApiClient, input: OpInput): Promise<SubmitResult> {
  const op = await enqueue(input);
  const report = await flush(api);
  if (report.expired) throw new SessionExpiredError();
  const after = await findOp(op.id);
  if (!after) return { kind: "queued", op };
  if (after.status === "applied") {
    const result = (after.result ?? {}) as Record<string, unknown>;
    return { kind: "applied", op: after, id: String(result.id ?? ""), result };
  }
  if (after.status === "rejected") {
    await discard(after.id);
    throw new ApiError(ERROR_STATUS[after.error_code ?? ""] ?? 400, after.result);
  }
  if (after.status === "conflict") return { kind: "conflict", op: after };
  return { kind: "queued", op: after };
}

// ── Hooks ───────────────────────────────────────────────────────────────

export type OutboxState = {
  ops: OutboxOp[];
  pending: number;
  problems: OutboxOp[];
  syncing: boolean;
  refresh: () => Promise<void>;
};

export function useOutbox(): OutboxState {
  const [ops, setOps] = useState<OutboxOp[]>([]);
  const [syncing, setSyncing] = useState(isFlushing());
  const refresh = useCallback(async () => {
    setOps(await listOps());
    setSyncing(isFlushing());
  }, []);
  useEffect(() => {
    void refresh();
    return subscribe(() => void refresh());
  }, [refresh]);
  return {
    ops,
    pending: ops.filter((o) => o.status === "pending").length,
    problems: ops.filter((o) => o.status === "rejected" || o.status === "conflict"),
    syncing,
    refresh,
  };
}

/** Libellé d'un refus ou d'un conflit. */
export function problemLabel(op: OutboxOp): string {
  return ERROR_LABELS[op.error_code ?? ""] ?? "Saisie refusée par le serveur";
}

/** Détail lisible d'un refus (réponse du serveur). */
export function problemDetail(op: OutboxOp): string {
  if (op.status !== "rejected") return "";
  return new ApiError(ERROR_STATUS[op.error_code ?? ""] ?? 400, op.result).message;
}
