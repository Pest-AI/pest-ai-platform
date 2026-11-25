import { ArrowLeft, ArrowRight, X } from "lucide-react-native";
import type * as React from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, T } from "@/components/ui";
import { colors, radius } from "@/theme";

export const ENROLMENT_STEPS = ["Producteur", "Contour", "Foncier", "Sol et eau", "Mesures du sol", "Récapitulatif"] as const;

/**
 * Cadre d'une étape de l'enrôlement : en-tête (retour, étape, barre de progression), contenu
 * défilant, boutons en bas d'écran toujours visibles (pouce).
 */
export function StepShell({
  step,
  title,
  hint,
  onBack,
  onClose,
  next,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  onBack: () => void;
  onClose: () => void;
  next: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
    /** Pourquoi le bouton est grisé, affiché au-dessus. */
    reason?: string | null;
    secondary?: { label: string; onPress: () => void } | null;
  };
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <View style={styles.bar}>
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={step === 0 ? "Quitter" : "Étape précédente"} hitSlop={10} style={styles.icon}>
            <ArrowLeft size={24} color={colors.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T style={{ fontSize: 12, color: colors.muted }}>
              Enrôlement · étape {step + 1} sur {ENROLMENT_STEPS.length}
            </T>
            <T style={{ fontSize: 20, fontWeight: "700" }} accessibilityRole="header" numberOfLines={1}>
              {title}
            </T>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer l'enrôlement" hitSlop={10} style={styles.icon}>
            <X size={22} color={colors.muted} />
          </Pressable>
        </View>
        <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: ENROLMENT_STEPS.length, now: step + 1 }}>
          {ENROLMENT_STEPS.map((s, i) => (
            <View key={s} style={[styles.segment, i <= step && { backgroundColor: i === step ? colors.forest : colors.leaf }]} />
          ))}
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }}>
        {hint ? <T style={{ color: colors.muted, lineHeight: 20 }}>{hint}</T> : null}
        {children}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {next.disabled && next.reason ? (
          <T style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>{next.reason}</T>
        ) : null}
        <View style={{ flexDirection: "row", gap: 10 }}>
          {next.secondary ? (
            <Button style={{ flex: 1 }} variant="secondary" label={next.secondary.label} onPress={next.secondary.onPress} />
          ) : null}
          <Button
            style={{ flex: next.secondary ? 1.4 : 1 }}
            label={next.label}
            icon={next.icon ?? <ArrowRight size={18} color="#fff" />}
            disabled={next.disabled}
            loading={next.loading}
            onPress={next.onPress}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: { backgroundColor: colors.canvas, borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 12, paddingBottom: 12, gap: 10 },
  bar: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { padding: 6 },
  progress: { flexDirection: "row", gap: 6, paddingHorizontal: 4 },
  segment: { flex: 1, height: 5, borderRadius: radius.sm, backgroundColor: colors.line },
  footer: { backgroundColor: colors.canvas, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 16, paddingTop: 12, gap: 8 },
});
