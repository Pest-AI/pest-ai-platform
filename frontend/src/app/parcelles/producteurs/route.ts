/**
 * GET /parcelles/producteurs?q=… : producteurs rattachés à l'organisation, pour choisir
 * l'exploitant d'une nouvelle parcelle. Route du Web OS (hors /api/) pour profiter du
 * renouvellement de session ; l'API revérifie la permission producers.view.
 */
import { NextResponse } from "next/server";

import { currentWorkspace, getApi } from "@/lib/api/client";

export async function GET(request: Request) {
  const workspace = await currentWorkspace();
  if (!workspace) return NextResponse.json({ detail: "Aucun espace." }, { status: 400 });
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  const api = await getApi();
  const { data, response } = await api.GET("/api/v1/producers/", {
    params: { header: { "X-Workspace": workspace }, query: { q: q || undefined, status: "active" } },
  });
  if (!data) return NextResponse.json({ results: [] }, { status: response.status || 502 });
  const results = data.results.slice(0, 20).map((p) => ({
    id: p.id,
    name: `${p.first_name} ${p.last_name}`.trim(),
    detail: [p.assignment?.membership_number ? `N° ${p.assignment.membership_number}` : "", p.locality_text, p.phone_number]
      .filter(Boolean)
      .join(" · "),
  }));
  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
