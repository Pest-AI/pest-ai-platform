import Svg, { Path, Rect } from "react-native-svg";

import { qrMatrix, qrPath } from "@/lib/qr";

/** QR code vectoriel de l'AgroID. */
export function QrCode({ value, size = 140, label }: { value: string; size?: number; label: string }) {
  const { size: n, d } = qrPath(qrMatrix(value));
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} accessibilityRole="image" accessibilityLabel={label}>
      <Rect width={n} height={n} fill="#fff" />
      <Path d={d} fill="#000" />
    </Svg>
  );
}
