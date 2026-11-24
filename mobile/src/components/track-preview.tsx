import { useMemo, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Polygon, Polyline } from "react-native-svg";

import { T } from "@/components/ui";
import { type Bbox, type Position, projector } from "@/lib/geo";
import type { Fix } from "@/lib/gps-track";
import { colors, radius } from "@/theme";

const MIN_SPAN_DEG = 0.0004; // ~40 m : un premier point ne remplit pas tout l'écran

/** Aperçu vectoriel du contour en cours de relevé, avec la position actuelle de l'agent. */
export function TrackPreview({ points, current, closed, height = 260 }: { points: Fix[]; current: Fix | null; closed: boolean; height?: number }) {
  const [width, setWidth] = useState(0);
  const all = useMemo(() => [...points.map((p) => p.position), ...(current ? [current.position] : [])], [points, current]);
  const proj = useMemo(() => {
    if (!all.length || !width) return null;
    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of all) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const padX = Math.max(0, MIN_SPAN_DEG - (maxX - minX)) / 2;
    const padY = Math.max(0, MIN_SPAN_DEG - (maxY - minY)) / 2;
    const bbox: Bbox = [minX - padX, minY - padY, maxX + padX, maxY + padY];
    return projector(bbox, width, height, 24);
  }, [all, width, height]);

  const xy = (p: Position) => proj!.project(p);
  const path = proj ? points.map((p) => xy(p.position).join(",")).join(" ") : "";
  const first = proj && points[0] ? xy(points[0].position) : null;
  const last = proj && points.length ? xy((points[points.length - 1] as Fix).position) : null;
  const here = proj && current ? xy(current.position) : null;

  return (
    <View
      style={[styles.frame, { height }]}
      onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}
      accessibilityRole="image"
      accessibilityLabel={`Contour en cours : ${points.length} point${points.length > 1 ? "s" : ""}`}
    >
      {proj ? (
        <Svg width={width} height={height}>
          {closed && points.length >= 3 ? (
            <Polygon points={path} fill={colors.gold} fillOpacity={0.28} stroke={colors.gold} strokeWidth={3} />
          ) : (
            <Polyline points={path} fill="none" stroke={colors.gold} strokeWidth={3} strokeLinejoin="round" />
          )}
          {!closed && first && last && points.length >= 3 ? (
            <Line x1={last[0]} y1={last[1]} x2={first[0]} y2={first[1]} stroke={colors.gold} strokeWidth={2} strokeDasharray="6 6" />
          ) : null}
          {points.map((p, i) => {
            const [x, y] = xy(p.position);
            return <Circle key={`${p.at}-${i}`} cx={x} cy={y} r={i === 0 ? 6 : 3.5} fill={i === 0 ? colors.forest : "#fff"} stroke={colors.forest} strokeWidth={2} />;
          })}
          {here ? (
            <>
              <Circle cx={here[0]} cy={here[1]} r={14} fill="#2F80ED" fillOpacity={0.18} />
              <Circle cx={here[0]} cy={here[1]} r={6} fill="#2F80ED" stroke="#fff" strokeWidth={2} />
            </>
          ) : null}
        </Svg>
      ) : (
        <View style={styles.empty}>
          <T style={{ color: "#D8E6DD", textAlign: "center" }}>En attente du signal GPS…</T>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#16301F" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
});
