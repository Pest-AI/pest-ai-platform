import { ChevronDown, Search, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/components/ui";
import { COUNTRIES, type Country } from "@/lib/countries";
import { findCountry, flag, lengthHint } from "@/lib/phone";
import { colors, fonts, radius } from "@/theme";

function plain(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Numéro de téléphone avec choix du pays (drapeau + indicatif), Sénégal par défaut.
 * La liste se cherche par nom de pays ou par indicatif (« mali », « 223 »).
 */
export function PhoneInput({
  country,
  onCountryChange,
  value,
  onChangeText,
  onSubmitEditing,
  autoFocus,
}: {
  country: string;
  onCountryChange: (iso: string) => void;
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const current = findCountry(country);
  const hint = lengthHint(current, value);

  const list = useMemo(() => {
    const q = plain(query.trim()).replace(/^\+/, "");
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => plain(c.name).includes(q) || c.dial.startsWith(q) || c.iso.toLowerCase() === q);
  }, [query]);

  const choose = (c: Country) => {
    onCountryChange(c.iso);
    setOpen(false);
    setQuery("");
  };

  return (
    <View>
      <View style={[styles.field, focused && { borderColor: colors.forest }]}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Pays : ${current.name}, indicatif +${current.dial}. Changer de pays`}
          style={styles.country}
          hitSlop={6}
        >
          <T style={{ fontSize: 20 }}>{flag(current.iso)}</T>
          <T style={styles.dial}>+{current.dial}</T>
          <ChevronDown size={14} color={colors.muted} />
        </Pressable>
        <TextInput
          accessibilityLabel="Numéro de téléphone"
          placeholder={current.iso === "SN" ? "77 123 45 67" : current.length ? `${current.length} chiffres` : "Numéro"}
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          value={value}
          onChangeText={onChangeText}
          returnKeyType="next"
          onSubmitEditing={onSubmitEditing}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, { fontFamily: fonts.sans }]}
        />
      </View>
      {hint ? <T style={styles.hint}>{hint}</T> : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top + 8 }}>
          <View style={styles.header}>
            <T style={{ fontSize: 20, fontWeight: "700", flex: 1 }} accessibilityRole="header">
              Choisir le pays
            </T>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={10}>
              <X size={24} color={colors.ink} />
            </Pressable>
          </View>
          <View style={styles.search}>
            <Search size={18} color={colors.muted} />
            <TextInput
              accessibilityLabel="Rechercher un pays"
              placeholder="Pays ou indicatif"
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              autoFocus
              style={[styles.input, { fontFamily: fonts.sans }]}
            />
          </View>
          <FlatList
            data={list}
            keyExtractor={(c) => c.iso}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            initialNumToRender={20}
            renderItem={({ item, index }) => (
              <>
                {!query && index === 0 ? <T style={styles.group}>Afrique de l&apos;Ouest</T> : null}
                <Pressable
                  onPress={() => choose(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.iso === current.iso }}
                  style={({ pressed }) => [styles.row, item.iso === current.iso && { backgroundColor: colors.brand50 }, pressed && { opacity: 0.7 }]}
                >
                  <T style={{ fontSize: 22 }}>{flag(item.iso)}</T>
                  <T style={{ flex: 1, fontSize: 16 }}>{item.name}</T>
                  <T mono style={{ color: colors.muted }}>
                    +{item.dial}
                  </T>
                </Pressable>
              </>
            )}
            ListEmptyComponent={<T style={{ padding: 22, color: colors.muted }}>Aucun pays trouvé.</T>}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    height: 54,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    backgroundColor: colors.canvas,
    overflow: "hidden",
  },
  country: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: "100%",
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  dial: { fontSize: 15, fontWeight: "600" },
  input: { flex: 1, height: "100%", paddingHorizontal: 12, fontSize: 16, color: colors.ink },
  hint: { marginTop: 4, fontSize: 12, color: colors.muted },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingLeft: 12,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  group: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6, fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 13 },
});
