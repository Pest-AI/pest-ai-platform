/**
 * GET /parcelles/import/modele : modèle Excel « Coopérative » (onglets Producteurs et
 * Parcelles), généré par l'API pour rester aligné sur ce que l'import reconnaît.
 */
import { NextResponse } from "next/server";

import { currentWorkspace, getApi } from "@/lib/api/client";

export async function GET() {
  const workspace = await currentWorkspace();
  if (!workspace) return NextResponse.json({ detail: "Aucun espace." }, { status: 400 });
  const api = await getApi();
  const { data, response } = await api.GET("/api/v1/parcel-imports/template/", {
    params: { header: { "X-Workspace": workspace } },
    parseAs: "arrayBuffer",
  });
  if (!response.ok || !data) {
    return NextResponse.json({ detail: "Modèle indisponible." }, { status: response.status || 502 });
  }
  return new NextResponse(data as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modele-cooperative-pestai.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
