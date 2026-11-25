/**
 * Données de l'espace actif, avec ou sans réseau : nom, droits, parcelles (copie locale d'abord,
 * puis mise à jour si elle date de plus de 10 minutes), et copies utiles au terrain
 * (producteurs, listes des formulaires). Partagé par l'accueil et l'onglet Parcelles.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, NetworkError, SessionExpiredError } from "./api";
import { api } from "./client";
import { loadCropReferentials, syncProducers } from "./field-data";
import { useOnline } from "./network";
import { cachedGet, cachedOnly } from "./offline-cache";
import { useOutbox } from "./outbox";
import { type ParcelSnapshot, isStale, loadSnapshot, syncParcels } from "./parcel-cache";
import { useSession } from "./session";
import type { Organization, WorkspaceContext } from "./types";

export function useSpaceData() {
  const { workspace, expire } = useSession();
  const online = useOnline();
  const [org, setOrg] = useState<Organization | null>(null);
  const [canView, setCanView] = useState<boolean | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [snapshot, setSnapshot] = useState<ParcelSnapshot | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [permissions, setPermissions] = useState<string[]>([]);

  const applyPermissions = useCallback((context: WorkspaceContext) => {
    const allowed = context.permissions.some((c) => c === "parcels.view" || c === "personal.parcels.view");
    setCanView(allowed);
    setCanCreate(context.permissions.some((c) => c === "parcels.create" || c === "personal.parcels.register"));
    setPermissions(context.permissions);
    return allowed;
  }, []);

  const sync = useCallback(async () => {
    if (!workspace) return;
    setSyncing(true);
    setError(null);
    try {
      const [{ data: organization }, { data: context }] = await Promise.all([
        cachedGet<Organization>(api, "/api/v1/organization/", { workspace }),
        cachedGet<WorkspaceContext>(api, "/api/v1/workspace/", { workspace }),
      ]);
      setOrg(organization);
      const allowed = applyPermissions(context);
      if (allowed) {
        setSnapshot(await syncParcels(api, workspace, new Date(), organization.short_name || organization.name));
      }
      // Producteurs gardés pour choisir l'exploitant hors ligne (sans bloquer l'accueil).
      if (context.permissions.includes("producers.view")) void syncProducers(api, workspace).catch(() => undefined);
      // Listes des formulaires terrain (cultures, campagnes, sol et eau) gardées pour le hors-ligne.
      void loadCropReferentials(api, workspace).catch(() => undefined);
      void cachedGet(api, "/api/v1/parcels/site-referentials/", { workspace }).catch(() => undefined);
      setNow(new Date());
    } catch (e) {
      if (e instanceof SessionExpiredError) return expire();
      setError(
        e instanceof NetworkError
          ? "Pas de réseau : les parcelles affichées sont celles de la dernière mise à jour."
          : e instanceof ApiError
            ? e.message
            : "Une erreur est survenue.",
      );
    } finally {
      setSyncing(false);
    }
  }, [workspace, expire, applyPermissions]);

  // Copie locale d'abord (hors ligne), puis mise à jour si elle date de plus de 10 minutes.
  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;
    // Droits et nom de l'espace gardés : l'enrôlement reste possible hors ligne.
    void cachedOnly<WorkspaceContext>("/api/v1/workspace/", { workspace }).then((c) => {
      if (!cancelled && c) applyPermissions(c);
    });
    void cachedOnly<Organization>("/api/v1/organization/", { workspace }).then((o) => {
      if (!cancelled && o) setOrg(o);
    });
    void loadSnapshot(workspace).then((cached) => {
      if (cancelled) return;
      if (cached) {
        setSnapshot(cached);
        setCanView(true);
      }
      if (!cached || isStale(cached.synced_at)) void sync();
    });
    return () => {
      cancelled = true;
    };
  }, [workspace, sync, applyPermissions]);

  // Saisies terrain envoyées : la liste des parcelles est remise à jour.
  const { ops } = useOutbox();
  const appliedCount = ops.filter((o) => o.workspace === workspace && o.status === "applied").length;
  const seenApplied = useRef<number | null>(null);
  useEffect(() => {
    if (seenApplied.current !== null && appliedCount > seenApplied.current && online) void sync();
    seenApplied.current = appliedCount;
  }, [appliedCount, online, sync]);

  // Fraîcheur affichée : rafraîchie chaque minute.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return { org, canView, canCreate, snapshot, syncing, error, sync, now, permissions };
}
