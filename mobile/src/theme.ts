/** Charte PEST AI OS (mêmes couleurs et polices que le Web OS, maquette AI Studio). */
export const colors = {
  forest: "#184429",
  leaf: "#3A9442",
  gold: "#E8AA17",
  night: "#0B1929",
  canvas: "#FFFFFF",
  surface: "#F7FAF8",
  subtle: "#EEF3F0",
  line: "#E3EAE6",
  lineStrong: "#CBD6D0",
  ink: "#0B1929",
  muted: "#5B6B78",
  brand50: "#EAF5EC",
  success: "#2F7D37",
  warning: "#8A5A00",
  warningBg: "#FFF5DB",
  danger: "#B42318",
  dangerBg: "#FDECEA",
} as const;

/**
 * Polices : Questrial (version libre de Century Gothic, comme le Web OS) et JetBrains Mono.
 * Questrial n'a qu'une graisse : le gras est obtenu par `fontWeight`.
 */
export const fonts = {
  sans: "Questrial_400Regular",
  mono: "JetBrainsMono_500Medium",
} as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28 } as const;
