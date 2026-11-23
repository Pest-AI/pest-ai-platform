import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { Card, CardTitle } from "@/components/ui/card";
import { currentWorkspace, getApi } from "@/lib/api/client";
import { ORGANIZATION_TYPE_LABELS, ROLE_LABELS, SPACES, spacesForRoles } from "@/lib/spaces";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function DashboardPage() {
  const workspace = await currentWorkspace();
  if (!workspace) redirect("/espaces");

  const api = await getApi();
  const [{ data: me }, orgResult] = await Promise.all([
    api.GET("/api/v1/me/"),
    api.GET("/api/v1/organization/", { params: { header: { "X-Workspace": workspace } } }),
  ]);
  if (!me) redirect("/connexion?erreur=session");
  if (orgResult.response.status === 403 || orgResult.response.status === 400 || !orgResult.data) {
    redirect("/espaces?erreur=acces");
  }

  const org = orgResult.data;
  const membership = me.memberships.find((m) => m.workspace === workspace);
  const roles = membership?.roles ?? [];
  const spaces = spacesForRoles(roles);

  return (
    <>
      <AppHeader userName={`${me.first_name} ${me.last_name}`} />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-leaf">
              {ORGANIZATION_TYPE_LABELS[org.organization_type] ?? org.organization_type}
            </p>
            <h1 className="text-3xl font-bold text-forest">{org.name}</h1>
            <p className="mt-1 text-muted">
              Vos rôles : {roles.map((r) => ROLE_LABELS[r] ?? r).join(", ") || "membre"}
            </p>
          </div>
          <Link href="/espaces" className="text-sm font-semibold text-leaf hover:underline">
            Changer d&apos;espace
          </Link>
        </div>

        <h2 className="mt-10 text-lg font-bold text-night">Vos espaces</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.length === 0 ? (
            <Card>
              <CardTitle>Application mobile</CardTitle>
              <p className="mt-2 text-sm text-muted">
                Vos rôles s&apos;utilisent sur l&apos;application mobile PEST AI (agents de terrain, producteurs).
              </p>
            </Card>
          ) : (
            spaces.map((key) => (
              <Card key={key} className="border-t-4 border-t-sun">
                <CardTitle>{SPACES[key].label}</CardTitle>
                <p className="mt-2 text-sm text-muted">{SPACES[key].description}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Bientôt disponible</p>
              </Card>
            ))
          )}
        </div>
      </main>
    </>
  );
}
