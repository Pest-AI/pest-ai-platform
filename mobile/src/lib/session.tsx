/**
 * Session de l'app : compte connecté, espace actif, connexion / déconnexion.
 * Une session expirée (renouvellement refusé) ramène toujours à l'écran de connexion.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type * as React from "react";

import { NetworkError, SessionExpiredError } from "./api";
import { api } from "./client";
import { setOwner } from "./outbox";
import { clearParcelCache } from "./parcel-cache";
import type { Me } from "./types";

type Status = "loading" | "signedOut" | "signedIn";

type SessionValue = {
  status: Status;
  me: Me | null;
  workspace: string | null;
  /** Dernière erreur réseau au démarrage (session gardée, données non rafraîchies). */
  offline: boolean;
  signIn: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  chooseWorkspace: (workspace: string | null) => Promise<void>;
  reload: () => Promise<void>;
  /** À appeler quand un écran reçoit SessionExpiredError. */
  expire: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!(await api.hasSession())) {
      setStatus("signedOut");
      return;
    }
    try {
      const profile = await api.request<Me>("/api/v1/me/");
      await setOwner(profile.id); // saisies hors ligne rangées par compte
      const saved = await api.getWorkspace();
      const stillMember = profile.memberships.some((m) => m.workspace === saved && m.status === "active");
      setMe(profile);
      setWorkspace(stillMember ? saved : null);
      setOffline(false);
      setStatus("signedIn");
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        setMe(null);
        setStatus("signedOut");
      } else if (error instanceof NetworkError) {
        // Hors ligne au démarrage : on garde la session et l'espace choisi (données locales).
        setWorkspace(await api.getWorkspace());
        setOffline(true);
        setStatus("signedIn");
      } else {
        throw error;
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      me,
      workspace,
      offline,
      reload: load,
      async signIn(phone, password) {
        await api.login(phone, password);
        await load();
      },
      async signOut() {
        await api.logout();
        await clearParcelCache();
        setMe(null);
        setWorkspace(null);
        setStatus("signedOut");
      },
      async chooseWorkspace(next) {
        if (next) await api.setWorkspace(next);
        setWorkspace(next);
      },
      async expire() {
        await api.clearSession();
        await clearParcelCache();
        setMe(null);
        setWorkspace(null);
        setStatus("signedOut");
      },
    }),
    [status, me, workspace, offline, load],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession doit être utilisé dans SessionProvider.");
  return value;
}
