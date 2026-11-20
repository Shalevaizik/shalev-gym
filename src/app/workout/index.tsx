import { randomUUID } from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { closeStaleWorkout, getActiveWorkout, startWorkout } from '@/data/workoutRepo';
import { formatTime, type Workout } from '@/domain/workout';
import { SectionButton } from '@/ui/SectionButton';
import { useTheme } from '@/ui/theme';

// Behind the Workout button (requirement 18a): start a new workout or see previous ones.
export default function WorkoutHome() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const theme = useTheme();
  const [active, setActive] = useState<Workout | null | undefined>(undefined);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id;

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      (async () => {
        try {
          await closeStaleWorkout(db, userId, new Date());
          const workout = await getActiveWorkout(db, userId);
          if (!cancelled) setActive(workout);
        } catch {
          if (!cancelled) setError('Your workouts could not be loaded.');
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [db, userId]),
  );

  async function start() {
    if (!userId || starting || active === undefined) return;
    if (active) {
      router.push({ pathname: '/workout/[id]', params: { id: active.id } });
      return;
    }
    setError(null);
    setStarting(true);
    try {
      const workout = await startWorkout(db, userId, randomUUID(), new Date());
      router.push({ pathname: '/workout/[id]', params: { id: workout.id } });
    } catch {
      setError('The workout could not be started. Please try again.');
    } finally {
      setStarting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.column}>
        <SectionButton
          background={theme.accent}
          detail={
            active
              ? `In progress · started at ${formatTime(active.startedAt)}`
              : starting
                ? 'Starting…'
                : 'The clock starts now'
          }
          foreground={theme.onAccent}
          icon={active ? 'play' : 'add-circle'}
          label={active ? 'Continue workout' : 'Start new workout'}
          onPress={start}
        />
        <SectionButton
          background={theme.surface}
          detail="Every workout by day, with its title"
          foreground={theme.text}
          icon="time-outline"
          label="Previous workouts"
          onPress={() => router.push('/workout/history')}
        />
        {error && (
          <Text accessibilityLiveRegion="polite" style={[styles.error, { color: theme.danger }]}>
            {error}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, flexGrow: 1 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 16 },
  error: { fontSize: 15, textAlign: 'center' },
});
