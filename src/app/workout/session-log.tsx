import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { listExercises, resumeExercise } from '@/data/exerciseRepo';
import { deleteWorkout, getWorkout } from '@/data/workoutRepo';
import type { LoggedExercise } from '@/domain/exerciseLog';
import type { Workout } from '@/domain/workout';
import { workoutTitle } from '@/domain/workoutTitle';
import { count, t, titleText } from '@/i18n/core';
import { Button } from '@/ui/Button';
import { ExerciseCard } from '@/ui/ExerciseCard';
import { haptic } from '@/ui/haptics';
import { useTheme } from '@/ui/theme';

// The log of a running workout so far (requirement 22c): every exercise and set, opened from the
// workout screen's "Session log" button. Back returns straight to logging.
export default function SessionLog() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { user } = useAuth();
  const theme = useTheme();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<LoggedExercise[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id;

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      Promise.all([getWorkout(db, userId, id), listExercises(db, userId, id)])
        .then(([loadedWorkout, loaded]) => {
          if (cancelled) return;
          setWorkout(loadedWorkout);
          setExercises(loaded);
        })
        .catch(() => {
          if (!cancelled) setError(t('This workout could not be loaded.'));
        });
      return () => {
        cancelled = true;
      };
    }, [db, userId, id]),
  );

  const inProgress = workout?.endedAt === null;
  const list = exercises ?? [];
  const sets = list.reduce((n, e) => n + e.sets.length, 0);
  const title = titleText(workoutTitle(list.map((e) => ({ name: e.name, muscle: e.muscle, sets: e.sets.length }))));

  async function resume(exercise: LoggedExercise) {
    if (!userId) return;
    setBusy(true);
    try {
      await resumeExercise(db, userId, exercise.id, new Date());
      haptic.success();
      router.back();
    } catch {
      setError(t('The exercise could not be opened. Please try again.'));
      setBusy(false);
    }
  }

  async function remove() {
    if (!userId) return;
    setBusy(true);
    try {
      await deleteWorkout(db, userId, id);
      haptic.warning();
      router.dismissTo('/workout');
    } catch {
      setError(t('The workout could not be deleted. Please try again.'));
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.column}>
        <View>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
            {workout?.title ?? title}
          </Text>
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            {t('{exercises} · {sets} so far', { exercises: count(list.length, 'exercise'), sets: count(sets, 'set') })}
          </Text>
        </View>

        {exercises !== null && list.length === 0 && (
          <View style={[styles.placeholder, { borderColor: theme.border }]}>
            <Text style={[styles.placeholderText, { color: theme.textMuted }]}>
              {t('Nothing logged yet. Go back and say your first exercise.')}
            </Text>
          </View>
        )}

        {list.map((exercise, index) => (
          <View key={exercise.id} style={styles.item}>
            {exercise.finishedAt === null && inProgress && (
              <Text style={[styles.now, { color: theme.accent }]}>{t('NOW TRAINING')}</Text>
            )}
            <ExerciseCard
              exercise={exercise}
              inSuperset={
                exercise.supersetGroup !== null &&
                (list[index - 1]?.supersetGroup === exercise.supersetGroup ||
                  list[index + 1]?.supersetGroup === exercise.supersetGroup)
              }
              onEdit={() => router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } })}
              onResume={inProgress && exercise.finishedAt !== null && !busy ? () => resume(exercise) : undefined}
            />
          </View>
        ))}

        {error && (
          <Text accessibilityLiveRegion="polite" style={[styles.error, { color: theme.danger }]}>
            {error}
          </Text>
        )}

        <Button icon="arrow-back" label={t('Back to logging')} onPress={() => router.back()} />
        <Button
          icon="time-outline"
          label={t('Previous workouts')}
          onPress={() => router.push('/workout/history')}
          variant="secondary"
        />

        {confirmingDelete ? (
          <View style={[styles.deleteBox, { borderColor: theme.danger }]}>
            <Text style={[styles.confirmText, { color: theme.text }]}>{t('Delete this workout?')}</Text>
            <Text style={[styles.confirmNote, { color: theme.textMuted }]}>
              {t('Its {exercises} and {sets} will be removed. This can’t be undone.', {
                exercises: count(list.length, 'exercise'),
                sets: count(sets, 'set'),
              })}
            </Text>
            <Button busy={busy} icon="trash" label={t('Delete workout')} onPress={remove} variant="danger" />
            <Button disabled={busy} label={t('Keep it')} onPress={() => setConfirmingDelete(false)} variant="secondary" />
          </View>
        ) : (
          <Button
            icon="trash-outline"
            label={t('Delete workout')}
            onPress={() => {
              haptic.warning();
              setConfirmingDelete(true);
            }}
            variant="dangerPlain"
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'left' },
  meta: { fontSize: 15, marginTop: 2, textAlign: 'left' },
  item: { gap: 4 },
  now: { fontSize: 12, fontWeight: '700', letterSpacing: 0.9, textAlign: 'left' },
  placeholder: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 24 },
  placeholderText: { fontSize: 16, textAlign: 'center' },
  error: { fontSize: 15, textAlign: 'left' },
  deleteBox: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  confirmText: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  confirmNote: { fontSize: 15, textAlign: 'center' },
});
