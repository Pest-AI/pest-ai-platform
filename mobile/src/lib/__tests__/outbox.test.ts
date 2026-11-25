import { ApiError, NetworkError, type ApiClient } from "../api";
import { memoryStore } from "../local-db";
import {
  dependentCount,
  discard,
  enqueue,
  findOp,
  flush,
  listOps,
  replaceWithExisting,
  retryWith,
  serverId,
  setOutboxStore,
  setOwner,
  submit,
} from "../outbox";

type Sent = { operations: { id: string; client_sequence: number; params: Record<string, string>; payload: Record<string, unknown> }[] };

/** Faux serveur : applique, sauf règles données par le test ; résout « @op: ». */
function fakeServer(rules: { offline?: boolean; reject?: (op: Sent["operations"][number]) => string | null } = {}) {
  const applied = new Map<string, string>();
  const calls: Sent[] = [];
  const api = {
    async request(path: string, options: { body: Sent }) {
      if (rules.offline) throw new NetworkError();
      expect(path).toBe("/api/v1/sync/push/");
      calls.push(options.body);
      const results = options.body.operations.map((op) => {
        if (applied.has(op.id)) return { id: op.id, status: "duplicate", original_status: "applied", error_code: "", result: { id: applied.get(op.id) } };
        const refs = JSON.stringify([op.params, op.payload]).match(/@op:[0-9a-f-]{36}/g) ?? [];
        if (refs.some((r) => !applied.has(r.slice(4)))) return { id: op.id, status: "pending", error_code: "dependency_pending" };
        const code = rules.reject?.(op);
        if (code) return { id: op.id, status: "rejected", error_code: code, result: code === "duplicate_candidates" ? { detail: "Doublon", candidates: [{ id: "c1" }] } : { name: ["Trop long."] } };
        const id = `srv-${applied.size + 1}`;
        applied.set(op.id, id);
        return { id: op.id, status: "applied", error_code: "", result: { id } };
      });
      return { results };
    },
  } as unknown as ApiClient;
  return { api, calls, applied };
}

const W = "org:1";

beforeEach(async () => {
  setOutboxStore(memoryStore());
  await setOwner("agent-1");
});

describe("file d'envoi", () => {
  it("garde la saisie sans réseau, puis l'envoie avec ses dépendantes dans l'ordre", async () => {
    const off = fakeServer({ offline: true });
    const parcel = await submit(off.api, { workspace: W, entity_type: "parcel", params: {}, payload: { local_name: "Champ" }, label: "Parcelle Champ" });
    expect(parcel.kind).toBe("queued");
    await enqueue({ workspace: W, entity_type: "cultivation_unit", params: { parcel: `@op:${parcel.op.id}` }, payload: {}, label: "Unité" });
    expect((await listOps()).map((o) => o.status)).toEqual(["pending", "pending"]);

    const on = fakeServer();
    const report = await flush(on.api);
    expect(report).toMatchObject({ applied: 2, problems: 0, waiting: 0, offline: false });
    expect(on.calls[0]!.operations.map((o) => o.client_sequence)).toEqual([1, 2]);
    expect(await serverId(`@op:${parcel.op.id}`)).toBe("srv-1");
  });

  it("idempotent : une réponse perdue n'entraîne pas de double création", async () => {
    const server = fakeServer();
    const op = await enqueue({ workspace: W, entity_type: "producer", params: {}, payload: {}, label: "Awa" });
    await server.api.request("/api/v1/sync/push/", { body: { operations: [{ ...op }] } } as never); // réponse « perdue »
    await flush(server.api);
    expect(server.applied.size).toBe(1);
    expect((await findOp(op.id))?.status).toBe("applied");
  });

  it("en ligne, un refus revient comme une erreur de saisie et quitte la file", async () => {
    const server = fakeServer({ reject: () => "validation_failed" });
    await expect(
      submit(server.api, { workspace: W, entity_type: "parcel", params: {}, payload: {}, label: "X" }),
    ).rejects.toMatchObject({ status: 400 });
    expect(await listOps()).toEqual([]);
    const dup = fakeServer({ reject: () => "duplicate_candidates" });
    const err = await submit(dup.api, { workspace: W, entity_type: "producer", params: {}, payload: {}, label: "Y" }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
  });

  it("doublon découvert plus tard : créer quand même, les dépendantes suivent", async () => {
    const off = fakeServer({ offline: true });
    const producer = (await submit(off.api, { workspace: W, entity_type: "producer", params: {}, payload: { first_name: "Moussa" }, label: "Moussa" })).op;
    await enqueue({ workspace: W, entity_type: "parcel", params: {}, payload: { producer: `@op:${producer.id}` }, label: "Parcelle" });
    const server = fakeServer({ reject: (op) => (op.payload.first_name && !op.payload.confirm_new ? "duplicate_candidates" : null) });
    await flush(server.api);
    expect((await findOp(producer.id))?.status).toBe("rejected");
    expect(await dependentCount(producer.id)).toBe(1);

    const fresh = await retryWith(producer.id, { confirm_new: true });
    const parcel = (await listOps()).find((o) => o.entity_type === "parcel")!;
    expect(parcel.payload.producer).toBe(`@op:${fresh.id}`);
    await flush(server.api);
    expect((await listOps()).every((o) => o.status === "applied")).toBe(true);
  });

  it("rattacher la fiche existante, ou abandonner une saisie et ses dépendantes", async () => {
    const off = fakeServer({ offline: true });
    const a = (await submit(off.api, { workspace: W, entity_type: "producer", params: {}, payload: {}, label: "A" })).op;
    await enqueue({ workspace: W, entity_type: "parcel", params: {}, payload: { producer: `@op:${a.id}` }, label: "P" });
    await replaceWithExisting(a.id, "existing-42");
    const ops = await listOps();
    expect(ops).toHaveLength(1);
    expect(ops[0]!.payload.producer).toBe("existing-42");

    const b = await enqueue({ workspace: W, entity_type: "parcel", params: {}, payload: {}, label: "B" });
    const u = await enqueue({ workspace: W, entity_type: "cultivation_unit", params: { parcel: `@op:${b.id}` }, payload: {}, label: "U" });
    await enqueue({ workspace: W, entity_type: "crop_cycle", params: {}, payload: { cultivation_unit: `@op:${u.id}` }, label: "C" });
    expect(await discard(b.id)).toBe(3);
    expect(await listOps()).toHaveLength(1);
  });

  it("les saisies sont rangées par compte", async () => {
    await enqueue({ workspace: W, entity_type: "producer", params: {}, payload: {}, label: "A" });
    await setOwner("agent-2");
    expect(await listOps()).toEqual([]);
    await setOwner("agent-1");
    expect(await listOps()).toHaveLength(1);
  });
});
