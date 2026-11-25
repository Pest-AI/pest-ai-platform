import { Redirect, useRouter } from "expo-router";
import { ArrowLeft, Keyboard, ScanLine } from "lucide-react-native";
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Alert, Button, Card, Input, T } from "@/components/ui";
import { SessionExpiredError } from "@/lib/api";
import { agroidFromText } from "@/lib/qr";
import { resolveAgroid } from "@/lib/resolve-agroid";
import { useSession } from "@/lib/session";
import { colors, radius } from "@/theme";

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/**
 * Scanner le QR code d'une parcelle (J19). Dans le navigateur (PWA) : caméra arrière, lecture
 * par le détecteur du navigateur s'il existe, sinon par jsQR. L'AgroID peut toujours être saisi.
 */
export default function ScannerScreen() {
  const { status, workspace, expire } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<"starting" | "on" | "off">(Platform.OS === "web" ? "starting" : "off");
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const found = useRef(false);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const open = useCallback(
    async (agroid: string) => {
      if (!workspace) return;
      setBusy(true);
      setError(null);
      try {
        const r = await resolveAgroid(workspace, agroid);
        if ("id" in r) {
          stop();
          router.replace({ pathname: "/parcelles/[id]", params: { id: r.id } });
          return;
        }
        setError("offline" in r ? `Pas de réseau, et ${agroid} n'est pas dans la copie locale.` : `${agroid} n'est pas suivie par votre espace.`);
        found.current = false;
      } catch (e) {
        if (e instanceof SessionExpiredError) return expire();
        setError("Une erreur est survenue.");
        found.current = false;
      } finally {
        setBusy(false);
      }
    },
    [workspace, router, stop, expire],
  );

  useEffect(() => {
    if (Platform.OS !== "web" || !navigator.mediaDevices?.getUserMedia) {
      setCamera("off");
      return;
    }
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        const v = video.current;
        if (!v) return;
        v.srcObject = s;
        await v.play();
        setCamera("on");
        const Ctor = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
        const detector = Ctor ? new Ctor({ formats: ["qr_code"] }) : null;
        const jsQR = detector ? null : (await import("jsqr")).default;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        timer = setInterval(async () => {
          if (found.current || !v.videoWidth || !ctx) return;
          let text: string | null = null;
          if (detector) {
            const codes = await detector.detect(v).catch(() => []);
            text = codes[0]?.rawValue ?? null;
          } else if (jsQR) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            text = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
          }
          const agroid = text ? agroidFromText(text) : null;
          if (agroid) {
            found.current = true;
            void open(agroid);
          } else if (text) {
            setError("Ce QR code n'est pas un AgroID PEST AI.");
          }
        }, 300);
      } catch (e) {
        setCamera("off");
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Autorisez la caméra pour scanner (réglages du navigateur), ou saisissez l'AgroID."
            : "Caméra indisponible : saisissez l'AgroID.",
        );
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stop();
    };
  }, [open, stop]);

  if (status !== "signedIn") return <Redirect href="/connexion" />;
  if (!workspace) return <Redirect href="/espaces" />;

  const typedAgroid = agroidFromText(typed);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 24, gap: 14 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={10} style={{ padding: 4 }}>
          <ArrowLeft size={24} color={colors.ink} />
        </Pressable>
        <T style={{ fontSize: 22, fontWeight: "700" }} accessibilityRole="header">
          Scanner un AgroID
        </T>
      </View>

      {Platform.OS === "web" ? (
        <View style={styles.viewport}>
          {createElement("video", {
            ref: video,
            muted: true,
            playsInline: true,
            "aria-label": "Image de la caméra",
            style: { width: "100%", height: "100%", objectFit: "cover", display: camera === "on" ? "block" : "none" },
          })}
          {camera === "on" ? (
            <View style={styles.frame} pointerEvents="none" />
          ) : (
            <View style={styles.placeholder}>
              <ScanLine size={32} color="#D8E6DD" />
              <T style={{ color: "#D8E6DD", textAlign: "center" }}>{camera === "starting" ? "Ouverture de la caméra…" : "Caméra indisponible"}</T>
            </View>
          )}
        </View>
      ) : (
        <Alert tone="info">Le scan se fait pour l&apos;instant dans l&apos;app navigateur (terrain.pestai.africa).</Alert>
      )}
      {camera === "on" ? <T style={{ color: colors.muted, textAlign: "center" }}>Placez le QR code de la fiche AgroID dans le cadre.</T> : null}
      {error ? <Alert tone="warning">{error}</Alert> : null}

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Keyboard size={18} color={colors.forest} />
          <T style={{ fontWeight: "700" }}>Saisir l&apos;AgroID</T>
        </View>
        <Input accessibilityLabel="AgroID" placeholder="PAI-SN-XXXXXXXX" autoCapitalize="characters" value={typed} onChangeText={setTyped} />
        <Button label="Ouvrir la parcelle" disabled={!typedAgroid} loading={busy} onPress={() => typedAgroid && void open(typedAgroid)} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  viewport: { height: 320, borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#16301F", position: "relative" },
  frame: { position: "absolute", top: "15%", left: "15%", right: "15%", bottom: "15%", borderWidth: 3, borderColor: colors.gold, borderRadius: 16 },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
});
