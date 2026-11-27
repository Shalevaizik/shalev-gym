import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { loadTraining, markSummarySeen, monthHasWorkouts, summarySeenMonth } from '@/data/analysisRepo';
import { dismissWeightReminder, getProfile } from '@/data/profileRepo';
import { closeStaleWorkout, getActiveWorkout } from '@/data/workoutRepo';
import { needsWeightReminder, type Profile } from '@/domain/profile';
import { formatMonth, monthKey, shiftMonth, type TrainingWorkout } from '@/domain/training';
import { WEEKLY_SET_GOAL, WEEKLY_WORKOUT_GOAL, weekOf } from '@/domain/week';
import { formatTime, type Workout } from '@/domain/workout';
import { workoutTitle } from '@/domain/workoutTitle';
import { dateLocale, t } from '@/i18n/core';
import { Button } from '@/ui/Button';
import { Glow } from '@/ui/Glow';
import { haptic } from '@/ui/haptics';
import { TabBar } from '@/ui/TabBar';
import { FONT, useTheme } from '@/ui/theme';
import { WeekRing } from '@/ui/WeekRing';
import { WeekStrip } from '@/ui/WeekStrip';

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return t('Good morning');
  if (hour < 18) return t('Good afternoon');
  return t('Good evening');
}

// The start screen (requirement 18, design D): this week's ring and days, one big button to start
// or continue a workout, and the tab bar (Home, Workouts, Analyse, Eat and Challenge coming soon).
export default function Start() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const theme = useTheme();
  const [active, setActive] = useState<Workout | null>(null);
  const [training, setTraining] = useState<TrainingWorkout[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [soon, setSoon] = useState<'eat' | 'challenge' | null>(null);
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
          const [workout, loadedProfile, trained, seen, all] = await Promise.all([
            getActiveWorkout(db, userId),
            getProfile(db, userId),
            monthHasWorkouts(db, userId, lastMonth),
            summarySeenMonth(db, userId),
            loadTraining(db, userId),
          ]);
          if (cancelled) return;
          setActive(workout);
          setProfile(loadedProfile);
          setTraining(all);
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

  const now = useMemo(() => new Date(), [training]); // eslint-disable-line react-hooks/exhaustive-deps
  const week = useMemo(
    () =>
      weekOf(
        training
          .filter((w) => w.exercises.some((e) => e.sets.length > 0))
          .map((w) => ({
            startedAt: w.startedAt,
            title: w.title ?? workoutTitle(w.exercises.map((e) => ({ name: e.name, muscle: e.muscle, sets: e.sets.length }))),
            sets: w.exercises.reduce((n, e) => n + e.sets.length, 0),
          })),
        now,
      ),
    [training, now],
  );

  async function notNow() {
    if (!userId) return;
    const at = new Date();
    setProfile((current) => current && { ...current, reminderDismissedAt: at.toISOString() });
    try {
      await dismissWeightReminder(db, userId, at);
    } catch {
      // Only the reminder is affected: it shows again next time.
    }
  }

  const remind = profile !== null && needsWeightReminder(profile, new Date());
  const firstTime = profile !== null && profile.weight === null;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Glow left={10} top={120} />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.column}>
          <View>
            <Text style={[styles.eyebrow, { color: theme.textMuted }]}>
              {now.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
            </Text>
            <Text accessibilityRole="header" style={[styles.hello, { color: theme.text }]}>
              {greeting(now)}
            </Text>
          </View>

          {readyMonth && (
            <View style={[styles.card, styles.reminder, { backgroundColor: theme.surface, borderColor: theme.accent }]}>
              <View style={styles.reminderTitleRow}>
                <Ionicons color={theme.accent} name="body" size={22} />
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
            <View style={[styles.card, styles.reminder, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.reminderTitleRow}>
                <Ionicons color={theme.accent} name={firstTime ? 'person-circle-outline' : 'scale-outline'} size={22} />
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

          <View style={[styles.card, styles.ringCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <WeekRing setGoal={WEEKLY_SET_GOAL} sets={week.sets} workoutGoal={WEEKLY_WORKOUT_GOAL} workouts={week.workouts} />
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.accent }]} />
                <Text style={[styles.legendText, { color: theme.textMuted }]}>
                  {t('Workouts {n} of {goal}', { n: week.workouts, goal: WEEKLY_WORKOUT_GOAL })}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.text, opacity: 0.75 }]} />
                <Text style={[styles.legendText, { color: theme.textMuted }]}>
                  {t('Sets {n} of {goal}', { n: week.sets, goal: WEEKLY_SET_GOAL })}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.card, styles.weekCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.weekHeader}>
              <Text style={[styles.eyebrow, { color: theme.textMuted }]}>{t('THIS WEEK')}</Text>
              <Text style={[styles.small, { color: theme.textMuted }]}>
                {week.restDays === 1 ? t('1 rest day') : t('{n} rest days', { n: week.restDays })}
              </Text>
            </View>
            <WeekStrip days={week.days} />
          </View>

          {error && (
            <Text accessibilityLiveRegion="polite" style={[styles.message, { color: theme.danger }]}>
              {error}
            </Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottom}>
        {soon && (
          <Text accessibilityLiveRegion="polite" style={[styles.message, { color: theme.textMuted }]}>
            {soon === 'eat'
              ? t('Eat is coming soon. Nutrition tracking will be added in a later version.')
              : t('Challenges are coming in a later version: pick a workout you did and challenge a friend to beat it.')}
          </Text>
        )}
        <Pressable
          accessibilityHint={active ? t('Goes back to the workout in progress') : t('Choose a manual or smart workout')}
          accessibilityRole="button"
          android_ripple={{ color: 'rgba(0,0,0,0.12)' }}
          onPress={() => {
            haptic.press();
            if (active) router.push({ pathname: '/workout/[id]', params: { id: active.id } });
            else router.push('/workout');
          }}
          style={({ pressed }) => [styles.start, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
          <Ionicons color={theme.onAccent} name={active ? 'play' : 'add'} size={24} />
          <View>
            <Text style={[styles.startLabel, { color: theme.onAccent }]}>
              {active ? t('Continue workout') : t('Start a new workout')}
            </Text>
            {active && (
              <Text style={[styles.startDetail, { color: theme.onAccent }]}>
                {t('In progress · started at {time}', { time: formatTime(active.startedAt) })}
              </Text>
            )}
          </View>
        </Pressable>
        <TabBar current="home" onSoon={setSoon} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 12, flexGrow: 1 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 14 },
  flex: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  hello: { fontSize: 26, fontFamily: FONT.display, marginTop: 2 },
  card: { borderWidth: 1, borderRadius: 22 },
  ringCard: { alignItems: 'center', paddingTop: 16, paddingBottom: 14, paddingHorizontal: 12, gap: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13 },
  weekCard: { padding: 12, gap: 10 },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  small: { fontSize: 12 },
  reminder: { padding: 16, gap: 10 },
  reminderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reminderTitle: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
  reminderText: { fontSize: 15, lineHeight: 21 },
  reminderActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  bottom: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 14, gap: 10 },
  start: {
    minHeight: 64,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  startLabel: { fontSize: 20, fontFamily: FONT.display },
  startDetail: { fontSize: 12, fontWeight: '600', opacity: 0.75 },
  message: { fontSize: 14, textAlign: 'center' },
  pressed: { opacity: 0.88 },
});
