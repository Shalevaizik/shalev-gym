import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { listBodyWeights, loadTraining } from '@/data/analysisRepo';
import { exerciseProgress, type ExerciseProgress } from '@/domain/progress';
import { ProgressChart } from '@/ui/ProgressChart';
import { useTheme } from '@/ui/theme';

const METRIC_TEXT = {
  kg: { unit: 'kg', title: 'Heaviest load per workout', note: 'The bar and both sides, both dumbbells, or your body weight plus what you added.' },
  reps: { unit: 'reps', title: 'Most reps per workout', note: 'Add your body weight in the menu to track this in kg.' },
  seconds: { unit: 's', title: 'Longest hold per workout', note: 'In seconds.' },
} as const;

// How one exercise has improved: the best set of each workout, with records marked.
export default function ExerciseProgressScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const db = useSQLiteContext();
  const { user } = useAuth();
  const theme = useTheme();
  const [progress, setProgress] = useState<ExerciseProgress | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!userId || !name) return;
    let cancelled = false;
    Promise.all([loadTraining(db, userId), listBodyWeights(db, userId)])
      .then(([workouts, weights]) => !cancelled && setProgress(exerciseProgress(name, workouts, weights)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [db, userId, name]);

  if (!progress) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.analyse} />
      </View>
    );
  }

  const text = METRIC_TEXT[progress.metric];
  const points = progress.points;
  const first = points[0];
  const latest = points.at(-1);
  const chosen = selected !== null ? points[selected] : null;
  const records = points.filter((p) => p.record).length;
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: progress.name }} />
      <View style={styles.column}>
        {points.length === 0 ? (
          <Text style={[styles.body, { color: theme.textMuted }]}>No sets logged for this exercise yet.</Text>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text accessibilityRole="header" style={[styles.cardTitle, { color: theme.text }]}>
                {text.title}
              </Text>
              {latest && first && points.length > 1 && (
                <Text style={[styles.headline, { color: theme.text }]}>
                  {latest.value - first.value >= 0 ? '+' : ''}
                  {Math.round((latest.value - first.value) * 10) / 10} {text.unit}
                  <Text style={[styles.body, styles.normal, { color: theme.textMuted }]}> since {day(first.date)}</Text>
                </Text>
              )}
              <Text style={[styles.small, { color: theme.textMuted }]}>
                {chosen
                  ? `${day(chosen.date)}: ${chosen.label}${chosen.record ? ' · record' : ''}`
                  : 'Tap a point to see that workout’s best set.'}
              </Text>
              <ProgressChart onSelect={setSelected} points={points} selected={selected} unit={text.unit} />
              <Text style={[styles.small, { color: theme.textMuted }]}>{text.note}</Text>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text accessibilityRole="header" style={[styles.cardTitle, { color: theme.text }]}>
                Every workout
              </Text>
              <Text style={[styles.small, { color: theme.textMuted }]}>
                {points.length} {points.length === 1 ? 'workout' : 'workouts'} · {records}{' '}
                {records === 1 ? 'record' : 'records'}
              </Text>
              {[...points].reverse().map((p) => (
                <View key={p.workoutId} style={[styles.row, { borderTopColor: theme.border }]}>
                  <Text style={[styles.date, { color: theme.textMuted }]}>{day(p.date)}</Text>
                  <Text style={[styles.value, { color: theme.text }]}>{p.label}</Text>
                  {p.record && <Ionicons accessibilityLabel="Record" color={theme.analyse} name="trophy" size={16} />}
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40, flexGrow: 1 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 14 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  headline: { fontSize: 28, fontWeight: '800' },
  body: { fontSize: 15, lineHeight: 22 },
  normal: { fontWeight: '400' },
  small: { fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth },
  date: { width: 100, fontSize: 14, fontVariant: ['tabular-nums'] },
  value: { flex: 1, fontSize: 15, fontVariant: ['tabular-nums'] },
});
