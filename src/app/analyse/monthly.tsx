import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { listBodyWeights, loadTraining, markSummarySeen } from '@/data/analysisRepo';
import { monthlySummary, monthsWithWorkouts } from '@/domain/monthly';
import { LEVELS, type BodyMuscle } from '@/domain/muscles';
import { formatMonth, monthKey, shiftMonth, type BodyWeightEntry, type TrainingWorkout } from '@/domain/training';
import { getProfile } from '@/data/profileRepo';
import type { Sex } from '@/domain/profile';
import { count, exerciseName, t } from '@/i18n/core';
import { muscleName } from '@/i18n/names';
import { BodyMap, levelColor } from '@/ui/BodyMap';
import { useTheme, type Theme } from '@/ui/theme';

const LEVEL_LABEL = Object.fromEntries(LEVELS.map((l) => [l.level, l.label]));

// The monthly summary (requirements 12, 13 and 19), opening with the body heat map.
export default function Monthly() {
  const params = useLocalSearchParams<{ month?: string }>();
  const db = useSQLiteContext();
  const { user } = useAuth();
  const theme = useTheme();
  const [data, setData] = useState<{ workouts: TrainingWorkout[]; weights: BodyWeightEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<BodyMuscle | null>(null);
  const [sex, setSex] = useState<Sex | null>(null);
  const userId = user?.id;
  const now = useMemo(() => new Date(), []);
  const thisMonth = monthKey(now);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      Promise.all([loadTraining(db, userId), listBodyWeights(db, userId)])
        .then(([workouts, weights]) => !cancelled && setData({ workouts, weights }))
        .catch(() => !cancelled && setError(t('Your workouts could not be loaded.')));
      getProfile(db, userId)
        .then((profile) => !cancelled && setSex(profile.sex))
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, [db, userId]),
  );

  // Without a month in the link: this month if it has workouts, else the latest one that does.
  const month = useMemo(() => {
    if (params.month && /^\d{4}-\d{2}$/.test(params.month)) return params.month;
    if (!data) return thisMonth;
    const months = monthsWithWorkouts(data.workouts);
    return months.includes(thisMonth) ? thisMonth : (months[0] ?? thisMonth);
  }, [params.month, data, thisMonth]);

  const summary = useMemo(
    () => (data ? monthlySummary(month, data.workouts, data.weights, now) : null),
    [data, month, now],
  );

  // Opening a finished month's summary means it no longer needs announcing (requirement 12).
  useFocusEffect(
    useCallback(() => {
      if (userId && month < thisMonth) markSummarySeen(db, userId, month, new Date()).catch(() => undefined);
    }, [db, userId, month, thisMonth]),
  );

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: theme.danger, fontSize: 16 }}>{error}</Text>
      </View>
    );
  }
  if (!summary) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.analyse} />
      </View>
    );
  }

  const levels = new Map(summary.muscles.map((m) => [m.muscle, m.level]));
  const selected = picked ?? summary.mostWorked[0] ?? 'Chest';
  const detail = summary.muscles.find((m) => m.muscle === selected)!;
  const goTo = (target: string) => {
    setPicked(null);
    router.setParams({ month: target });
  };

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.column}>
        <View style={styles.monthRow}>
          <Pressable
            accessibilityLabel={t('Previous month')}
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => goTo(shiftMonth(month, -1))}
            style={styles.arrow}>
            <Ionicons color={theme.text} name="chevron-back" size={26} />
          </Pressable>
          <Text accessibilityRole="header" style={[styles.month, { color: theme.text }]}>
            {formatMonth(month)}
          </Text>
          <Pressable
            accessibilityLabel={t('Next month')}
            accessibilityRole="button"
            accessibilityState={{ disabled: month >= thisMonth }}
            disabled={month >= thisMonth}
            hitSlop={10}
            onPress={() => goTo(shiftMonth(month, 1))}
            style={[styles.arrow, month >= thisMonth && styles.disabled]}>
            <Ionicons color={theme.text} name="chevron-forward" size={26} />
          </Pressable>
        </View>
        <Text style={[styles.stats, { color: theme.textMuted }]}>
          {month === thisMonth
            ? t('{workouts} · {sets} so far', { workouts: count(summary.workouts, 'workout'), sets: count(summary.totalSets, 'set') })
            : `${count(summary.workouts, 'workout')} · ${count(summary.totalSets, 'set')}`}
        </Text>

        <BodyMap levels={levels} onSelect={setPicked} selected={selected} sex={sex} />

        <View style={styles.legend}>
          {LEVELS.map((l) => (
            <View key={l.level} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: levelColor(theme, l.level), borderColor: theme.border }]} />
              <Text style={[styles.legendText, { color: theme.text }]}>{t(l.label)}</Text>
              <Text style={[styles.legendDetail, { color: theme.textMuted }]}>{t(l.detail)}</Text>
            </View>
          ))}
        </View>

        <View
          accessibilityLiveRegion="polite"
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.detailHead}>
            <View style={[styles.swatchLarge, { backgroundColor: levelColor(theme, detail.level), borderColor: theme.border }]} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>{muscleName(detail.muscle)}</Text>
            <Text style={[styles.levelText, { color: theme.textMuted }]}>{t(LEVEL_LABEL[detail.level])}</Text>
          </View>
          <Text style={[styles.body, { color: theme.text }]}>
            {t('{perWeek} sets a week · {sets} sets in {workouts}', {
              perWeek: detail.perWeek,
              sets: detail.sets,
              workouts: count(detail.workouts, 'workout'),
            })}
          </Text>
          <Text style={[styles.body, { color: theme.textMuted }]}>
            {detail.topExercises.length > 0
              ? t('Top exercises: {list}', {
                  list: detail.topExercises.map((e) => `${exerciseName(e.name)} (${e.sets})`).join(', '),
                })
              : detail.sets > 0
                ? t('Worked only as a helper muscle this month.')
                : t('Not trained this month.')}
          </Text>
        </View>

        <Section theme={theme} title={t('All muscle groups')}>
          {summary.muscles.map((m) => (
            <Pressable
              key={m.muscle}
              accessibilityLabel={t('{muscle}: {perWeek} sets a week, {level}', {
                muscle: muscleName(m.muscle),
                perWeek: m.perWeek,
                level: t(LEVEL_LABEL[m.level]),
              })}
              accessibilityRole="button"
              onPress={() => setPicked(m.muscle)}
              style={({ pressed }) => [styles.muscleRow, { borderTopColor: theme.border }, pressed && styles.pressed]}>
              <View style={[styles.swatch, { backgroundColor: levelColor(theme, m.level), borderColor: theme.border }]} />
              <Text style={[styles.muscleName, { color: theme.text }, m.muscle === selected && styles.bold]}>{muscleName(m.muscle)}</Text>
              <Text style={[styles.muscleValue, { color: theme.textMuted }]}>{t('{n}/wk', { n: m.perWeek })}</Text>
              <Text style={[styles.muscleValue, { color: theme.textMuted }]}>{m.volumeKg > 0 ? `${m.volumeKg.toLocaleString('en-GB')} kg` : '—'}</Text>
            </Pressable>
          ))}
          <Text style={[styles.small, { color: theme.textMuted }]}>
            {t('Sets a week and weight moved (load × reps). Helper muscles count half.')}
          </Text>
        </Section>

        <Section theme={theme} title={t('Workout type')}>
          <Text style={[styles.body, { color: theme.text }]}>{summary.split ? t(summary.split) : t('No workouts yet')}</Text>
        </Section>

        <Section theme={theme} title={t('Achievements')}>
          {summary.records.length === 0 && !summary.mostRepeated && (
            <Text style={[styles.body, { color: theme.textMuted }]}>{t('No records this month yet.')}</Text>
          )}
          {summary.records.map((r) => (
            <View key={r.exercise + r.kind} style={styles.bullet}>
              <Ionicons color={theme.analyse} name="trophy" size={18} />
              <Text style={[styles.body, styles.flex, { color: theme.text }]}>
                <Text style={styles.bold}>{exerciseName(r.exercise)}</Text> ·{' '}
                {r.kind === 'weight' ? t('weight record') : r.kind === 'reps' ? t('reps record') : t('time record')}: {r.text}
              </Text>
            </View>
          ))}
          {summary.mostRepeated && (
            <View style={styles.bullet}>
              <Ionicons color={theme.analyse} name="repeat" size={18} />
              <Text style={[styles.body, styles.flex, { color: theme.text }]}>
                {t('Most repeated:')} <Text style={styles.bold}>{exerciseName(summary.mostRepeated.name)}</Text>,{' '}
                {t('in {workouts}', { workouts: count(summary.mostRepeated.workouts, 'workout') })}
              </Text>
            </View>
          )}
        </Section>

        <Section theme={theme} title={t('Executive summary')}>
          <Text style={[styles.body, { color: theme.text }]}>
            <Text style={styles.bold}>{t('Most worked:')}</Text> {summary.mostWorked.map(muscleName).join(', ') || '—'}
          </Text>
          <Text style={[styles.body, { color: theme.text }]}>
            <Text style={styles.bold}>{t('Least worked:')}</Text> {summary.leastWorked.map(muscleName).join(', ')}
          </Text>
          <Text style={[styles.small, { color: theme.textMuted }]}>{t('Volume per muscle group is in the list above.')}</Text>
        </Section>

        <Section theme={theme} title={t('Next month')}>
          <Text style={[styles.body, styles.bold, { color: theme.text }]}>{summary.verdict}</Text>
          {summary.focus.map((line) => (
            <View key={line} style={styles.bullet}>
              <Ionicons color={theme.analyse} name="arrow-forward-circle" size={18} />
              <Text style={[styles.body, styles.flex, { color: theme.text }]}>{line}</Text>
            </View>
          ))}
        </Section>
      </View>
    </ScrollView>
  );
}

function Section({ title, theme, children }: { title: string; theme: Theme; children: React.ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text accessibilityRole="header" style={[styles.cardTitle, { color: theme.text }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40, flexGrow: 1 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 14 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { padding: 6 },
  disabled: { opacity: 0.3 },
  month: { fontSize: 22, fontWeight: '800' },
  stats: { fontSize: 15, textAlign: 'center', marginTop: -6 },
  legend: { gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 16, height: 16, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth },
  swatchLarge: { width: 20, height: 20, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth },
  legendText: { fontSize: 14, fontWeight: '600' },
  legendDetail: { fontSize: 13 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  levelText: { fontSize: 15, marginLeft: 'auto' },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  bold: { fontWeight: '700' },
  flex: { flex: 1 },
  bullet: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  muscleName: { flex: 1, fontSize: 15 },
  muscleValue: { fontSize: 14, minWidth: 64, textAlign: 'right', fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.6 },
});
