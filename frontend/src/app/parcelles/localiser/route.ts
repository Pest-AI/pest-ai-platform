/**
 * GET /parcelles/localiser?q=… : retrouve une parcelle par son AgroID (saisie tolérée) ou son nom.
 * Renvoie au plus 5 résultats avec leur point central, pour centrer la carte.
 */
import { NextResponse } from "next/server";

import { currentWorkspace, getApi } from "@/lib/api/client";

export async function GET(request: Request) {
  const workspace = await currentWorkspace();
  if (!workspace) return NextResponse.json({ detail: "Aucun espace." }, { status: 400 });
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });
  const api = await getApi();
  const { data, response } = await api.GET("/api/v1/parcels/", {
    params: { header: { "X-Workspace": workspace }, query: { q: q.slice(0, 60) } },
  });
  if (!data) return NextResponse.json({ detail: "Recherche indisponible." }, { status: response.status || 502 });
  const results = data.results.slice(0, 5).map((p) => ({
    id: p.id,
    agroid: p.agroid,
    local_name: p.local_name,
    status: p.status,
    centroid: p.centroid,
  }));
  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
