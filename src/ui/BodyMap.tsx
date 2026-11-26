import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Rect } from 'react-native-svg';

import type { BodyMuscle, MuscleLevel } from '@/domain/muscles';

import { useTheme, type Theme } from './theme';

// One shape of the body drawing: which muscle group it is, and where (in a 100 × 176 box).
type Part = { muscle: BodyMuscle | null; x: number; y: number; w: number; h: number; r: number };

const mirror = (muscle: BodyMuscle | null, x: number, y: number, w: number, h: number, r: number): Part[] => [
  { muscle, x, y, w, h, r },
  { muscle, x: 100 - x - w, y, w, h, r },
];

const HEAD: Part[] = [{ muscle: null, x: 44, y: 22, w: 12, h: 6, r: 2 }];

const FRONT: Part[] = [
  ...HEAD,
  ...mirror('Shoulders', 22, 29, 15, 12, 6),
  ...mirror('Chest', 36, 31, 13.5, 17, 5),
  ...mirror('Biceps', 18, 42, 9, 22, 4.5),
  ...mirror('Forearms', 14, 66, 9, 25, 4.5),
  { muscle: 'Core', x: 38, y: 50, w: 24, h: 31, r: 5 },
  { muscle: null, x: 36, y: 82, w: 28, h: 8, r: 3 },
  ...mirror('Quads', 35, 91, 14, 42, 6),
  ...mirror('Calves', 36, 136, 11, 36, 5),
];

const BACK: Part[] = [
  ...HEAD,
  ...mirror('Shoulders', 22, 29, 15, 12, 6),
  { muscle: 'Back', x: 36, y: 30, w: 28, h: 48, r: 8 },
  ...mirror('Triceps', 18, 42, 9, 22, 4.5),
  ...mirror('Forearms', 14, 66, 9, 25, 4.5),
  ...mirror('Glutes', 35, 80, 14, 17, 6),
  ...mirror('Hamstrings', 35, 99, 14, 34, 6),
  ...mirror('Calves', 36, 136, 11, 36, 5),
];

export function levelColor(theme: Theme, level: MuscleLevel): string {
  return {
    neglected: theme.heatNeglected,
    maintaining: theme.heatMaintaining,
    growing: theme.heatGrowing,
    overtrained: theme.heatOvertrained,
  }[level];
}

type Props = {
  levels: Map<BodyMuscle, MuscleLevel>;
  selected: BodyMuscle | null;
  onSelect: (muscle: BodyMuscle) => void;
  // Which body to draw; drawn in the next step (realistic male and female bodies).
  sex?: 'male' | 'female' | null;
};

// Front and back of the body, each muscle group coloured by how much it was trained
// (requirement 19a). Tapping a group selects it; the list below the map does the same in words.
export function BodyMap({ levels, selected, onSelect }: Props) {
  const theme = useTheme();
  const figure = (parts: Part[], label: string) => (
    <View style={styles.figure}>
      <View style={styles.drawing}>
        <Svg accessibilityLabel={`${label} of the body`} height="100%" viewBox="0 0 100 176" width="100%">
          <Circle cx={50} cy={12} fill={theme.bodyNeutral} r={9.5} />
          <G>
            {parts.map((part, index) => {
              const isSelected = part.muscle !== null && part.muscle === selected;
              const fill = part.muscle ? levelColor(theme, levels.get(part.muscle) ?? 'neglected') : theme.bodyNeutral;
              return (
                <Rect
                  key={index}
                  fill={fill}
                  height={part.h}
                  rx={part.r}
                  stroke={isSelected ? theme.text : theme.background}
                  strokeWidth={isSelected ? 1.6 : 1}
                  width={part.w}
                  x={part.x}
                  y={part.y}
                />
              );
            })}
          </G>
        </Svg>
        {/* Tap areas over each muscle group, a little larger than the shapes; the drawing itself
            doesn't take taps in every browser. */}
        {parts.map((part, index) =>
          part.muscle ? (
            <Pressable
              key={`tap${index}`}
              accessibilityLabel={`${part.muscle} on the body map`}
              accessibilityRole="button"
              accessibilityState={{ selected: part.muscle === selected }}
              onPress={() => onSelect(part.muscle as BodyMuscle)}
              style={{
                position: 'absolute',
                left: `${part.x - 2}%`,
                top: `${((part.y - 2) / 176) * 100}%`,
                width: `${part.w + 4}%`,
                height: `${((part.h + 4) / 176) * 100}%`,
              }}
            />
          ) : null,
        )}
      </View>
      <Text style={[styles.caption, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.row}>
      {figure(FRONT, 'Front')}
      {figure(BACK, 'Back')}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  figure: { flex: 1, maxWidth: 170, alignItems: 'center' },
  drawing: { width: '100%', aspectRatio: 100 / 176 },
  caption: { fontSize: 13, fontWeight: '600', marginTop: 4 },
});
