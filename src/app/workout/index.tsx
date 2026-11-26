import { randomUUID } from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { closeStaleWorkout, getActiveWorkout, startWorkout } from '@/data/workoutRepo';
import { formatTime, type Workout } from '@/domain/workout';
import { t } from '@/i18n/core';
import { SectionButton } from '@/ui/SectionButton';
import { useTheme } from '@/ui/theme';

// Behind the Workout button (requirement 18a): continue the workout in progress, or start a new
// one, Manual (choose exercises as you go) or Smart (the app plans it; coming soon, it needs the
// online AI service), and previous workouts beneath.
export default function WorkoutHome() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const theme = useTheme();
  const [active, setActive] = useState<Workout | null | undefined>(undefined);
  const [starting, setStarting] = useState(false);
  const [smartNotice, setSmartNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id;

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      setSmartNotice(false);
      (async () => {
        try {
          await closeStaleWorkout(db, userId, new Date());
          const workout = await getActiveWorkout(db, userId);
          if (!cancelled) setActive(workout);
        } catch {
          if (!cancelled) setError(t('Your workouts could not be loaded.'));
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
      setError(t('The workout could not be started. Please try again.'));
    } finally {
      setStarting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.column}>
        {active ? (
          <SectionButton
            background={theme.accent}
            detail={t('In progress · started at {time}', { time: formatTime(active.startedAt) })}
            foreground={theme.onAccent}
            icon="play"
            label={t('Continue workout')}
            onPress={start}
          />
        ) : (
          <>
            <Text style={[styles.heading, { color: theme.textMuted }]}>{t('START A NEW WORKOUT')}</Text>
            <SectionButton
              background={theme.accent}
              detail={starting ? t('Starting…') : t('Choose your exercises as you go. The clock starts now.')}
              foreground={theme.onAccent}
              icon="add-circle"
              label={t('Manual workout')}
              onPress={start}
            />
            <SectionButton
              background={theme.eat}
              badge={t('Coming soon')}
              detail={t('Say how much time you have and get today’s workout')}
              foreground={theme.onEat}
              icon="sparkles"
              label={t('Smart workout')}
              onPress={() => setSmartNotice(true)}
            />
            {smartNotice && (
              <Text accessibilityLiveRegion="polite" style={[styles.message, { color: theme.textMuted }]}>
                {t(
                  'Smart workout is coming soon. It will plan today’s workout from what you trained this week and the time you have, and suggest a working weight for each exercise.',
                )}
              </Text>
            )}
          </>
        )}
        <SectionButton
          background={theme.surface}
          detail={t('Every workout by day, with its title')}
          foreground={theme.text}
          icon="time-outline"
          label={t('Previous workouts')}
          onPress={() => router.push('/workout/history')}
        />
        {error && (
          <Text accessibilityLiveRegion="polite" style={[styles.message, { color: theme.danger }]}>
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
  heading: { fontSize: 13, fontWeight: '700', letterSpacing: 0.9, marginBottom: -6, textAlign: 'left' },
  message: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
});
