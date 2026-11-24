import { ArrowLeft, FileUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { currentWorkspace, getApi } from "@/lib/api/client";
import { COOPERATIVE_NAV } from "@/lib/navigation";
import { type Bbox, padBbox } from "@/lib/parcels";
import { ORGANIZATION_TYPE_LABELS, organizationInitials, primaryRoleLabel } from "@/lib/spaces";

import { ParcelForm } from "./parcel-form";

export const metadata: Metadata = { title: "Nouvelle parcelle" };

export default async function NewParcelPage() {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/espaces");
  const api = await getApi();
  const header = { "X-Workspace": workspace };
  const [{ data: me }, orgResult, contextResult, summaryResult] = await Promise.all([
    api.GET("/api/v1/me/"),
    api.GET("/api/v1/organization/", { params: { header } }),
    api.GET("/api/v1/workspace/", { headers: header }),
    api.GET("/api/v1/parcels/summary/", { params: { header } }),
  ]);
  if (!me) redirect("/connexion?erreur=session");
  if (!orgResult.data) redirect("/espaces?erreur=acces");
  const org = orgResult.data;
  const roles = me.memberships.find((m) => m.workspace === workspace)?.roles ?? [];
  const typeLabel = ORGANIZATION_TYPE_LABELS[org.organization_type] ?? org.organization_type;
  const permissions = new Set(contextResult.data?.permissions ?? []);
  const summary = summaryResult.data;
  const bbox = summary?.bbox?.length === 4 ? padBbox(summary.bbox as Bbox) : null;

  return (
    <AppShell
      nav={COOPERATIVE_NAV}
      activeHref="/parcelles"
      workspace={{ name: org.short_name || org.name, roleLabel: typeLabel, initials: organizationInitials(org.name) }}
      user={{ firstName: me.first_name, lastName: me.last_name, roleLabel: primaryRoleLabel(roles) }}
      breadcrumbs={[org.short_name || org.name, "Parcelles & AgroID", "Nouvelle parcelle"]}
    >
      <Link href="/parcelles" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Parcelles
      </Link>
      <PageHeader
        context={`${org.name} · ${typeLabel}`}
        title="Nouvelle parcelle"
        description="Pour une parcelle notée sur papier ou relevée hors de l'app terrain. L'agent de terrain reste le moyen principal d'enregistrement."
        actions={
          permissions.has("parcels.manage") ? (
            <Button asChild variant="secondary" className="h-10 rounded-xl">
              <Link href="/parcelles/import">
                <FileUp aria-hidden />
                Plusieurs parcelles ? Importer un fichier
              </Link>
            </Button>
          ) : undefined
        }
      />
      {permissions.has("parcels.create") ? (
        <div className="mt-6">
          <ParcelForm bbox={bbox} canChooseOperator={permissions.has("producers.view")} />
        </div>
      ) : (
        <Alert tone="info" className="mt-6">
          Votre rôle ne permet pas d&apos;enregistrer une parcelle.
        </Alert>
      )}
    </AppShell>
  );
}
