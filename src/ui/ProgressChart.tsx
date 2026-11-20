import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import type { ProgressPoint } from '@/domain/progress';

import { useTheme } from './theme';

type Props = {
  points: ProgressPoint[];
  unit: string; // "kg", "reps", "s"
  selected: number | null;
  onSelect: (index: number) => void;
};

const HEIGHT = 190;
// Browsers draw chart text in a serif font unless told otherwise.
const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' : undefined;
const PAD = { top: 18, right: 14, bottom: 26, left: 40 };

// "Nice" gridline steps so the axis reads 0, 20, 40 rather than 0, 17.3, 34.6.
function niceStep(range: number): number {
  const raw = range / 3;
  const power = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power;
  return step;
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// One line of the best set per workout, a 2px line with 8px points; the latest and best points
// carry their value, the rest show it when tapped.
export function ProgressChart({ points, unit, selected, onSelect }: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const values = points.map((p) => p.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const step = niceStep(Math.max(high - low, high * 0.2, 1));
  const yMin = Math.max(0, Math.floor((low - step * 0.5) / step) * step);
  const yMax = Math.ceil((high + step * 0.3) / step) * step;
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);

  const best = values.indexOf(high);
  const last = points.length - 1;
  const labelled = new Set([best, last, ...(selected !== null ? [selected] : [])]);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');

  return (
    <View onLayout={onLayout} style={styles.wrap}>
      {width > 0 && (
        <Svg height={HEIGHT} width={width}>
          {ticks.map((tick) => (
            <Line
              key={tick}
              stroke={theme.border}
              strokeWidth={1}
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
            />
          ))}
          {ticks.map((tick) => (
            <SvgText fontFamily={FONT} key={`t${tick}`} fill={theme.textMuted} fontSize={11} textAnchor="end" x={PAD.left - 6} y={y(tick) + 4}>
              {tick}
            </SvgText>
          ))}
          <SvgText fontFamily={FONT} fill={theme.textMuted} fontSize={11} x={PAD.left} y={HEIGHT - 6}>
            {shortDate(points[0].date)}
          </SvgText>
          {points.length > 1 && (
            <SvgText fontFamily={FONT} fill={theme.textMuted} fontSize={11} textAnchor="end" x={width - PAD.right} y={HEIGHT - 6}>
              {shortDate(points[last].date)}
            </SvgText>
          )}
          <Path d={path} fill="none" stroke={theme.analyse} strokeLinejoin="round" strokeWidth={2} />
          {points.map((p, i) => (
            <Circle
              key={p.workoutId + i}
              cx={x(i)}
              cy={y(p.value)}
              fill={theme.analyse}
              r={i === selected ? 6 : 4}
              stroke={theme.surface}
              strokeWidth={2}
            />
          ))}
          {points.map((p, i) =>
            labelled.has(i) ? (
              <SvgText
                fontFamily={FONT}
                key={`l${i}`}
                fill={theme.text}
                fontSize={11}
                fontWeight="600"
                textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}
                x={x(i)}
                y={y(p.value) - 10}>
                {`${p.value}${unit === 'kg' ? ' kg' : unit === 's' ? ' s' : ''}`}
              </SvgText>
            ) : null,
          )}
        </Svg>
      )}
      {/* Tap targets larger than the points. */}
      {width > 0 &&
        points.map((p, i) => (
          <Pressable
            key={`hit${i}`}
            accessibilityLabel={`${shortDate(p.date)}: ${p.label}${p.record ? ', a record' : ''}`}
            accessibilityRole="button"
            onPress={() => onSelect(i)}
            style={[styles.hit, { left: x(i) - 16, top: y(p.value) - 16 }]}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', height: HEIGHT },
  hit: { position: 'absolute', width: 32, height: 32, borderRadius: 16 },
});
