import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { autoTitles, listWorkouts } from '@/data/workoutRepo';
import { formatDayLabel, formatTime, groupByDay, type Workout } from '@/domain/workout';
import { useTheme } from '@/ui/theme';

// Analyse → Workout summary: pick a workout (requirement 3c).
export default function SummaryList() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const theme = useTheme();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id;

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      Promise.all([listWorkouts(db, userId), autoTitles(db, userId)])
        .then(([loaded, named]) => {
          if (cancelled) return;
          setWorkouts(loaded.filter((w) => w.endedAt !== null));
          setTitles(named);
        })
        .catch(() => !cancelled && setError('Your workouts could not be loaded.'));
      return () => {
        cancelled = true;
      };
    }, [db, userId]),
  );

  const days = useMemo(() => groupByDay(workouts ?? []), [workouts]);
  const now = new Date();

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.column}>
        {error && <Text style={[styles.message, { color: theme.danger }]}>{error}</Text>}
        {workouts !== null && workouts.length === 0 && (
          <Text style={[styles.message, { color: theme.textMuted }]}>Finish a workout to see its summary here.</Text>
        )}
        {days.map((day) => (
          <View key={day.key} style={styles.day}>
            <Text accessibilityRole="header" style={[styles.dayLabel, { color: theme.textMuted }]}>
              {formatDayLabel(day.date, now)}
            </Text>
            {day.workouts.map((workout) => {
              const title = workout.title ?? titles.get(workout.id) ?? 'Workout';
              return (
                <Pressable
                  key={workout.id}
                  accessibilityLabel={`${title}, ${formatTime(workout.startedAt)}`}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/analyse/summary/[id]', params: { id: workout.id } })}
                  style={({ pressed }) => [
                    styles.card,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                  <Text style={[styles.detail, { color: theme.textMuted }]}>{formatTime(workout.startedAt)}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, flexGrow: 1 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  message: { fontSize: 16, textAlign: 'center', marginTop: 40 },
  day: { marginBottom: 22, gap: 10 },
  dayLabel: { fontSize: 15, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  title: { fontSize: 18, fontWeight: '700' },
  detail: { fontSize: 15 },
  pressed: { opacity: 0.7 },
});
