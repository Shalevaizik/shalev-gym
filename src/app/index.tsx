import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { markSummarySeen, monthHasWorkouts, summarySeenMonth } from '@/data/analysisRepo';
import { dismissWeightReminder, getProfile } from '@/data/profileRepo';
import { formatMonth, monthKey, shiftMonth } from '@/domain/training';
import { closeStaleWorkout, getActiveWorkout } from '@/data/workoutRepo';
import { needsWeightReminder, type Profile } from '@/domain/profile';
import { formatTime, type Workout } from '@/domain/workout';
import { Button } from '@/ui/Button';
import { SectionButton } from '@/ui/SectionButton';
import { useTheme } from '@/ui/theme';

// The start screen (requirement 18): Workout, Analyse and Eat.
export default function Start() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const theme = useTheme();
  const [active, setActive] = useState<Workout | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [eatNotice, setEatNotice] = useState(false);
  const [readyMonth, setReadyMonth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id;

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      setEatNotice(false);
      (async () => {
        try {
          await closeStaleWorkout(db, userId, new Date());
          const lastMonth = shiftMonth(monthKey(new Date()), -1);
          const [workout, loadedProfile, trained, seen] = await Promise.all([
            getActiveWorkout(db, userId),
            getProfile(db, userId),
            monthHasWorkouts(db, userId, lastMonth),
            summarySeenMonth(db, userId),
          ]);
          if (cancelled) return;
          setActive(workout);
          setProfile(loadedProfile);
          // Requirement 12: a finished month's summary is announced until it is opened.
          setReadyMonth(trained && (seen ?? '') < lastMonth ? lastMonth : null);
        } catch {
          if (!cancelled) setError('Your data could not be loaded.');
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [db, userId]),
  );

  async function notNow() {
    if (!userId) return;
    const now = new Date();
    setProfile((current) => current && { ...current, reminderDismissedAt: now.toISOString() });
    try {
      await dismissWeightReminder(db, userId, now);
    } catch {
      // Only the reminder is affected: it shows again next time.
    }
  }

  const remind = profile !== null && needsWeightReminder(profile, new Date());
  const firstTime = profile !== null && profile.weight === null;

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.column}>
        {readyMonth && (
          <View style={[styles.reminder, { backgroundColor: theme.surface, borderColor: theme.analyse }]}>
            <View style={styles.reminderTitleRow}>
              <Ionicons color={theme.analyse} name="body" size={24} />
              <Text style={[styles.reminderTitle, { color: theme.text }]}>
                Your {formatMonth(readyMonth)} summary is ready
              </Text>
            </View>
            <Text style={[styles.reminderText, { color: theme.textMuted }]}>
              See which muscles you trained most, your records, and what to focus on this month.
            </Text>
            <View style={styles.reminderActions}>
              <View style={styles.flex}>
                <Button
                  label="Open summary"
                  onPress={() => router.push({ pathname: '/analyse/monthly', params: { month: readyMonth } })}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  label="Later"
                  onPress={() => {
                    const month = readyMonth;
                    setReadyMonth(null);
                    if (userId) markSummarySeen(db, userId, month, new Date()).catch(() => undefined);
                  }}
                  variant="secondary"
                />
              </View>
            </View>
          </View>
        )}
        {remind && (
          <View style={[styles.reminder, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.reminderTitleRow}>
              <Ionicons color={theme.accent} name={firstTime ? 'person-circle-outline' : 'scale-outline'} size={24} />
              <Text style={[styles.reminderTitle, { color: theme.text }]}>
                {firstTime ? 'Set up your profile' : 'Time to update your weight'}
              </Text>
            </View>
            <Text style={[styles.reminderText, { color: theme.textMuted }]}>
              {firstTime
                ? 'Add your age, height and weight so bodyweight exercises count toward your progress.'
                : 'It’s been a month. A quick update keeps your bodyweight exercises accurate.'}
            </Text>
            <View style={styles.reminderActions}>
              <View style={styles.flex}>
                <Button label={firstTime ? 'Set up' : 'Update'} onPress={() => router.push('/profile')} />
              </View>
              <View style={styles.flex}>
                <Button label="Not now" onPress={notNow} variant="secondary" />
              </View>
            </View>
          </View>
        )}

        <SectionButton
          background={theme.accent}
          detail={active ? `In progress · started at ${formatTime(active.startedAt)}` : 'Start a workout or see past ones'}
          foreground={theme.onAccent}
          icon="barbell"
          label={active ? 'Continue workout' : 'Workout'}
          onPress={() =>
            active ? router.push({ pathname: '/workout/[id]', params: { id: active.id } }) : router.push('/workout')
          }
        />
        {active && (
          // While a workout runs, the big button goes straight back to it, so this is the way to
          // the workout history.
          <Button
            icon="time-outline"
            label="Previous workouts"
            onPress={() => router.push('/workout/history')}
            variant="plain"
          />
        )}
        <SectionButton
          background={theme.analyse}
          detail="Summaries, monthly report and progress"
          foreground={theme.onAnalyse}
          icon="stats-chart"
          label="Analyse"
          onPress={() => router.push('/analyse')}
        />
        <SectionButton
          background={theme.eat}
          badge="Coming soon"
          detail="Track what you eat"
          foreground={theme.onEat}
          icon="restaurant"
          label="Eat"
          onPress={() => setEatNotice(true)}
        />

        {eatNotice && (
          <Text accessibilityLiveRegion="polite" style={[styles.message, { color: theme.textMuted }]}>
            Eat is coming soon. Nutrition tracking will be added in a later version.
          </Text>
        )}
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
  flex: { flex: 1 },
  reminder: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  reminderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reminderTitle: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  reminderText: { fontSize: 15, lineHeight: 21 },
  reminderActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  message: { fontSize: 15, textAlign: 'center' },
});
