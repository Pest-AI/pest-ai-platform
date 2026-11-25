import { useRouter } from "expo-router";
import { AlertTriangle, ChevronRight, CloudUpload } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";

import { T } from "@/components/ui";
import { useOutbox } from "@/lib/outbox";
import { colors, radius } from "@/theme";

/** Saisies pas encore envoyées, ou à reprendre : lien vers l'écran « Envois ». */
export function SyncStrip({ workspace }: { workspace: string }) {
  const router = useRouter();
  const { ops, syncing } = useOutbox();
  const mine = ops.filter((o) => o.workspace === workspace);
  const pending = mine.filter((o) => o.status === "pending").length;
  const problems = mine.filter((o) => o.status === "rejected" || o.status === "conflict").length;
  if (!pending && !problems) return null;
  const warn = problems > 0;
  const text = [
    pending ? `${pending} saisie${pending > 1 ? "s" : ""} ${syncing ? "en cours d'envoi" : "en attente d'envoi"}` : "",
    problems ? `${problems} à reprendre` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      onPress={() => router.push("/envois")}
      accessibilityRole="button"
      accessibilityLabel={`${text}. Voir les envois`}
      style={[styles.strip, warn ? styles.warn : styles.info]}
    >
      {warn ? <AlertTriangle size={18} color={colors.danger} /> : <CloudUpload size={18} color={colors.forest} />}
      <T style={{ flex: 1, fontSize: 14, fontWeight: "700", color: warn ? colors.danger : colors.forest }}>{text}</T>
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1 },
  info: { backgroundColor: colors.brand50, borderColor: "#CFE6D3" },
  warn: { backgroundColor: colors.dangerBg, borderColor: "#F5C2BD" },
});
