import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell, PageHeader } from "@/components/app-shell";
import { COOPERATIVE_NAV } from "@/lib/navigation";
import { loadOrgContext } from "@/lib/org-context";
import type { Bbox } from "@/lib/parcels";

import { UnitForm } from "./unit-form";

export const metadata: Metadata = { title: "Nouvelle unité de culture" };

type Coords = number[] | Coords[];

/** Emprise d'une géométrie GeoJSON quelconque (Polygon, MultiPolygon). */
function extent(coords: Coords, box: Bbox = [Infinity, Infinity, -Infinity, -Infinity]): Bbox {
  if (typeof coords[0] === "number") {
    const [x, y] = coords as number[];
    return [Math.min(box[0], x!), Math.min(box[1], y!), Math.max(box[2], x!), Math.max(box[3], y!)];
  }
  return (coords as Coords[]).reduce<Bbox>((b, c) => extent(c, b), box);
}

/** Ajouter une unité de culture à une parcelle (J19, D-16). */
export default async function NewUnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ctx = await loadOrgContext();
  if (!ctx.can("parcels.create")) redirect(`/parcelles/${id}`);
  const { data: p } = await ctx.api.GET("/api/v1/parcels/{id}/", { params: { header: ctx.header, path: { id } } });
  if (!p) notFound();
  if (p.access !== "manage") redirect(`/parcelles/${id}`);

  const features: unknown[] = [];
  let bbox: Bbox | null = null;
  const contour = p.current_geometry?.geometry as { type: string; coordinates: Coords } | undefined;
  if (contour) {
    features.push({ type: "Feature", properties: { kind: "parcel" }, geometry: contour });
    const e = extent(contour.coordinates);
    const pad = 0.0003;
    bbox = [e[0] - pad, e[1] - pad, e[2] + pad, e[3] + pad];
  } else if (Array.isArray(p.centroid)) {
    const [x, y] = p.centroid as number[];
    bbox = [x! - 0.002, y! - 0.002, x! + 0.002, y! + 0.002];
  }
  for (const u of p.units) {
    if (u.geometry && u.status === "active") features.push({ type: "Feature", properties: { kind: "unit" }, geometry: u.geometry });
  }
  const used = p.units.map((u) => /^U(\d+)$/.exec(u.code)?.[1]).filter(Boolean).map(Number);
  const nextCode = `U${(used.length ? Math.max(...used) : 0) + 1}`;

  return (
    <AppShell
      nav={COOPERATIVE_NAV}
      activeHref="/parcelles"
      {...ctx.shell}
      breadcrumbs={[ctx.org.short_name || ctx.org.name, "Parcelles & AgroID", p.agroid ?? "Parcelle", "Nouvelle unité"]}
      search={null}
    >
      <Link href={`/parcelles/${id}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Fiche parcelle
      </Link>
      <PageHeader
        context={p.agroid ?? "Parcelle"}
        title="Nouvelle unité de culture"
        description={`${p.local_name || "Parcelle"} : une zone de la parcelle consacrée à une culture (tomate sur 1 ha, riz sur un autre…).`}
      />
      {!contour ? (
        <p className="mb-4 rounded-xl bg-warning-bg px-4 py-3 text-[13px] text-warning">
          Cette parcelle n&apos;a pas encore de contour : l&apos;inclusion de l&apos;unité ne pourra pas être vérifiée.
        </p>
      ) : null}
      <UnitForm parcelId={p.id} bbox={bbox} reference={{ type: "FeatureCollection", features }} nextCode={nextCode} />
    </AppShell>
  );
}
