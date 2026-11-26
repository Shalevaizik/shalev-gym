import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { autoTitles, closeStaleWorkout, listWorkouts } from '@/data/workoutRepo';
import {
  durationMs,
  formatDayLabel,
  formatDuration,
  formatTime,
  groupByDay,
  type Workout,
} from '@/domain/workout';
import { t, titleText } from '@/i18n/core';
import { useTheme } from '@/ui/theme';

// Previous workouts by day, each with its title, time and length (requirement 21).
export default function WorkoutHistory() {
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
      (async () => {
        try {
          await closeStaleWorkout(db, userId, new Date());
          const [loaded, named] = await Promise.all([listWorkouts(db, userId), autoTitles(db, userId)]);
          if (cancelled) return;
          setWorkouts(loaded);
          setTitles(named);
        } catch {
          if (!cancelled) setError(t('Your workouts could not be loaded.'));
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [db, userId]),
  );

  const now = new Date();
  const finished = useMemo(() => (workouts ?? []).filter((w) => w.endedAt !== null), [workouts]);
  const days = useMemo(() => groupByDay(finished), [finished]);
  const cardStyle = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.column}>
        {error && (
          <Text accessibilityLiveRegion="polite" style={[styles.message, { color: theme.danger }]}>
            {error}
          </Text>
        )}

        {workouts !== null && finished.length === 0 && (
          <Text style={[styles.message, { color: theme.textMuted }]}>{t('Your finished workouts will appear here.')}</Text>
        )}

        {days.map((day) => (
          <View key={day.key} style={styles.day}>
            <Text accessibilityRole="header" style={[styles.dayLabel, { color: theme.textMuted }]}>
              {formatDayLabel(day.date, now)}
            </Text>
            {day.workouts.map((workout) => {
              const title = workout.title ?? titleText(titles.get(workout.id) ?? 'Workout');
              const detail = `${formatTime(workout.startedAt)} · ${
                workout.endReason === 'auto' ? t('ended automatically') : formatDuration(durationMs(workout, now))
              }`;
              return (
                <Pressable
                  accessibilityLabel={`${title}, ${detail}`}
                  accessibilityRole="button"
                  key={workout.id}
                  onPress={() => router.push({ pathname: '/workout/[id]', params: { id: workout.id } })}
                  style={({ pressed }) => [cardStyle, pressed && styles.pressed]}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
                  <Text style={[styles.rowDetail, { color: theme.textMuted }]}>{detail}</Text>
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
  card: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  message: { fontSize: 16, textAlign: 'center', marginTop: 40 },
  day: { marginBottom: 24, gap: 10 },
  dayLabel: { fontSize: 15, fontWeight: '600', textAlign: 'left' },
  rowTitle: { fontSize: 18, fontWeight: '700', textAlign: 'left' },
  rowDetail: { fontSize: 15, textAlign: 'left' },
  pressed: { opacity: 0.7 },
});
