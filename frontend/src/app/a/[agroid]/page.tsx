import { redirect } from "next/navigation";

import { currentWorkspace, getApi } from "@/lib/api/client";
import { agroidFromText } from "@/lib/qr";

/**
 * Lien d'un QR code AgroID ouvert dans le Web OS (/a/PAI-SN-XXXXXXXX) : renvoie vers la fiche
 * si la parcelle est suivie par l'espace actif, sinon vers la recherche.
 */
export default async function AgroIdLink({ params }: { params: Promise<{ agroid: string }> }) {
  const agroid = agroidFromText(decodeURIComponent((await params).agroid));
  if (!agroid) redirect("/parcelles");
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/espaces");
  const api = await getApi();
  const { data } = await api.GET("/api/v1/parcels/", { params: { header: { "X-Workspace": workspace }, query: { q: agroid } } });
  const match = data?.results.find((r) => r.agroid === agroid);
  redirect(match ? `/parcelles/${match.id}` : `/parcelles?q=${agroid}`);
}
