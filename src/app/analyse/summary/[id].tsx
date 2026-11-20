import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { loadTraining } from '@/data/analysisRepo';
import { summarizeWorkout, summaryText, type WorkoutSummary } from '@/domain/workoutSummary';
import { Button } from '@/ui/Button';
import { useTheme } from '@/ui/theme';

// One workout's summary (requirement 11), with a Share button.
export default function SummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { user } = useAuth();
  const theme = useTheme();
  const [summary, setSummary] = useState<WorkoutSummary | null | undefined>(undefined);
  const [message, setMessage] = useState<string | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadTraining(db, userId)
      .then((all) => {
        if (cancelled) return;
        const workout = all.find((w) => w.id === id);
        setSummary(workout ? summarizeWorkout(workout) : null);
      })
      .catch(() => !cancelled && setSummary(null));
    return () => {
      cancelled = true;
    };
  }, [db, userId, id]);

  async function share() {
    if (!summary) return;
    setMessage(null);
    try {
      await Share.share({ message: summaryText(summary), title: summary.title });
    } catch {
      setMessage('Sharing isn’t available here. On your phone, this opens the share menu.');
    }
  }

  if (summary === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }
  if (summary === null) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.body, { color: theme.text }]}>This workout could not be found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.column}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
          {summary.title}
        </Text>
        <Text style={[styles.when, { color: theme.textMuted }]}>{summary.when}</Text>
        <Text style={[styles.count, { color: theme.textMuted }]}>
          {summary.exercises.length} {summary.exercises.length === 1 ? 'exercise' : 'exercises'} · {summary.totalSets}{' '}
          {summary.totalSets === 1 ? 'set' : 'sets'}
        </Text>

        {summary.exercises.length === 0 && (
          <Text style={[styles.body, { color: theme.textMuted }]}>No exercises were logged in this workout.</Text>
        )}

        {summary.exercises.map((exercise, index) => (
          <View key={`${exercise.name}${index}`} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.name, { color: theme.text }]}>
              {index + 1}. {exercise.name}
            </Text>
            <Text style={[styles.meta, { color: theme.textMuted }]}>
              {exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}
              {exercise.note ? ` · ${exercise.note}` : ''}
            </Text>
            {exercise.sets.map((set, k) => (
              <View key={k} style={[styles.setRow, { borderTopColor: theme.border }]}>
                <Text style={[styles.setNumber, { color: theme.textMuted }]}>{k + 1}</Text>
                <Text style={[styles.setText, { color: theme.text }]}>{set}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.share}>
          <Button icon="share-outline" label="Share summary" onPress={share} variant="secondary" />
          {message && <Text style={[styles.note, { color: theme.textMuted }]}>{message}</Text>}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 20, flexGrow: 1 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '800' },
  when: { fontSize: 16, marginTop: -4 },
  count: { fontSize: 15, marginBottom: 6 },
  body: { fontSize: 16, textAlign: 'center' },
  card: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  name: { fontSize: 18, fontWeight: '700' },
  meta: { fontSize: 14, marginTop: 2, marginBottom: 6 },
  setRow: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  setNumber: { width: 18, fontSize: 14, fontVariant: ['tabular-nums'] },
  setText: { flex: 1, fontSize: 16, fontVariant: ['tabular-nums'] },
  share: { marginTop: 10, gap: 8 },
  note: { fontSize: 14, textAlign: 'center' },
});
