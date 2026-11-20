import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { loadTraining } from '@/data/analysisRepo';
import { exercisesDone } from '@/domain/progress';
import { useTheme } from '@/ui/theme';

// Analyse → Progress: pick an exercise to see how it has improved.
export default function ProgressList() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const theme = useTheme();
  const [list, setList] = useState<ReturnType<typeof exercisesDone> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id;

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      loadTraining(db, userId)
        .then((workouts) => !cancelled && setList(exercisesDone(workouts)))
        .catch(() => !cancelled && setError('Your exercises could not be loaded.'));
      return () => {
        cancelled = true;
      };
    }, [db, userId]),
  );

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.column}>
        {error && <Text style={[styles.message, { color: theme.danger }]}>{error}</Text>}
        {list !== null && list.length === 0 && (
          <Text style={[styles.message, { color: theme.textMuted }]}>Exercises you log will appear here.</Text>
        )}
        {list?.map((item) => (
          <Pressable
            key={item.name}
            accessibilityLabel={`${item.name}, ${item.workouts} ${item.workouts === 1 ? 'workout' : 'workouts'}`}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/analyse/progress/[name]', params: { name: item.name } })}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
              pressed && styles.pressed,
            ]}>
            <View style={styles.flex}>
              <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.detail, { color: theme.textMuted }]}>
                {item.workouts} {item.workouts === 1 ? 'workout' : 'workouts'} · last{' '}
                {new Date(item.last).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
            <Ionicons color={theme.textMuted} name="chevron-forward" size={20} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, flexGrow: 1 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 10 },
  message: { fontSize: 16, textAlign: 'center', marginTop: 40 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  name: { fontSize: 17, fontWeight: '700' },
  detail: { fontSize: 14, marginTop: 2 },
  pressed: { opacity: 0.7 },
});
