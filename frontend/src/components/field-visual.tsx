import { cn } from "@/lib/utils";

/**
 * Vue aérienne stylisée d'un périmètre irrigué (fleuve, canaux, casiers rizicoles),
 * avec une parcelle mise en avant au centre : l'AgroID en image.
 * Entièrement en SVG : net sur tous les écrans, aucun téléchargement d'image.
 * Le centre du dessin reste au centre quel que soit le format (preserveAspectRatio « slice »).
 */

const W = 1000;
const H = 1000;
const CX = W / 2;
const CY = H / 2;

// Générateur pseudo-aléatoire déterministe : le dessin est identique à chaque rendu.
function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const FILLS = ["#173f26", "#1b4a2c", "#205531", "#245f34", "#2b6d38", "#2f7a3b", "#3a8a41", "#1d4f2e", "#5e7536", "#6f6634", "#14361f"];

type Plot = { d: string; fill: string; rows: boolean };

function buildPlots(): Plot[] {
  const rnd = random(7);
  const plots: Plot[] = [];
  const cw = 78;
  const ch = 58;
  const gap = 6;
  // Blocs de casiers séparés par des canaux (tous les 4 colonnes / 3 rangées).
  for (let row = -4; row < 18; row++) {
    for (let col = -4; col < 17; col++) {
      const x = col * (cw + gap) + Math.floor((col + 4) / 4) * 18;
      const y = row * (ch + gap) + Math.floor((row + 4) / 3) * 16;
      const j = () => (rnd() - 0.5) * 7;
      const pts: [number, number][] = [
        [x + j(), y + j()],
        [x + cw + j(), y + j()],
        [x + cw + j(), y + ch + j()],
        [x + j(), y + ch + j()],
      ];
      const d = `M${pts.map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join("L")}Z`;
      plots.push({ d, fill: FILLS[Math.floor(rnd() * FILLS.length)] ?? "#1b4a2c", rows: rnd() > 0.55 });
    }
  }
  return plots;
}

const PLOTS = buildPlots();

// Parcelle mise en avant, centrée sur (CX, CY). Le halo animé est posé sur le 2ᵉ sommet.
const PULSE = { x: CX + 70, y: CY - 70 };
const HIGHLIGHT: [number, number][] = [
  [CX - 92, CY - 58],
  [CX + 70, CY - 70],
  [CX + 98, CY + 8],
  [CX + 74, CY + 66],
  [CX - 80, CY + 72],
  [CX - 104, CY + 4],
];

export function FieldVisual({ className, highlight = true }: { className?: string; highlight?: boolean }) {
  const hl = `M${HIGHLIGHT.map(([a, b]) => `${a} ${b}`).join("L")}Z`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={cn("block", className)}
      role="img"
      aria-label="Vue aérienne de parcelles irriguées, une parcelle identifiée par son AgroID"
    >
      <defs>
        <pattern id="fv-rows" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
          <path d="M0 3h6" stroke="#ffffff" strokeOpacity="0.07" strokeWidth="1.2" />
        </pattern>
        <linearGradient id="fv-river" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#0d3b4c" />
          <stop offset="1" stopColor="#14556a" />
        </linearGradient>
        <radialGradient id="fv-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#e8aa17" stopOpacity="0.35" />
          <stop offset="1" stopColor="#e8aa17" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={W} height={H} fill="#123a22" />

      <g transform={`rotate(-12 ${CX} ${CY})`}>
        <g transform="translate(-40 -60)">
          {PLOTS.map((p) => (
            <g key={p.d}>
              <path d={p.d} fill={p.fill} stroke="#0c2a17" strokeOpacity="0.55" strokeWidth="1.5" />
              {p.rows ? <path d={p.d} fill="url(#fv-rows)" /> : null}
            </g>
          ))}
        </g>

        {/* Canal principal et pistes */}
        <path d={`M-300 ${CY + 150} L1300 ${CY + 132}`} stroke="#7fb7c4" strokeOpacity="0.55" strokeWidth="5" />
        <path d={`M${CX - 210} -300 L${CX - 236} 1300`} stroke="#d9cfae" strokeOpacity="0.35" strokeWidth="4" strokeDasharray="14 10" />
        <path d={`M${CX + 245} -300 L${CX + 228} 1300`} stroke="#d9cfae" strokeOpacity="0.28" strokeWidth="3" />

        {highlight ? (
          <g>
            <circle cx={CX} cy={CY} r="190" fill="url(#fv-glow)" />
            <path d={hl} fill="#e8aa17" fillOpacity="0.2" stroke="#e8aa17" strokeWidth="3.5" strokeLinejoin="round" />
            {HIGHLIGHT.map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5.5" fill="#ffffff" stroke="#0b1929" strokeWidth="2" />
            ))}
            <circle
              cx={PULSE.x}
              cy={PULSE.y}
              r="6"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              className="origin-center animate-[pulse-ring_2.4s_ease-out_infinite]"
            />
          </g>
        ) : null}
      </g>

      {/* Fleuve en haut du périmètre */}
      <path
        d="M-20 120 C 180 60, 330 190, 520 130 S 860 40, 1020 110 L1020 -20 L-20 -20Z"
        fill="url(#fv-river)"
      />
      <path
        d="M-20 120 C 180 60, 330 190, 520 130 S 860 40, 1020 110"
        fill="none"
        stroke="#c9b98a"
        strokeOpacity="0.5"
        strokeWidth="6"
      />
    </svg>
  );
}
