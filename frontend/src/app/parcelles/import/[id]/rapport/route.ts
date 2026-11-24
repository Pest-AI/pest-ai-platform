/**
 * GET /parcelles/import/{id}/rapport : rapport CSV de l'import (aperçu ou bilan avec AgroID).
 *
 * Route du Web OS (hors /api/) pour profiter du renouvellement de session du proxy.
 * L'API revérifie la session, l'espace et la permission parcels.manage.
 */
import { NextResponse } from "next/server";

import { currentWorkspace, getApi } from "@/lib/api/client";
import { type ReportLine, reportCsv } from "@/lib/parcel-imports";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ detail: "Import introuvable." }, { status: 404 });
  const workspace = await currentWorkspace();
  if (!workspace) return NextResponse.json({ detail: "Aucun espace." }, { status: 400 });
  const api = await getApi();
  const { data, response } = await api.GET("/api/v1/parcel-imports/{id}/", {
    params: { header: { "X-Workspace": workspace }, path: { id } },
  });
  if (!data) return NextResponse.json({ detail: "Import introuvable." }, { status: response.status || 502 });
  const committed = data.status === "committed";
  const lines: ReportLine[] = committed
    ? (data.report ?? []).map((l) => ({ ...l, status: l.status }))
    : (data.rows ?? []).map((r) => ({
        index: r.index,
        label: r.label,
        status: r.status,
        messages: r.messages,
        area_m2: r.area_m2,
        operator: (r.operator as { name?: string } | null)?.name ?? null,
      }));
  const base = data.file_name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 60) || "import";
  return new NextResponse(reportCsv(lines, committed), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rapport-${encodeURIComponent(base)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
