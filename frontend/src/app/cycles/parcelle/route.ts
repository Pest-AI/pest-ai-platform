/**
 * GET /cycles/parcelle?id=… : de quoi démarrer un cycle sur une parcelle — unités actives,
 * exploitant principal, surface. L'API revérifie l'espace (lien actif) et parcels.view.
 */
import { NextResponse } from "next/server";

import { currentWorkspace, getApi } from "@/lib/api/client";

export async function GET(request: Request) {
  const workspace = await currentWorkspace();
  if (!workspace) return NextResponse.json({ detail: "Aucun espace." }, { status: 400 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ detail: "Parcelle invalide." }, { status: 400 });
  const api = await getApi();
  const { data, response } = await api.GET("/api/v1/parcels/{id}/", {
    params: { header: { "X-Workspace": workspace }, path: { id } },
  });
  if (!data) return NextResponse.json({ detail: "Parcelle introuvable." }, { status: response.status || 502 });
  const operator = data.primary_operator as { name?: string } | null;
  return NextResponse.json(
    {
      id: data.id,
      agroid: data.agroid,
      local_name: data.local_name,
      status: data.status,
      area_m2: data.current_area_m2,
      operator: operator?.name ?? null,
      units: data.units.filter((u) => u.status === "active").map((u) => ({ id: u.id, code: u.code, name: u.name, area_m2: u.area_m2 })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
