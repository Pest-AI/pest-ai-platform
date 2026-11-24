/** Composants de base de l'app mobile, aux couleurs et polices du Web OS. */
import type * as React from "react";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  View,
  type ViewProps,
} from "react-native";

import { colors, fonts, radius } from "@/theme";

export function T({ style, mono, ...props }: TextProps & { mono?: boolean }) {
  return <Text {...props} style={[{ fontFamily: mono ? fonts.mono : fonts.sans, color: colors.ink }, style]} />;
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  label,
  variant = "primary",
  loading,
  icon,
  disabled,
  style,
  ...props
}: PressableProps & { label: string; variant?: Variant; loading?: boolean; icon?: React.ReactNode }) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      style={(state) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border },
        (state.pressed || disabled || loading) && { opacity: 0.75 },
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : icon}
      <T style={[styles.buttonLabel, { color: v.fg }]}>{label}</T>
    </Pressable>
  );
}

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.forest, fg: "#fff", border: colors.forest },
  secondary: { bg: colors.canvas, fg: colors.ink, border: colors.lineStrong },
  ghost: { bg: "transparent", fg: colors.forest, border: "transparent" },
  danger: { bg: colors.danger, fg: "#fff", border: colors.danger },
};

export type InputRef = React.ComponentRef<typeof TextInput>;

export function Input({
  icon,
  prefix,
  end,
  invalid,
  style,
  ref,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & {
  icon?: React.ReactNode;
  prefix?: string;
  end?: React.ReactNode;
  invalid?: boolean;
  ref?: React.Ref<InputRef>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && { borderColor: colors.forest }, invalid && { borderColor: colors.danger }]}>
      {icon ? <View style={styles.fieldIcon}>{icon}</View> : null}
      {prefix ? <T style={styles.prefix}>{prefix}</T> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.muted}
        style={[styles.input, { fontFamily: fonts.sans }, style]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...props}
      />
      {end}
    </View>
  );
}

export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />;
}

export function Alert({ tone = "danger", children }: { tone?: "danger" | "info" | "warning"; children: React.ReactNode }) {
  const palette = {
    danger: { bg: colors.dangerBg, fg: colors.danger },
    info: { bg: colors.brand50, fg: colors.forest },
    warning: { bg: colors.warningBg, fg: colors.warning },
  }[tone];
  return (
    <View accessibilityRole="alert" style={[styles.alert, { backgroundColor: palette.bg }]}>
      <T style={{ color: palette.fg, fontSize: 14, lineHeight: 20 }}>{children}</T>
    </View>
  );
}

export function Avatar({ initials, size = 40, dark }: { initials: string; size?: number; dark?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: dark ? colors.night : colors.brand50,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <T style={{ fontSize: size * 0.32, fontWeight: "700", color: dark ? "#fff" : colors.forest }}>{initials}</T>
    </View>
  );
}

export function StatusPill({ tone, label }: { tone: "success" | "warning" | "neutral"; label: string }) {
  const p = {
    success: { bg: colors.brand50, fg: colors.success, dot: colors.leaf },
    warning: { bg: colors.warningBg, fg: colors.warning, dot: colors.gold },
    neutral: { bg: colors.subtle, fg: colors.muted, dot: colors.lineStrong },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: p.bg }]}>
      <View style={[styles.dot, { backgroundColor: p.dot }]} />
      <T style={{ color: p.fg, fontSize: 12, fontWeight: "700" }}>{label}</T>
    </View>
  );
}

export function initialsOf(first: string, last: string) {
  return `${first.trim().charAt(0)}${last.trim().charAt(0)}`.toUpperCase() || "?";
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonLabel: { fontSize: 16, fontWeight: "700" },
  field: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.canvas,
    flexDirection: "row",
    alignItems: "center",
  },
  fieldIcon: { paddingLeft: 14 },
  prefix: { paddingLeft: 10, fontSize: 16, color: colors.ink, fontWeight: "700" },
  input: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.ink,
    // Web : le cadre du champ porte déjà le focus visuel.
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
  },
  card: {
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
  },
  alert: { borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, height: 24 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
