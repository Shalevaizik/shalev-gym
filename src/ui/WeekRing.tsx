import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { FONT, useTheme } from './theme';

type Props = { workouts: number; workoutGoal: number; sets: number; setGoal: number; size?: number };

// The weekly ring of design D: workouts this week on the outer ring, sets on the inner one.
export function WeekRing({ workouts, workoutGoal, sets, setGoal, size = 210 }: Props) {
  const theme = useTheme();
  const outer = { r: size * 0.42, width: size * 0.076 };
  const inner = { r: size * 0.31, width: size * 0.034 };
  const arc = (r: number, share: number) => {
    const length = 2 * Math.PI * r;
    return `${Math.max(0.001, Math.min(1, share)) * length} ${length}`;
  };
  const c = size / 2;

  return (
    <View
      accessibilityLabel={`${workouts} of ${workoutGoal} workouts and ${sets} of ${setGoal} sets this week`}
      accessible
      style={{ width: size, height: size }}>
      <Svg height={size} width={size}>
        <Circle cx={c} cy={c} fill="none" r={outer.r} stroke="rgba(255,255,255,0.10)" strokeWidth={outer.width} />
        <Circle
          cx={c}
          cy={c}
          fill="none"
          r={outer.r}
          rotation={-90}
          origin={`${c}, ${c}`}
          stroke={theme.accent}
          strokeDasharray={arc(outer.r, workouts / workoutGoal)}
          strokeLinecap="round"
          strokeWidth={outer.width}
        />
        <Circle cx={c} cy={c} fill="none" r={inner.r} stroke="rgba(255,255,255,0.08)" strokeWidth={inner.width} />
        <Circle
          cx={c}
          cy={c}
          fill="none"
          r={inner.r}
          rotation={-90}
          origin={`${c}, ${c}`}
          stroke={theme.text}
          strokeOpacity={0.75}
          strokeDasharray={arc(inner.r, sets / setGoal)}
          strokeLinecap="round"
          strokeWidth={inner.width}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={[styles.count, { color: theme.text, fontSize: size * 0.24 }]}>
          {workouts}/{workoutGoal}
        </Text>
        <Text style={[styles.caption, { color: theme.textMuted }]}>THIS WEEK</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  count: { fontFamily: FONT.display, includeFontPadding: false },
  caption: { fontSize: 12, fontWeight: '600', letterSpacing: 1.2, marginTop: 2 },
});
