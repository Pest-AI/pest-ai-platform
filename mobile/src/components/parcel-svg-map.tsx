import { useMemo, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

import { T } from "@/components/ui";
import { type Bbox, type MultiPolygon, type Position, bboxOf, projector, svgPath } from "@/lib/geo";
import type { CachedParcel } from "@/lib/parcel-cache";
import { STATUS_COLORS } from "@/lib/parcel-labels";
import { colors, radius } from "@/theme";

/**
 * Carte légère des parcelles : contours dessinés en vectoriel, sans fond de carte,
 * donc disponible hors ligne. Toucher une parcelle la sélectionne.
 */
export function ParcelSvgMap({
  parcels,
  selectedId,
  onSelect,
  position,
  height = 360,
}: {
  parcels: CachedParcel[];
  selectedId?: string | null;
  onSelect?: (p: CachedParcel | null) => void;
  position?: Position | null;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const drawable = useMemo(() => parcels.filter((p) => p.geometry), [parcels]);
  const bbox = useMemo<Bbox | null>(() => {
    const b = bboxOf(drawable.map((p) => p.geometry as MultiPolygon));
    if (!b || !position) return b;
    return [Math.min(b[0], position[0]), Math.min(b[1], position[1]), Math.max(b[2], position[0]), Math.max(b[3], position[1])];
  }, [drawable, position]);
  const proj = useMemo(() => (bbox && width ? projector(bbox, width, height, 18) : null), [bbox, width, height]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  return (
    <View style={[styles.frame, { height }]} onLayout={onLayout} accessibilityLabel="Carte des parcelles" accessibilityRole="image">
      {proj ? (
        <Svg width={width} height={height}>
          <G>
            {drawable.map((p) => {
              const selected = p.id === selectedId;
              const color = STATUS_COLORS[p.status] ?? colors.lineStrong;
              return (
                <Path
                  key={p.id}
                  d={svgPath(p.geometry as MultiPolygon, proj)}
                  fill={color}
                  fillOpacity={selected ? 0.55 : 0.3}
                  fillRule="evenodd"
                  stroke={selected ? "#FFFFFF" : color}
                  strokeWidth={selected ? 3 : 1.5}
                  onPress={() => onSelect?.(p)}
                />
              );
            })}
            {position ? (
              <>
                <Circle cx={proj.project(position)[0]} cy={proj.project(position)[1]} r={11} fill="#4C8DF6" fillOpacity={0.25} />
                <Circle cx={proj.project(position)[0]} cy={proj.project(position)[1]} r={5.5} fill="#4C8DF6" stroke="#fff" strokeWidth={2} />
              </>
            ) : null}
          </G>
        </Svg>
      ) : (
        <View style={styles.empty}>
          <T style={{ color: "rgba(255,255,255,0.8)", textAlign: "center" }}>Aucun contour à afficher.</T>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: "#16301F", borderRadius: radius.lg, overflow: "hidden" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
});
