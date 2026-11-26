import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { equipmentLabel, formatSetFor } from '@/domain/equipment';
import { kindOf, type LoggedExercise } from '@/domain/exerciseLog';
import { describeMovement, describeStructure, KIND_LABEL } from '@/domain/session';
import { formatTime } from '@/domain/workout';
import { count, exerciseName, t } from '@/i18n/core';
import { muscleName } from '@/i18n/names';

import { useTheme } from './theme';

type Props = {
  exercise: LoggedExercise;
  inSuperset: boolean;
  onEdit: () => void;
  // Shown while the workout is in progress, to add more sets to a finished exercise.
  onResume?: () => void;
};

export function ExerciseCard({ exercise, inSuperset, onEdit, onResume }: Props) {
  const theme = useTheme();
  const sets = exercise.sets.length;
  const cardio = exercise.equipment === 'cardio';
  const tags = [
    exercise.muscle && muscleName(exercise.muscle),
    exercise.equipment && !cardio && equipmentLabel(exercise.equipment),
    inSuperset && t('Superset'),
    exercise.technique && capitalize(t(exercise.technique)),
  ].filter(Boolean) as string[];

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={[styles.name, { color: theme.text }]}>{exerciseName(exercise.name)}</Text>
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            {exercise.session
              ? [KIND_LABEL[exercise.session.kind], describeStructure(exercise.session)].join(' · ')
              : [count(sets, cardio ? 'session' : 'set'), ...tags].join(' · ')}
          </Text>
        </View>
        <View style={styles.actions}>
          {onResume && (
            <Pressable
              accessibilityLabel={t('Add more sets to {name}', { name: exerciseName(exercise.name) })}
              accessibilityRole="button"
              android_ripple={{ color: theme.ripple }}
              hitSlop={8}
              onPress={onResume}
              style={({ pressed }) => [styles.edit, { borderColor: theme.border }, pressed && styles.pressed]}>
              <Ionicons color={theme.accent} name="add" size={18} />
            </Pressable>
          )}
          <Pressable
            accessibilityLabel={t('Edit {name}', { name: exerciseName(exercise.name) })}
            accessibilityRole="button"
            android_ripple={{ color: theme.ripple }}
            hitSlop={8}
            onPress={onEdit}
            style={({ pressed }) => [styles.edit, { borderColor: theme.border }, pressed && styles.pressed]}>
            <Text style={[styles.editLabel, { color: theme.accent }]}>{t('Edit')}</Text>
          </Pressable>
        </View>
      </View>

      {/* A HIIT or CrossFit session lists its movements, then its time (requirement 24e). */}
      {exercise.session?.movements.map((movement, index) => (
        <View key={`m${index}`} style={[styles.setRow, { borderTopColor: theme.border }]}>
          <Text style={[styles.setNumber, { color: theme.textMuted }]}>•</Text>
          <Text style={[styles.setText, { color: theme.text }]}>{describeMovement(movement)}</Text>
        </View>
      ))}
      {exercise.sets.map((set, index) => (
        <View key={set.id} style={[styles.setRow, { borderTopColor: theme.border }]}>
          <Text style={[styles.setNumber, { color: theme.textMuted }]}>{exercise.session ? '⏱' : index + 1}</Text>
          <Text style={[styles.setText, { color: theme.text }]}>
            {exercise.session ? t('Time: {time}', { time: formatSetFor(set, kindOf(exercise)) }) : formatSetFor(set, kindOf(exercise))}
          </Text>
          {set.endedAt && (
            <Text
              accessibilityLabel={t('About {time}', { time: formatTime(set.endedAt) })}
              style={[styles.setTime, { color: theme.textMuted }]}>
              ~{formatTime(set.endedAt)}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 6 },
  titleBlock: { flex: 1, minWidth: 0 },
  name: { fontSize: 18, fontWeight: '700', textAlign: 'left' },
  meta: { fontSize: 14, marginTop: 2, textAlign: 'left' },
  actions: { flexDirection: 'row', gap: 8 },
  edit: {
    minHeight: 38,
    minWidth: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  editLabel: { fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  setNumber: { width: 18, fontSize: 14, fontVariant: ['tabular-nums'] },
  setText: { flex: 1, fontSize: 16, fontVariant: ['tabular-nums'] },
  setTime: { fontSize: 13, fontVariant: ['tabular-nums'] },
});
