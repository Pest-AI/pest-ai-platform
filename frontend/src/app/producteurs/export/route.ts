/**
 * GET /producteurs/export : registre des producteurs (filtres de la page) en CSV.
 * L'API revérifie la session, l'organisation et la permission producers.view.
 */
import { NextResponse } from "next/server";

import { currentWorkspace, getApi } from "@/lib/api/client";
import { toCsv } from "@/lib/csv";
import { formatPhone } from "@/lib/phone";
import { LANGUAGE_LABELS, RELATIONSHIP_LABELS, SEX_LABELS } from "@/lib/producers";

const MAX_PAGES = 40; // 2 000 producteurs au plus par export

export async function GET(request: Request) {
  const workspace = await currentWorkspace();
  if (!workspace) return NextResponse.redirect(new URL("/espaces", request.url));
  const url = new URL(request.url);
  const pick = (key: string, allowed: string[]) => {
    const v = url.searchParams.get(key) ?? "";
    return allowed.includes(v) ? v : undefined;
  };
  const query = {
    q: url.searchParams.get("q")?.trim() || undefined,
    status: pick("statut", ["active", "inactive"]) as "active" | "inactive" | undefined,
    relationship: pick("relation", ["member", "beneficiary", "client"]) as "member" | "beneficiary" | "client" | undefined,
    sex: pick("sexe", ["female", "male"]) as "female" | "male" | undefined,
  };

  const api = await getApi();
  const header = { "X-Workspace": workspace };
  const rows: unknown[][] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, response } = await api.GET("/api/v1/producers/", { params: { header, query: { ...query, page } } });
    if (response.status === 401) return NextResponse.redirect(new URL("/connexion?erreur=session", request.url));
    if (!data) return new NextResponse("Export impossible : accès refusé.", { status: response.status || 500 });
    for (const p of data.results) {
      rows.push([
        p.assignment?.membership_number ?? "",
        p.last_name,
        p.first_name,
        p.sex ? (SEX_LABELS[p.sex] ?? p.sex) : "",
        p.birth_year ?? "",
        p.locality_text,
        // « (+221) 77 … » : lisible et jamais interprété comme une formule par Excel.
        p.phone_number ? formatPhone(p.phone_number).replace(/^\+(\d+)/, "(+$1)") : "",
        LANGUAGE_LABELS[p.preferred_language] ?? p.preferred_language,
        RELATIONSHIP_LABELS[p.assignment?.relationship_type ?? "member"],
        p.assignment?.start_date ?? "",
        p.status === "active" ? "Actif" : "Inactif",
      ]);
    }
    if (!data.next) break;
  }
  const csv = toCsv(
    ["N° adhérent", "Nom", "Prénom", "Sexe", "Année de naissance", "Village ou commune", "Téléphone", "Langue", "Relation", "Depuis", "Statut"],
    rows,
  );
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="producteurs-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
