import { Building2, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";
import { getApi } from "@/lib/api/client";
import { ORGANIZATION_TYPE_LABELS, ROLE_LABELS } from "@/lib/spaces";

export const metadata: Metadata = { title: "Choisir un espace" };

export default async function WorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const api = await getApi();
  const { data: me, response } = await api.GET("/api/v1/me/");
  if (response.status === 401 || !me) redirect("/connexion?erreur=session");

  const memberships = me.memberships.filter((m) => m.status === "active");

  return (
    <>
      <AppHeader userName={`${me.first_name} ${me.last_name}`} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-forest">Bonjour {me.first_name}</h1>
        <p className="mt-1 text-muted">Choisissez l&apos;organisation dans laquelle vous travaillez.</p>

        <div className="mt-6 space-y-4">
          {erreur === "acces" ? (
            <Alert>Vous n&apos;avez plus accès à cet espace. Choisissez-en un autre.</Alert>
          ) : null}
          {erreur === "espace" ? <Alert>Espace invalide.</Alert> : null}
        </div>

        {memberships.length === 0 ? (
          <Card className="mt-6">
            <CardTitle>Aucun espace pour le moment</CardTitle>
            <p className="mt-2 text-sm text-muted">
              Vous n&apos;êtes membre actif d&apos;aucune organisation. Si vous avez reçu une invitation, elle
              apparaîtra ici une fois acceptée.
            </p>
          </Card>
        ) : (
          <ul className="mt-6 space-y-3">
            {memberships.map((m) => (
              <li key={m.id}>
                <form action="/api/session/workspace" method="post">
                  <input type="hidden" name="workspace" value={m.workspace} />
                  <button
                    type="submit"
                    className="flex w-full items-center gap-4 rounded-2xl border border-line bg-white p-5 text-left shadow-sm transition-colors hover:border-leaf hover:bg-leaf-light"
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-leaf-light text-forest">
                      <Building2 className="size-6" aria-hidden />
                    </span>
                    <span className="flex-1">
                      <span className="block font-bold text-night">{m.organization_name}</span>
                      <span className="block text-sm text-muted">
                        {ORGANIZATION_TYPE_LABELS[m.organization_type] ?? m.organization_type} ·{" "}
                        {m.roles.map((r) => ROLE_LABELS[r] ?? r).join(", ") || "Membre"}
                      </span>
                    </span>
                    <ChevronRight className="size-5 text-muted" aria-hidden />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
