import * as Linking from "expo-linking";
import { Redirect, useRouter } from "expo-router";
import { ChevronRight, MapPin, Phone, Search, UserPlus, UsersRound } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SpaceHeader } from "@/components/space-header";
import { Alert, Avatar, Button, Input, T, initialsOf } from "@/components/ui";
import { ApiError, NetworkError, SessionExpiredError } from "@/lib/api";
import { api } from "@/lib/client";
import { TYPE_LABELS, roleLabel } from "@/lib/labels";
import { formatPhone } from "@/lib/phone";
import { useSession } from "@/lib/session";
import type { Organization, Paginated, Producer, WorkspaceContext } from "@/lib/types";
import { colors, radius } from "@/theme";

/** Producteurs de l'espace : registre (lecture), recherche, appel direct. */
export default function ProducersScreen() {
  const { status, me, workspace, expire } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [org, setOrg] = useState<Organization | null>(null);
  const [canView, setCanView] = useState<boolean | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [items, setItems] = useState<Producer[]>([]);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handle = useCallback(
    async (e: unknown) => {
      if (e instanceof SessionExpiredError) return expire();
      setError(e instanceof NetworkError || e instanceof ApiError ? e.message : "Une erreur est survenue.");
    },
    [expire],
  );

  const loadPage = useCallback(
    async (page: number, q: string) => {
      const data = await api.request<Paginated<Producer>>("/api/v1/producers/", {
        workspace,
        query: { page, q: q || undefined },
      });
      setCount(data.count);
      setNext(data.next ? page + 1 : null);
      setItems((prev) => (page === 1 ? data.results : [...prev, ...data.results]));
    },
    [workspace],
  );

  const load = useCallback(
    async (q = query) => {
      if (!workspace) return;
      setError(null);
      setLoading(true);
      try {
        const [organization, context] = await Promise.all([
          api.request<Organization>("/api/v1/organization/", { workspace }),
          api.request<WorkspaceContext>("/api/v1/workspace/", { workspace }),
        ]);
        setOrg(organization);
        const allowed = context.permissions.includes("producers.view");
        setCanView(allowed);
        setCanCreate(context.permissions.includes("producers.create"));
        if (allowed) await loadPage(1, q);
      } catch (e) {
        await handle(e);
      } finally {
        setLoading(false);
      }
    },
    [workspace, query, loadPage, handle],
  );

  useEffect(() => {
    void load("");
    // Chargement initial uniquement ; la recherche relance `load` elle-même.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  if (status === "signedOut") return <Redirect href="/connexion" />;
  if (!workspace) return <Redirect href="/espaces" />;

  const membership = me?.memberships.find((m) => m.workspace === workspace);

  function onSearch(text: string) {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => void load(text.trim()), 350);
  }

  async function more() {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    try {
      await loadPage(next, query.trim());
    } catch (e) {
      await handle(e);
    } finally {
      setLoadingMore(false);
    }
  }

  const header = (
    <View>
      <SpaceHeader
        scopeName={org?.short_name || org?.name || membership?.organization_name || "…"}
        title="Producteurs"
        subtitle={`${TYPE_LABELS[org?.organization_type ?? ""] ?? ""} · ${roleLabel(membership?.roles ?? [])}`}
      />

      <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
        <View style={styles.stat}>
          <T style={styles.statLabel}>Producteurs rattachés</T>
          <T mono style={styles.statValue}>
            {canView === false ? "—" : count}
          </T>
        </View>

        {canCreate ? (
          <View style={{ marginTop: 14 }}>
            <Button label="Enrôler un producteur" icon={<UserPlus size={18} color="#fff" />} onPress={() => router.push("/producteurs/nouveau")} />
          </View>
        ) : null}

        {error ? (
          <View style={{ marginTop: 14, gap: 10 }}>
            <Alert>{error}</Alert>
            <Button label="Réessayer" variant="secondary" onPress={() => load()} />
          </View>
        ) : null}

        {canView ? (
          <View style={{ marginTop: 14 }}>
            <Input
              icon={<Search size={18} color={colors.muted} />}
              placeholder="Nom, village, téléphone, n° d'adhérent"
              value={query}
              onChangeText={onSearch}
              accessibilityLabel="Rechercher un producteur"
              returnKeyType="search"
              autoCorrect={false}
            />
          </View>
        ) : null}
        {canView === false ? (
          <View style={{ marginTop: 14 }}>
            <Alert tone="info">Le registre des producteurs n&apos;est pas accessible avec votre rôle.</Alert>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.surface }}
      data={canView ? items : []}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      refreshControl={<RefreshControl refreshing={loading && items.length > 0} onRefresh={() => load()} tintColor={colors.forest} />}
      onEndReached={more}
      onEndReachedThreshold={0.4}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListHeaderComponentStyle={{ marginBottom: 14 }}
      renderItem={({ item: p }) => (
        <Pressable
          onPress={() => router.push(`/producteurs/${p.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`${p.first_name} ${p.last_name}`}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.subtle }]}
        >
          <Avatar initials={initialsOf(p.first_name, p.last_name)} size={44} />
          <View style={{ flex: 1 }}>
            <T style={{ fontSize: 16, fontWeight: "700" }} numberOfLines={1}>
              {p.first_name} {p.last_name}
            </T>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
              <MapPin size={13} color={colors.muted} />
              <T style={{ fontSize: 13, color: colors.muted, flexShrink: 1 }} numberOfLines={1}>
                {p.locality_text || "Village non renseigné"}
                {p.assignment?.membership_number ? ` · ${p.assignment.membership_number}` : ""}
              </T>
            </View>
          </View>
          {p.phone_number ? (
            <Pressable
              onPress={() => Linking.openURL(`tel:${p.phone_number}`)}
              accessibilityRole="button"
              accessibilityLabel={`Appeler ${formatPhone(p.phone_number)}`}
              hitSlop={8}
              style={styles.call}
            >
              <Phone size={18} color={colors.forest} />
            </Pressable>
          ) : null}
          <ChevronRight size={18} color={colors.muted} />
        </Pressable>
      )}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={colors.forest} style={{ marginTop: 24 }} />
        ) : canView && !error ? (
          <View style={styles.empty}>
            <UsersRound size={28} color={colors.forest} />
            <T style={{ fontSize: 16, fontWeight: "700", marginTop: 10 }}>
              {query ? `Aucun résultat pour « ${query} »` : "Aucun producteur pour le moment"}
            </T>
            {!query ? (
              <T style={{ fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 4 }}>
                L&apos;enregistrement depuis le téléphone arrive avec le mode hors ligne.
              </T>
            ) : null}
          </View>
        ) : undefined
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.forest} style={{ marginTop: 16 }} /> : undefined}
    />
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: "700", marginTop: 2 },
  stat: {
    marginTop: 14,
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  statLabel: { fontSize: 12, color: colors.muted, fontWeight: "700" },
  statValue: { fontSize: 26, marginTop: 6 },
  row: {
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
  },
  call: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand50,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    marginHorizontal: 16,
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
});
