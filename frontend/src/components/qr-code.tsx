import { qrMatrix, qrPath } from "@/lib/qr";

/** QR code vectoriel (net à l'impression), rendu côté serveur. */
export function QrCode({ value, size = 160, label, className }: { value: string; size?: number; label: string; className?: string }) {
  const { size: n, d } = qrPath(qrMatrix(value));
  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} role="img" aria-label={label} className={className} shapeRendering="crispEdges">
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
