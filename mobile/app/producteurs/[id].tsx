import * as Linking from "expo-linking";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, CalendarDays, Fingerprint, Languages, MapPin, MessageCircle, Phone, User } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Alert, Avatar, Button, StatusPill, T, initialsOf } from "@/components/ui";
import { ApiError, NetworkError, SessionExpiredError } from "@/lib/api";
import { api } from "@/lib/client";
import { LANGUAGE_LABELS, RELATIONSHIP_LABELS, SEX_LABELS } from "@/lib/labels";
import { formatPhone } from "@/lib/phone";
import { useSession } from "@/lib/session";
import type { Producer } from "@/lib/types";
import { colors, radius } from "@/theme";

function formatDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Fiche producteur (lecture) : identité, contacts (appel direct), rattachement. */
export default function ProducerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, workspace, expire } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [producer, setProducer] = useState<Producer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspace || !id) return;
    setError(null);
    try {
      setProducer(await api.request<Producer>(`/api/v1/producers/${id}/`, { workspace }));
    } catch (e) {
      if (e instanceof SessionExpiredError) return expire();
      if (e instanceof ApiError && e.status === 404) setError("Ce producteur n'est pas (ou plus) rattaché à votre organisation.");
      else setError(e instanceof NetworkError || e instanceof ApiError ? e.message : "Une erreur est survenue.");
    }
  }, [workspace, id, expire]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "signedOut") return <Redirect href="/connexion" />;
  if (!workspace) return <Redirect href="/espaces" />;

  const p = producer;
  const year = p?.birth_year ? new Date().getFullYear() - p.birth_year : null;
  const facts: [typeof User, string, string][] = p
    ? [
        [User, "Sexe", p.sex ? (SEX_LABELS[p.sex] ?? p.sex) : "Non renseigné"],
        [CalendarDays, "Année de naissance", p.birth_year ? `${p.birth_year} (≈ ${year} ans)` : "Non renseignée"],
        [MapPin, "Village ou commune", p.locality_text || "Non renseigné"],
        [Languages, "Langue préférée", LANGUAGE_LABELS[p.preferred_language ?? "fr"] ?? "Français"],
      ]
    : [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={10} style={styles.back}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <T style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Fiche producteur</T>
      </View>

      {error ? (
        <View style={{ padding: 16, gap: 10 }}>
          <Alert>{error}</Alert>
          <Button label="Réessayer" variant="secondary" onPress={load} />
        </View>
      ) : !p ? (
        <ActivityIndicator color={colors.forest} style={{ marginTop: 32 }} />
      ) : (
        <View style={{ padding: 16, gap: 12 }}>
          <View style={[styles.card, { alignItems: "center", paddingVertical: 22 }]}>
            <Avatar initials={initialsOf(p.first_name, p.last_name)} size={72} />
            <T style={{ fontSize: 24, fontWeight: "700", marginTop: 12, textAlign: "center" }}>
              {p.first_name} {p.last_name}
            </T>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <StatusPill tone={p.status === "active" ? "success" : "neutral"} label={p.status === "active" ? "Actif" : "Inactif"} />
              <StatusPill tone="neutral" label={RELATIONSHIP_LABELS[p.assignment?.relationship_type ?? "member"] ?? "Membre"} />
            </View>
            {p.assignment?.membership_number ? (
              <T mono style={{ marginTop: 10, color: colors.forest, fontSize: 14 }}>
                N° {p.assignment.membership_number}
              </T>
            ) : null}
          </View>

          <View style={styles.card}>
            <T style={styles.h2}>Identité</T>
            {facts.map(([Icon, label, value]) => (
              <View key={label} style={styles.fact}>
                <Icon size={18} color={colors.muted} />
                <View>
                  <T style={{ fontSize: 12, color: colors.muted }}>{label}</T>
                  <T style={{ fontSize: 15, fontWeight: "700" }}>{value}</T>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <T style={styles.h2}>Contacts</T>
            {p.contacts.length === 0 ? (
              <T style={{ color: colors.muted, marginTop: 6 }}>Aucun contact enregistré.</T>
            ) : (
              p.contacts.map((c) => {
                const phoneLike = c.contact_type === "phone" || c.contact_type === "whatsapp";
                return (
                  <Pressable
                    key={c.id}
                    disabled={!phoneLike}
                    onPress={() =>
                      Linking.openURL(
                        c.contact_type === "whatsapp" ? `https://wa.me/${c.value.replace(/^\+/, "")}` : `tel:${c.value}`,
                      )
                    }
                    accessibilityRole={phoneLike ? "button" : undefined}
                    style={styles.contact}
                  >
                    <View style={styles.contactIcon}>
                      {c.contact_type === "whatsapp" ? (
                        <MessageCircle size={18} color={colors.forest} />
                      ) : (
                        <Phone size={18} color={colors.forest} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <T mono style={{ fontSize: 15 }}>
                        {phoneLike ? formatPhone(c.value) : c.value}
                      </T>
                      <T style={{ fontSize: 12, color: colors.muted }}>
                        {c.is_primary ? "Principal · " : ""}
                        {phoneLike ? "Toucher pour appeler" : c.contact_type}
                      </T>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>

          <View style={styles.card}>
            <T style={styles.h2}>Rattachement</T>
            {p.history.map((a) => (
              <View key={a.id} style={styles.fact}>
                <View style={[styles.dot, { borderColor: a.is_active ? colors.leaf : colors.lineStrong }]} />
                <View>
                  <T style={{ fontSize: 15, fontWeight: "700" }}>
                    {RELATIONSHIP_LABELS[a.relationship_type ?? "member"]} {a.is_active ? "· en cours" : ""}
                  </T>
                  <T mono style={{ fontSize: 13, color: colors.muted }}>
                    Depuis le {formatDate(a.start_date)}
                    {a.end_date ? ` · jusqu'au ${formatDate(a.end_date)}` : ""}
                  </T>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 12, borderStyle: "dashed" }]}>
            <View style={[styles.contactIcon, { backgroundColor: colors.warningBg }]}>
              <Fingerprint size={20} color={colors.warning} />
            </View>
            <T style={{ flex: 1, color: colors.muted, fontSize: 14 }}>
              Les parcelles AgroID de ce producteur apparaîtront ici avec le registre cartographique.
            </T>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  top: {
    backgroundColor: colors.forest,
    paddingHorizontal: 12,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: colors.canvas, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16 },
  h2: { fontSize: 17, fontWeight: "700", marginBottom: 4 },
  fact: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  contact: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brand50,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, backgroundColor: colors.canvas, marginLeft: 2 },
});
