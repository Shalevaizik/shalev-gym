import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { markSummarySeen, monthHasWorkouts, summarySeenMonth } from '@/data/analysisRepo';
import { dismissWeightReminder, getProfile } from '@/data/profileRepo';
import { formatMonth, monthKey, shiftMonth } from '@/domain/training';
import { t } from '@/i18n/core';
import { closeStaleWorkout, getActiveWorkout } from '@/data/workoutRepo';
import { needsWeightReminder, type Profile } from '@/domain/profile';
import { formatTime, type Workout } from '@/domain/workout';
import { Button } from '@/ui/Button';
import { SectionButton } from '@/ui/SectionButton';
import { useTheme } from '@/ui/theme';

// The start screen (requirement 18): Workout, Analyse and Eat, and Challenges (coming soon).
export default function Start() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const theme = useTheme();
  const [active, setActive] = useState<Workout | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [soon, setSoon] = useState<'eat' | 'challenges' | null>(null);
  const [readyMonth, setReadyMonth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id;

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      setSoon(null);
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
          if (!cancelled) setError(t('Your data could not be loaded.'));
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
                {t('Your {month} summary is ready', { month: formatMonth(readyMonth) })}
              </Text>
            </View>
            <Text style={[styles.reminderText, { color: theme.textMuted }]}>
              {t('See which muscles you trained most, your records, and what to focus on this month.')}
            </Text>
            <View style={styles.reminderActions}>
              <View style={styles.flex}>
                <Button
                  label={t('Open summary')}
                  onPress={() => router.push({ pathname: '/analyse/monthly', params: { month: readyMonth } })}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  label={t('Later')}
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
                {firstTime ? t('Set up your profile') : t('Time to update your weight')}
              </Text>
            </View>
            <Text style={[styles.reminderText, { color: theme.textMuted }]}>
              {firstTime
                ? t('Add your age, height and weight so bodyweight exercises count toward your progress.')
                : t('It’s been a month. A quick update keeps your bodyweight exercises accurate.')}
            </Text>
            <View style={styles.reminderActions}>
              <View style={styles.flex}>
                <Button label={firstTime ? t('Set up') : t('Update')} onPress={() => router.push('/profile')} />
              </View>
              <View style={styles.flex}>
                <Button label={t('Not now')} onPress={notNow} variant="secondary" />
              </View>
            </View>
          </View>
        )}

        <SectionButton
          background={theme.accent}
          detail={
            active
              ? t('In progress · started at {time}', { time: formatTime(active.startedAt) })
              : t('Start a workout or see past ones')
          }
          foreground={theme.onAccent}
          icon="barbell"
          label={t('Workout')}
          onPress={() => router.push('/workout')}
        />
        <SectionButton
          background={theme.analyse}
          detail={t('Summaries, monthly report and progress')}
          foreground={theme.onAnalyse}
          icon="stats-chart"
          label={t('Analyse')}
          onPress={() => router.push('/analyse')}
        />
        <SectionButton
          background={theme.eat}
          badge={t('Coming soon')}
          detail={t('Track what you eat')}
          foreground={theme.onEat}
          icon="restaurant"
          label={t('Eat')}
          onPress={() => setSoon('eat')}
        />
        <SectionButton
          background={theme.eat}
          badge={t('Coming soon')}
          detail={t('Challenge your friends')}
          foreground={theme.onEat}
          icon="trophy"
          label={t('Challenges')}
          onPress={() => setSoon('challenges')}
        />

        {soon && (
          <Text accessibilityLiveRegion="polite" style={[styles.message, { color: theme.textMuted }]}>
            {soon === 'eat'
              ? t('Eat is coming soon. Nutrition tracking will be added in a later version.')
              : t('Challenges are coming in a later version: pick a workout you did and challenge a friend to beat it.')}
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
