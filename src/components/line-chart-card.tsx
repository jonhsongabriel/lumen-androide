/**
 * Mini-graphique en courbes multi-séries avec react-native-svg.
 * Reproduit fidèlement RealTimeChart (web/Recharts) : grille pointillée,
 * courbes lissées (spline), axe X avec graduations horaires, axe Y avec
 * 5 niveaux, légende en bas. Compatibilité web + natif (SVG universel).
 */
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path as SvgPath, Line as SvgLine, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { LumenPalette } from '@/constants/lumen-colors';

export type Series = { key: string; label: string; color: string; values: (number | null)[] };

export function LineChartCard({
  COLORS,
  title,
  series,
  labels = [],
  height = 220,
  yUnit = '',
}: {
  COLORS: LumenPalette;
  title: string;
  series: Series[];
  labels?: string[];
  height?: number;
  yUnit?: string;
}) {
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const max = Math.max(0.1, ...all);
  const min = Math.min(0, ...all);
  const range = max - min || 1;
  const pointCount = Math.max(...series.map((s) => s.values.length), 0);
  const hasData = pointCount > 0 && all.length > 0;

  // Repère de tracé en viewBox 100x100 : tout est proportionnel.
  // Marges verticales généreuses : les sommets des courbes (et leur
  // remplissage d'aire) ne doivent jamais être rognés par les bords.
  const W = 100;
  const H = 100;
  const PAD_LEFT = 15;
  const PAD_RIGHT = 3;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 9;
  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  const paths = useMemo(() => {
    return series.map((s) => {
      const stepX = pointCount > 1 ? plotW / (pointCount - 1) : 0;
      const pts: { x: number; y: number }[] = [];
      s.values.forEach((v, i) => {
        if (v === null) return;
        const x = PAD_LEFT + (pointCount > 1 ? i * stepX : plotW / 2);
        const y = PAD_TOP + plotH - ((v - min) / range) * plotH;
        pts.push({ x, y });
      });
      return { key: s.key, color: s.color, pts };
    });
  }, [series, pointCount, min, range, plotW, plotH]);

  // 5 graduations Y (comme Recharts)
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) ticks.push(min + (range * i) / 4);
    return ticks;
  }, [min, range]);

  // 3 graduations X réparties (début / milieu / fin), comme les apps Deye.
  const xTicks = useMemo(() => {
    if (labels.length === 0) return [];
    if (labels.length === 1) return [{ i: 0, label: labels[0] }];
    const mid = Math.floor((labels.length - 1) / 2);
    const last = labels.length - 1;
    const unique = [
      { i: 0, label: labels[0] },
      ...(mid !== 0 && mid !== last ? [{ i: mid, label: labels[mid] }] : []),
      { i: last, label: labels[last] },
    ];
    return unique;
  }, [labels]);

  const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));

  return (
    <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
      <Text style={[styles.title, { color: COLORS.text }]}>{title}</Text>
      {!hasData ? (
        <Text style={[styles.empty, { color: COLORS.muted }]}>Aucune donnée sur la période.</Text>
      ) : (
        <>
          <View style={[styles.plot, { height: height - 62, backgroundColor: COLORS.background }]}>
            <Svg viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
              {/* Grille pointillée horizontale (CartesianGrid) */}
              {yTicks.map((t, i) => {
                const y = PAD_TOP + plotH - ((t - min) / range) * plotH;
                return (
                  <SvgLine
                    key={`gy${i}`}
                    x1={PAD_LEFT}
                    x2={W - PAD_RIGHT}
                    y1={y}
                    y2={y}
                    stroke={COLORS.border}
                    strokeWidth={0.3}
                    strokeDasharray="1.2 1.2"
                    opacity={0.7}
                  />
                );
              })}
              {/* Axes */}
              <SvgLine
                x1={PAD_LEFT}
                x2={PAD_LEFT}
                y1={PAD_TOP}
                y2={PAD_TOP + plotH}
                stroke={COLORS.border}
                strokeWidth={0.4}
              />
              <SvgLine
                x1={PAD_LEFT}
                x2={W - PAD_RIGHT}
                y1={PAD_TOP + plotH}
                y2={PAD_TOP + plotH}
                stroke={COLORS.border}
                strokeWidth={0.4}
              />
              {/* Courbes lissées (Catmull-Rom → Bézier, comme type="monotone" de Recharts) */}
              {paths.map((p) => (
                <SvgPath
                  key={p.key}
                  d={catmullRomToBezier(p.pts)}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={0.9}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {/* Remplissage délicat sous la courbe (aire, comme dans Recharts) */}
              {paths.map((p) => {
                const d = catmullRomToBezier(p.pts);
                if (!d) return null;
                const last = p.pts[p.pts.length - 1];
                const first = p.pts[0];
                if (!last || !first) return null;
                const area = `${d} L${last.x.toFixed(2)},${(PAD_TOP + plotH).toFixed(2)} L${first.x.toFixed(2)},${(PAD_TOP + plotH).toFixed(2)} Z`;
                const gid = `grad-${p.key.replace(/[^a-zA-Z0-9]/g, '')}`;
                return (
                  <>
                    <Defs>
                      <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={p.color} stopOpacity={0.35} />
                        <Stop offset="1" stopColor={p.color} stopOpacity={0} />
                      </LinearGradient>
                    </Defs>
                    <SvgPath d={area} fill={`url(#${gid})`} stroke="none" />
                  </>
                );
              })}
              {/* Point du dernier relevé (temps réel) */}
              {paths.map((p) => {
                const last = p.pts[p.pts.length - 1];
                if (!last) return null;
                return (
                  <Circle
                    key={`dot-${p.key}`}
                    cx={last.x}
                    cy={last.y}
                    r={0.9}
                    fill={p.color}
                    stroke={COLORS.card}
                    strokeWidth={0.3}
                  />
                );
              })}
            </Svg>
            {/* Libellés Y à gauche (hors SVG pour éviter la déformation du viewBox) */}
            {yTicks.map((t, i) => {
              const y = PAD_TOP + plotH - ((t - min) / range) * plotH;
              return (
                <Text
                  key={`yl${i}`}
                  style={[
                    styles.yTick,
                    { color: COLORS.muted, top: `${(y / H) * 100}%`, left: 2 },
                  ]}
                >
                  {fmt(t)}
                  {yUnit}
                </Text>
              );
            })}
          </View>
          {/* Axe X : graduations réparties */}
          <View style={styles.xRow}>
            {xTicks.map((t, i) => (
              <Text
                key={`xt${i}`}
                style={[
                  styles.xLabel,
                  { color: COLORS.muted },
                  i === 0 ? styles.xLabelFirst : i === xTicks.length - 1 ? styles.xLabelLast : styles.xLabelMid,
                ]}
                numberOfLines={1}
              >
                {t.label}
              </Text>
            ))}
          </View>
          {/* Légende */}
          <View style={styles.legendRow}>
            {series.map((s) => (
              <View key={s.key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Text style={[styles.legendText, { color: COLORS.muted }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

/**
 * Conversion des points en chemin Bézier (Catmull-Rom → Bézier cubique) avec
 * tension réduite (facteur 1/9 au lieu de 1/6) : les courbes lissées ne
 * dépassent jamais au-dessus/en-dessous des points réels (évite le "overshoot"
 * qui faisait paraître les sommets rognés par les bords du graphique).
 */
function catmullRomToBezier(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  const T = 1 / 9; // tension : 1/6 = Catmull-Rom classique, 1/9 = plus doux, sans dépassement
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) * T;
    const c1y = p1.y + (p2.y - p0.y) * T;
    const c2x = p2.x - (p3.x - p1.x) * T;
    const c2y = p2.y - (p3.y - p1.y) * T;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  title: { fontSize: 13, fontWeight: '800' },
  empty: { fontSize: 12, textAlign: 'center', paddingVertical: 20 },
  plot: {
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  yTick: {
    position: 'absolute',
    fontSize: 8,
    transform: [{ translateY: -4 }],
  },
  xRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingHorizontal: 2,
  },
  xLabel: { fontSize: 8, flexShrink: 1 },
  xLabelFirst: { textAlign: 'left' },
  xLabelMid: { textAlign: 'center' },
  xLabelLast: { textAlign: 'right' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10 },
});
