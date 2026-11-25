import { Check, Search, UserPlus, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Chips } from "@/components/chips";
import { PhoneInput } from "@/components/phone-input";
import { Avatar, Card, Input, T, initialsOf } from "@/components/ui";
import { api } from "@/lib/client";
import { type PickedProducer, searchProducers } from "@/lib/field-data";
import { SEX_LABELS } from "@/lib/labels";
import { DEFAULT_COUNTRY } from "@/lib/phone";
import { colors, radius } from "@/theme";

export type NewProducer = {
  first: string;
  last: string;
  sex: string;
  locality: string;
  country: string;
  phone: string;
  membership: string;
};

export const EMPTY_PRODUCER = (country: string): NewProducer => ({
  first: "",
  last: "",
  sex: "unspecified",
  locality: "",
  country,
  phone: "",
  membership: "",
});

/** Étape « Producteur » : retrouver l'exploitant (en ligne ou dans la copie du téléphone), ou l'enrôler. */
export function ProducerStep({
  workspace,
  picked,
  onPick,
  draft,
  onDraft,
  proposedNumber,
}: {
  workspace: string;
  picked: PickedProducer | null;
  onPick: (p: PickedProducer | null) => void;
  draft: NewProducer | null;
  onDraft: (p: NewProducer | null) => void;
  proposedNumber: string | null;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PickedProducer[]>([]);
  const [searched, setSearched] = useState(false);
  useEffect(() => {
    if (picked || draft || q.trim().length < 2) return;
    const t = setTimeout(() => {
      searchProducers(api, workspace, q)
        .then((r) => {
          setItems(r);
          setSearched(true);
        })
        .catch(() => setItems([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q, picked, draft, workspace]);

  if (picked) {
    return (
      <Card style={styles.picked}>
        <Avatar initials={initialsOf(picked.first_name, picked.last_name)} size={48} />
        <View style={{ flex: 1 }}>
          <T style={{ fontSize: 17, fontWeight: "700" }}>
            {picked.first_name} {picked.last_name}
          </T>
          <T style={{ color: colors.muted, fontSize: 13 }}>
            {[picked.locality_text, picked.membership_number ? `n° ${picked.membership_number}` : "", picked.pending ? "en attente d'envoi" : ""]
              .filter(Boolean)
              .join(" · ") || "Exploitant choisi"}
          </T>
        </View>
        <Pressable onPress={() => onPick(null)} accessibilityRole="button" accessibilityLabel="Changer d'exploitant" hitSlop={10}>
          <X size={20} color={colors.muted} />
        </Pressable>
      </Card>
    );
  }

  if (draft) {
    const set = <K extends keyof NewProducer>(k: K) => (v: NewProducer[K]) => onDraft({ ...draft, [k]: v });
    return (
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <UserPlus size={20} color={colors.forest} />
          <T style={{ flex: 1, fontSize: 16, fontWeight: "700" }}>Nouveau producteur</T>
          <Pressable onPress={() => onDraft(null)} accessibilityRole="button" accessibilityLabel="Revenir à la recherche" hitSlop={10}>
            <X size={20} color={colors.muted} />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <T style={styles.label}>Prénom</T>
            <Input accessibilityLabel="Prénom" value={draft.first} onChangeText={set("first")} autoCapitalize="words" />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <T style={styles.label}>Nom</T>
            <Input accessibilityLabel="Nom" value={draft.last} onChangeText={set("last")} autoCapitalize="words" />
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <T style={styles.label}>Sexe</T>
          <Chips label="Sexe" options={Object.entries(SEX_LABELS) as [string, string][]} value={draft.sex} onChange={(v) => set("sex")(v || "unspecified")} />
        </View>
        <View style={{ gap: 6 }}>
          <T style={styles.label}>Village</T>
          <Input accessibilityLabel="Village ou localité" value={draft.locality} onChangeText={set("locality")} placeholder="ex. Guédé" />
        </View>
        <View style={{ gap: 6 }}>
          <T style={styles.label}>Téléphone (facultatif)</T>
          <PhoneInput country={draft.country} onCountryChange={set("country")} value={draft.phone} onChangeText={set("phone")} />
        </View>
        <View style={{ gap: 6 }}>
          <T style={styles.label}>N° d&apos;adhérent</T>
          <Input
            accessibilityLabel="Numéro d'adhérent"
            value={draft.membership}
            onChangeText={set("membership")}
            autoCapitalize="characters"
            placeholder={proposedNumber ? `Auto : ${proposedNumber}` : "Attribué automatiquement"}
          />
        </View>
        <T style={{ color: colors.muted, fontSize: 13 }}>
          Ménage, section et autres informations : depuis sa fiche, après l&apos;enrôlement.
        </T>
      </Card>
    );
  }

  return (
    <>
      <Input
        accessibilityLabel="Rechercher l'exploitant"
        icon={<Search size={18} color={colors.muted} />}
        placeholder="Nom, téléphone, n° d'adhérent"
        value={q}
        onChangeText={(t) => {
          setQ(t);
          setSearched(false);
        }}
        autoFocus
      />
      {q.trim().length >= 2
        ? items.map((p) => (
            <Pressable key={p.id} onPress={() => onPick(p)} accessibilityRole="button" style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}>
              <Avatar initials={initialsOf(p.first_name, p.last_name)} size={40} />
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: "700" }}>
                  {p.first_name} {p.last_name}
                </T>
                <T style={{ color: colors.muted, fontSize: 13 }}>
                  {[p.locality_text, p.membership_number ? `n° ${p.membership_number}` : "", p.pending ? "enrôlé hors ligne, en attente d'envoi" : ""]
                    .filter(Boolean)
                    .join(" · ") || "Localité non renseignée"}
                </T>
              </View>
              <Check size={18} color={colors.lineStrong} />
            </Pressable>
          ))
        : null}
      {searched && q.trim().length >= 2 && !items.length ? (
        <T style={{ color: colors.muted, textAlign: "center" }}>Aucun producteur trouvé pour « {q.trim()} ».</T>
      ) : null}
      <Pressable onPress={() => onDraft(EMPTY_PRODUCER(DEFAULT_COUNTRY))} accessibilityRole="button" style={({ pressed }) => [styles.create, pressed && { opacity: 0.8 }]}>
        <View style={styles.createIcon}>
          <UserPlus size={20} color={colors.forest} />
        </View>
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: "700" }}>Nouveau producteur</T>
          <T style={{ color: colors.muted, fontSize: 13 }}>Il n&apos;est pas encore enregistré : l&apos;enrôler maintenant</T>
        </View>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "700" },
  picked: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.brand50, borderColor: "#CFE6D3" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
  },
  create: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.lineStrong,
    backgroundColor: colors.canvas,
  },
  createIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.brand50, alignItems: "center", justifyContent: "center" },
});
