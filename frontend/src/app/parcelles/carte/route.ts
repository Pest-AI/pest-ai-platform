/**
 * GET /parcelles/carte?bbox=…&statut=…&producteur=…&campagne=…&culture=… : contours de la zone
 * affichée (GeoJSON).
 *
 * Route du Web OS (hors /api/) pour profiter du renouvellement de session du proxy.
 * L'API revérifie la session, l'espace et la permission parcels.view.
 */
import { NextResponse } from "next/server";

import { currentWorkspace, getApi } from "@/lib/api/client";
import { bboxParam, parseBbox } from "@/lib/parcels";

const STATUSES = ["draft", "pending_validation", "active", "retired"] as const;
type Status = (typeof STATUSES)[number];
type Feature = { type: "Feature"; id: string; geometry: unknown; properties: Record<string, unknown> };

export async function GET(request: Request) {
  const workspace = await currentWorkspace();
  if (!workspace) return NextResponse.json({ detail: "Aucun espace." }, { status: 400 });
  const url = new URL(request.url);
  const bbox = parseBbox(url.searchParams.get("bbox"));
  if (!bbox) return NextResponse.json({ detail: "Emprise invalide." }, { status: 400 });
  const statut = url.searchParams.get("statut") ?? "";
  const producer = url.searchParams.get("producteur") ?? "";
  const campaign = url.searchParams.get("campagne") ?? "";
  const crop = url.searchParams.get("culture") ?? "";

  const api = await getApi();
  const { data, response } = await api.GET("/api/v1/parcels/map/", {
    params: {
      header: { "X-Workspace": workspace },
      query: {
        bbox: bboxParam(bbox),
        status: STATUSES.includes(statut as Status) ? statut : undefined,
        producer: /^[0-9a-f-]{36}$/.test(producer) ? producer : undefined,
        campaign: /^[0-9a-f-]{36}$/.test(campaign) ? campaign : undefined,
        crop: /^[a-z_]{2,32}$/.test(crop) ? crop : undefined,
      },
    },
  });
  if (!data) return NextResponse.json({ detail: "Carte indisponible." }, { status: response.status || 502 });
  // L'identifiant est recopié dans les propriétés : MapLibre ne garde pas les id texte.
  const collection = data as { type: string; truncated: boolean; features: Feature[] };
  const features = collection.features.map((f) => ({
    ...f,
    properties: { ...f.properties, id: f.id },
  }));
  return NextResponse.json({ ...collection, features }, { headers: { "Cache-Control": "no-store" } });
}
