import { Redirect, useRouter } from "expo-router";
import { AlertTriangle, ArrowLeft, Check, CloudUpload, Clock, Link2 } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Alert, Button, Card, T } from "@/components/ui";
import { ApiError, NetworkError, SessionExpiredError } from "@/lib/api";
import { api } from "@/lib/client";
import { confirmAction } from "@/lib/confirm";
import { useOnline } from "@/lib/network";
import {
  type OutboxOp,
  dependentCount,
  discard,
  flush,
  problemDetail,
  problemLabel,
  replaceWithExisting,
  retryWith,
  useOutbox,
} from "@/lib/outbox";
import { freshness } from "@/lib/parcel-cache";
import { useSession } from "@/lib/session";
import { colors, radius } from "@/theme";

type Candidate = { id: string; display_name: string; locality: string; phone_hint: string; in_organization: boolean; can_attach: boolean };

const KIND_LABELS: Record<string, string> = {
  producer: "Producteur",
  parcel: "Parcelle",
  parcel_site: "Sol et eau",
  cultivation_unit: "Unité de culture",
  crop_cycle: "Cycle",
  crop_operation: "Opération",
  harvest: "Récolte",
};

/** Envois : saisies gardées sur le téléphone, envoyées, ou à reprendre. */
export default function SendsScreen() {
  const { status, workspace, expire } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const { ops, syncing } = useOutbox();
  const [message, setMessage] = useState<{ tone: "info" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (status === "signedOut") return <Redirect href="/connexion" />;
  if (!workspace) return <Redirect href="/espaces" />;

  const mine = ops.filter((o) => o.workspace === workspace);
  const problems = mine.filter((o) => o.status === "rejected" || o.status === "conflict");
  const pending = mine.filter((o) => o.status === "pending");
  const sent = mine.filter((o) => o.status === "applied").reverse().slice(0, 30);

  async function sendNow() {
    setMessage(null);
    const report = await flush(api);
    if (report.expired) return expire();
    if (report.offline) return setMessage({ tone: "info", text: "Toujours pas de réseau : les saisies partiront dès son retour." });
    if (report.error) return setMessage({ tone: "danger", text: report.error });
    const parts = [
      report.applied ? `${report.applied} envoyée${report.applied > 1 ? "s" : ""}` : "",
      report.problems ? `${report.problems} à reprendre` : "",
      report.waiting ? `${report.waiting} en attente` : "",
    ].filter(Boolean);
    setMessage({ tone: "info", text: parts.length ? parts.join(" · ") : "Rien à envoyer." });
  }

  async function run(id: string, action: () => Promise<void>) {
    setBusy(id);
    setMessage(null);
    try {
      await action();
      await sendNow();
    } catch (e) {
      if (e instanceof SessionExpiredError) return expire();
      setMessage({
        tone: "danger",
        text: e instanceof NetworkError ? "Cette action demande le réseau." : e instanceof ApiError ? e.message : "Une erreur est survenue.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function remove(op: OutboxOp) {
    const others = await dependentCount(op.id);
    confirmAction(
      "Retirer cette saisie ?",
      others
        ? `Elle sera effacée du téléphone, avec les ${others} saisie${others > 1 ? "s" : ""} qui en dépendent. Cette action est définitive.`
        : "Elle sera effacée du téléphone. Cette action est définitive.",
      "Retirer",
      () => void discard(op.id),
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 32, gap: 14 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/accueil"))} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={10} style={{ padding: 4 }}>
          <ArrowLeft size={24} color={colors.ink} />
        </Pressable>
        <T style={{ fontSize: 22, fontWeight: "700" }} accessibilityRole="header">
          Envois
        </T>
      </View>

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <CloudUpload size={20} color={colors.forest} />
          <T style={{ flex: 1, fontSize: 15, fontWeight: "700" }}>
            {pending.length
              ? `${pending.length} saisie${pending.length > 1 ? "s" : ""} en attente d'envoi`
              : problems.length
                ? "Rien en attente d'envoi"
                : "Tout est envoyé"}
          </T>
        </View>
        <T style={{ color: colors.muted, lineHeight: 20 }}>
          Les saisies faites sans réseau restent sur ce téléphone et partent toutes seules au retour du réseau. Une saisie
          n&apos;est jamais envoyée deux fois.
        </T>
        {pending.length ? (
          <Button
            label={syncing ? "Envoi en cours…" : "Envoyer maintenant"}
            onPress={() => void sendNow()}
            loading={syncing}
            disabled={!online}
          />
        ) : null}
        {!online && pending.length ? <T style={{ fontSize: 13, color: colors.warning }}>Hors ligne pour le moment.</T> : null}
      </Card>

      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      {problems.length ? (
        <View style={{ gap: 10 }}>
          <T style={styles.section}>À reprendre</T>
          {problems.map((op) => (
            <Card key={op.id} style={{ gap: 10, borderColor: "#F5C2BD" }}>
              <OpLine op={op} />
              <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                <AlertTriangle size={16} color={colors.danger} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T style={{ color: colors.danger, fontWeight: "700" }}>{problemLabel(op)}</T>
                  {op.status === "conflict" ? (
                    <T style={{ color: colors.muted, lineHeight: 20 }}>
                      Votre changement n&apos;a pas été appliqué pour ne pas écraser celui du bureau. Le conflit est
                      enregistré sur le serveur, avec les deux versions, pour être tranché.
                    </T>
                  ) : op.error_code !== "duplicate_candidates" ? (
                    <T style={{ color: colors.muted, lineHeight: 20 }}>{problemDetail(op)}</T>
                  ) : null}
                </View>
              </View>
              {op.error_code === "duplicate_candidates" ? (
                <DuplicateChoices
                  op={op}
                  busy={busy === op.id}
                  online={online}
                  onAttach={(c) =>
                    run(op.id, async () => {
                      await api.request("/api/v1/producers/attach/", {
                        method: "POST",
                        workspace,
                        body: {
                          producer_id: c.id,
                          relationship_type: "member",
                          membership_number: String(op.payload.membership_number ?? ""),
                        },
                      });
                      await replaceWithExisting(op.id, c.id);
                    })
                  }
                  onExisting={(c) => run(op.id, () => replaceWithExisting(op.id, c.id))}
                  onCreate={() => run(op.id, async () => void (await retryWith(op.id, { confirm_new: true })))}
                />
              ) : null}
              <Button
                label={op.status === "conflict" ? "Compris, retirer du téléphone" : "Retirer cette saisie"}
                variant="secondary"
                onPress={() => void remove(op)}
              />
            </Card>
          ))}
        </View>
      ) : null}

      {pending.length ? (
        <View style={{ gap: 10 }}>
          <T style={styles.section}>En attente</T>
          {pending.map((op) => (
            <Card key={op.id} style={{ gap: 6 }}>
              <OpLine op={op} />
            </Card>
          ))}
        </View>
      ) : null}

      {sent.length ? (
        <View style={{ gap: 10 }}>
          <T style={styles.section}>Envoyées (7 derniers jours)</T>
          {sent.map((op) => (
            <Card key={op.id} style={{ gap: 6 }}>
              <OpLine op={op} />
            </Card>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function OpLine({ op }: { op: OutboxOp }) {
  const result = (op.result ?? {}) as { agroid?: string; producer_code?: string; code?: string };
  const ref = op.status === "applied" ? result.agroid || result.producer_code || result.code : null;
  const Icon = op.status === "applied" ? Check : op.status === "pending" ? Clock : AlertTriangle;
  const tone = op.status === "applied" ? colors.success : op.status === "pending" ? colors.muted : colors.danger;
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <Icon size={18} color={tone} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontSize: 12, color: colors.muted }}>
          {KIND_LABELS[op.entity_type] ?? op.entity_type}
          {op.operation === "update" ? " · modification" : ""} · saisie {freshness(op.client_created_at)}
        </T>
        <T style={{ fontWeight: "700" }}>{op.label}</T>
        {ref ? (
          <T mono style={{ fontSize: 13, color: colors.forest }}>
            {ref}
          </T>
        ) : null}
      </View>
    </View>
  );
}

function DuplicateChoices({
  op,
  busy,
  online,
  onAttach,
  onExisting,
  onCreate,
}: {
  op: OutboxOp;
  busy: boolean;
  online: boolean;
  onAttach: (c: Candidate) => void;
  onExisting: (c: Candidate) => void;
  onCreate: () => void;
}) {
  const candidates = ((op.result ?? {}) as { candidates?: Candidate[] }).candidates ?? [];
  return (
    <View style={{ gap: 8 }}>
      <T style={{ color: colors.muted, lineHeight: 20 }}>
        Même téléphone, ou même nom dans la même localité. Vérifiez avec lui avant de créer une nouvelle fiche ; les saisies
        qui dépendent de ce producteur attendent votre choix.
      </T>
      {candidates.map((c) => (
        <View key={c.id} style={styles.candidate}>
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: "700" }}>{c.display_name}</T>
            <T style={{ color: colors.muted, fontSize: 13 }}>
              {[c.locality, c.phone_hint ? `tél. …${c.phone_hint}` : ""].filter(Boolean).join(" · ") || "Localité non renseignée"}
            </T>
          </View>
          {c.in_organization ? (
            <Button label="C'est lui" variant="secondary" onPress={() => onExisting(c)} loading={busy} />
          ) : c.can_attach ? (
            <Button
              label="Rattacher"
              variant="secondary"
              icon={<Link2 size={16} color={colors.forest} />}
              onPress={() => onAttach(c)}
              loading={busy}
              disabled={!online}
            />
          ) : null}
        </View>
      ))}
      <Button label="Ce n'est pas lui : créer une nouvelle fiche" variant="secondary" onPress={onCreate} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  candidate: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: radius.sm, backgroundColor: colors.subtle },
});
