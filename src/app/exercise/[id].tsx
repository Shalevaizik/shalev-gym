import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { deleteExercise, getExercise, updateExercise } from '@/data/exerciseRepo';
import {
  BAR_TYPES,
  barTypeFor,
  DEFAULT_BAR_KG,
  equipmentLabel,
  formatSetFor,
  isOneArm,
  type Equipment,
  type Measure,
} from '@/domain/equipment';
import {
  type LoggedExercise,
  type Technique,
  type WeightUnit,
} from '@/domain/exerciseLog';
import { t } from '@/i18n/core';
import { Button } from '@/ui/Button';
import { useTheme, type Theme } from '@/ui/theme';

type DraftSet = {
  key: string;
  id?: string;
  weight: string;
  unit: WeightUnit;
  reps: string;
  duration: string;
  toFailure: boolean;
};

const EQUIPMENT_ORDER: Equipment[] = ['barbell', 'dumbbells', 'dumbbell', 'machine', 'plates', 'bodyweight', 'cardio'];

// What the weight field means for each equipment type (requirement 17). Cardio has no weight.
const WEIGHT_LABEL: Record<Equipment, string> = {
  barbell: 'Weight per side',
  dumbbells: 'One dumbbell',
  dumbbell: 'Dumbbell',
  machine: 'Weight',
  plates: 'Weight per side',
  bodyweight: 'Added weight',
  cardio: 'Weight',
};

// Cardio sessions are entered in whole minutes; the time is stored in seconds.
const minutesOf = (seconds: string) => (seconds.trim() ? String(Math.round(Number(seconds) / 60)) : '');

const TECHNIQUES: { value: Technique | null; label: string }[] = [
  { value: null, label: 'Normal' },
  { value: 'pyramid', label: 'Pyramid' },
  { value: 'drop set', label: 'Drop set' },
];

function toDraft(exercise: LoggedExercise): DraftSet[] {
  const fallbackUnit = exercise.sets.find((s) => s.unit)?.unit ?? 'kg';
  return exercise.sets.map((set) => ({
    key: set.id,
    id: set.id,
    weight: set.weight === null ? '' : String(set.weight),
    unit: set.unit ?? fallbackUnit,
    reps: set.reps === null ? '' : String(set.reps),
    duration: set.durationS == null ? '' : String(set.durationS),
    toFailure: set.toFailure,
  }));
}

function readWeight(text: string): number | null | 'invalid' {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : 'invalid';
}

function readReps(text: string): number | null | 'invalid' {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : 'invalid';
}

export default function EditExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { user } = useAuth();
  const theme = useTheme();
  const [exercise, setExercise] = useState<LoggedExercise | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [technique, setTechnique] = useState<Technique | null>(null);
  const [sets, setSets] = useState<DraftSet[]>([]);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [measure, setMeasure] = useState<Measure>('reps');
  const [bar, setBar] = useState(String(DEFAULT_BAR_KG));
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id;
  const cardio = equipment === 'cardio';

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getExercise(db, userId, id)
      .then((loaded) => {
        if (cancelled) return;
        setExercise(loaded);
        if (loaded) {
          setName(loaded.name);
          setTechnique(loaded.technique);
          setSets(toDraft(loaded));
          setEquipment(loaded.equipment);
          setMeasure(loaded.measure);
          setBar(String(loaded.barKg ?? DEFAULT_BAR_KG));
        }
      })
      .catch(() => {
        if (!cancelled) setError(t('This exercise could not be loaded.'));
      });
    return () => {
      cancelled = true;
    };
  }, [db, userId, id]);

  function changeSet(key: string, change: Partial<DraftSet>) {
    setSets((current) => current.map((set) => (set.key === key ? { ...set, ...change } : set)));
  }

  function addSet() {
    setSets((current) => {
      const last = current[current.length - 1];
      return [
        ...current,
        {
          key: randomUUID(),
          weight: last?.weight ?? '',
          unit: last?.unit ?? 'kg',
          reps: last?.reps ?? '',
          duration: last?.duration ?? '',
          toFailure: false,
        },
      ];
    });
  }

  async function save() {
    if (!userId) return;
    setError(null);
    if (!name.trim()) {
      setError(t('Give the exercise a name.'));
      return;
    }
    if (sets.length === 0) {
      setError(t('Add at least one set, or delete the exercise.'));
      return;
    }
    const parsed = [];
    for (const [index, set] of sets.entries()) {
      const weight = readWeight(set.weight);
      const reps = readReps(set.reps);
      if (weight === 'invalid') {
        setError(t('Set {n}: the weight must be a number, or empty for bodyweight.', { n: index + 1 }));
        return;
      }
      if (reps === 'invalid') {
        setError(t('Set {n}: reps must be a whole number.', { n: index + 1 }));
        return;
      }
      const duration = readReps(set.duration);
      if (measure === 'time' && (duration === 'invalid' || duration === null || duration === 0)) {
        setError(
          cardio
            ? t('Session {n}: enter the time in minutes.', { n: index + 1 })
            : t('Set {n}: enter the time in seconds.', { n: index + 1 }),
        );
        return;
      }
      parsed.push({
        id: set.id,
        weight: cardio ? null : weight,
        unit: weight === null || cardio ? null : set.unit,
        reps: measure === 'time' ? null : reps,
        toFailure: set.toFailure,
        ...(measure === 'time' && typeof duration === 'number' && { durationS: duration }),
      });
    }
    const barKg = readWeight(bar);
    if (equipment === 'barbell' && (barKg === 'invalid' || barKg === null)) {
      setError(t('Enter the bar’s weight in kg, for example 20.'));
      return;
    }
    const kind = equipment
      ? { equipment, measure, barKg: equipment === 'barbell' && typeof barKg === 'number' ? barKg : null }
      : undefined;

    setSaving(true);
    try {
      await updateExercise(db, userId, id, { name, technique, sets: parsed, kind }, randomUUID);
      router.back();
    } catch {
      setError(t('The changes could not be saved. Please try again.'));
      setSaving(false);
    }
  }

  async function remove() {
    if (!userId) return;
    setSaving(true);
    try {
      await deleteExercise(db, userId, id);
      router.back();
    } catch {
      setError(t('The exercise could not be deleted. Please try again.'));
      setSaving(false);
    }
  }

  if (exercise === undefined) {
    return (
      <View style={styles.centered}>
        {error ? (
          <Text style={[styles.message, { color: theme.danger }]}>{error}</Text>
        ) : (
          <ActivityIndicator color={theme.accent} />
        )}
      </View>
    );
  }

  if (exercise === null) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.message, { color: theme.text }]}>{t('This exercise could not be found.')}</Text>
      </View>
    );
  }

  const preview = (set: DraftSet, weight: number | null) => {
    const reps = readReps(set.reps);
    const seconds = Number(set.duration);
    return formatSetFor(
      {
        weight,
        unit: weight === null ? null : set.unit,
        reps: measure === 'time' || reps === 'invalid' ? null : reps,
        toFailure: false,
        ...(measure === 'time' && seconds > 0 && { durationS: seconds }),
      },
      equipment
        ? {
            equipment,
            measure,
            barKg: Number(bar.replace(',', '.')) || DEFAULT_BAR_KG,
            ...(isOneArm(exercise.name) && { oneArm: true as const }),
          }
        : null,
    );
  };

  const inputStyle = [
    styles.input,
    { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <Text style={[styles.label, { color: theme.textMuted }]}>{t('Exercise')}</Text>
          <TextInput
            accessibilityLabel={t('Exercise name')}
            id="exercise-name"
            onChangeText={setName}
            style={inputStyle}
            value={name}
          />

          {exercise.spokenText && (
            <Text style={[styles.heard, { color: theme.textMuted }]}>
              {t('You said: “{text}”', { text: exercise.spokenText })}
            </Text>
          )}

          <Text style={[styles.label, styles.section, { color: theme.textMuted }]}>{t('Equipment')}</Text>
          <View style={styles.chips}>
            {EQUIPMENT_ORDER.map((option) => (
              <Chip
                key={option}
                label={equipmentLabel(option)}
                onPress={() => {
                  setEquipment(option);
                  if (option === 'cardio') setMeasure('time');
                }}
                selected={equipment === option}
                theme={theme}
              />
            ))}
          </View>
          {equipment === null && (
            <Text style={[styles.heard, { color: theme.textMuted }]}>
              {t('Saved before equipment types existed. Pick one to show its weights the new way.')}
            </Text>
          )}
          {equipment === 'barbell' && (
            <View style={styles.barRow}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t('Bar')}</Text>
              <View style={styles.chips}>
                {BAR_TYPES.map((option) => (
                  <Chip
                    key={option.type}
                    label={`${t(option.label)} · ${option.kg} kg`}
                    onPress={() => setBar(String(option.kg))}
                    selected={barTypeFor(Number(bar.replace(',', '.'))) === option.type}
                    theme={theme}
                  />
                ))}
                <Chip
                  label={t('Other')}
                  onPress={() => {
                    if (barTypeFor(Number(bar.replace(',', '.'))) !== 'other') setBar('');
                  }}
                  selected={barTypeFor(Number(bar.replace(',', '.'))) === 'other'}
                  theme={theme}
                />
              </View>
            </View>
          )}
          {equipment === 'barbell' && (
            <View style={styles.barRow}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t('Bar weight (kg)')}</Text>
              <TextInput
                accessibilityLabel={t('Bar weight in kg')}
                inputMode="decimal"
                keyboardType="decimal-pad"
                onChangeText={setBar}
                placeholder={t('e.g. 15')}
                placeholderTextColor={theme.textMuted}
                style={[inputStyle, styles.barInput]}
                value={bar}
              />
            </View>
          )}

          {!cardio && (
            <>
              <Text style={[styles.label, styles.section, { color: theme.textMuted }]}>{t('Measured in')}</Text>
              <View style={styles.chips}>
                <Chip label={t('Reps')} onPress={() => setMeasure('reps')} selected={measure === 'reps'} theme={theme} />
                <Chip label={t('Time')} onPress={() => setMeasure('time')} selected={measure === 'time'} theme={theme} />
              </View>

              <Text style={[styles.label, styles.section, { color: theme.textMuted }]}>{t('Type')}</Text>
              <View style={styles.chips}>
                {TECHNIQUES.map((option) => (
                  <Chip
                    key={option.label}
                    label={t(option.label)}
                    onPress={() => setTechnique(option.value)}
                    selected={technique === option.value}
                    theme={theme}
                  />
                ))}
              </View>
            </>
          )}

          <Text style={[styles.label, styles.section, { color: theme.textMuted }]}>{cardio ? t('Sessions') : t('Sets')}</Text>
          <View style={styles.sets}>
            {sets.map((set, index) => {
              const weight = readWeight(set.weight);
              return (
                <View
                  key={set.key}
                  style={[styles.setCard, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  <View style={styles.setHeader}>
                    <Text style={[styles.setTitle, { color: theme.text }]}>
                      {cardio ? t('Session {n}', { n: index + 1 }) : t('Set {n}', { n: index + 1 })}
                    </Text>
                    <Pressable
                      accessibilityLabel={t('Remove set {n}', { n: index + 1 })}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => setSets((current) => current.filter((s) => s.key !== set.key))}>
                      <Text style={[styles.remove, { color: theme.danger }]}>{t('Remove')}</Text>
                    </Pressable>
                  </View>

                  <View style={styles.fields}>
                    {!cardio && (
                    <View style={styles.field}>
                      <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
                        {t(equipment ? WEIGHT_LABEL[equipment] : 'Weight')}
                      </Text>
                      <TextInput
                        accessibilityLabel={t('Set {n} weight', { n: index + 1 })}
                        id={`set-${set.key}-weight`}
                        inputMode="decimal"
                        keyboardType="decimal-pad"
                        onChangeText={(text) => changeSet(set.key, { weight: text })}
                        placeholder={equipment === 'barbell' ? t('Empty bar') : equipment === 'bodyweight' ? t('None') : equipment ? '' : t('Bodyweight')}
                        placeholderTextColor={theme.textMuted}
                        style={inputStyle}
                        value={set.weight}
                      />
                    </View>
                    )}
                    {!cardio && (
                    <View style={styles.unitToggle}>
                      {(['kg', 'lb'] as const).map((unit) => (
                        <Chip
                          key={unit}
                          label={unit}
                          onPress={() => changeSet(set.key, { unit })}
                          selected={set.unit === unit}
                          theme={theme}
                        />
                      ))}
                    </View>
                    )}
                    {cardio ? (
                      <View style={styles.field}>
                        <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t('Minutes')}</Text>
                        <TextInput
                          accessibilityLabel={t('Session {n} minutes', { n: index + 1 })}
                          id={`set-${set.key}-minutes`}
                          inputMode="numeric"
                          keyboardType="number-pad"
                          onChangeText={(text) =>
                            changeSet(set.key, { duration: /^\d+$/.test(text.trim()) ? String(Number(text) * 60) : text })
                          }
                          style={inputStyle}
                          value={/^\d+$/.test(set.duration) ? minutesOf(set.duration) : set.duration}
                        />
                      </View>
                    ) : measure === 'time' ? (
                      <View style={styles.field}>
                        <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t('Seconds')}</Text>
                        <TextInput
                          accessibilityLabel={t('Set {n} seconds', { n: index + 1 })}
                          id={`set-${set.key}-seconds`}
                          inputMode="numeric"
                          keyboardType="number-pad"
                          onChangeText={(text) => changeSet(set.key, { duration: text })}
                          style={inputStyle}
                          value={set.duration}
                        />
                      </View>
                    ) : (
                      <View style={styles.field}>
                        <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t('Reps')}</Text>
                        <TextInput
                          accessibilityLabel={t('Set {n} reps', { n: index + 1 })}
                          id={`set-${set.key}-reps`}
                          inputMode="numeric"
                          keyboardType="number-pad"
                          onChangeText={(text) => changeSet(set.key, { reps: text })}
                          style={inputStyle}
                          value={set.reps}
                        />
                      </View>
                    )}
                  </View>

                  <View style={styles.setFooter}>
                    {!cardio && (
                    <Chip
                      label={t('To failure')}
                      onPress={() => changeSet(set.key, { toFailure: !set.toFailure })}
                      selected={set.toFailure}
                      theme={theme}
                    />
                    )}
                    {weight !== 'invalid' && (
                      <Text style={[styles.converted, { color: theme.textMuted }]}>
                        {preview(set, weight)}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.addSet}>
            <Button label={cardio ? t('Add session') : t('Add set')} onPress={addSet} variant="secondary" />
          </View>

          {error && (
            <Text accessibilityLiveRegion="polite" style={[styles.error, { color: theme.danger }]}>
              {error}
            </Text>
          )}

          <View style={styles.actions}>
            <Button busy={saving && !confirmingDelete} label={t('Save changes')} onPress={save} />
            {confirmingDelete ? (
              <>
                <Text style={[styles.confirmText, { color: theme.text }]}>
                  {t('Delete {name} and its sets?', { name: exercise.name })}
                </Text>
                <Button busy={saving} label={t('Yes, delete exercise')} onPress={remove} variant="danger" />
                <Button
                  disabled={saving}
                  label={t('Keep it')}
                  onPress={() => setConfirmingDelete(false)}
                  variant="secondary"
                />
              </>
            ) : (
              <Button
                disabled={saving}
                label={t('Delete exercise')}
                onPress={() => setConfirmingDelete(true)}
                variant="secondary"
              />
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Chip({
  label,
  selected,
  onPress,
  theme,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: Theme;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? theme.accent : theme.border,
          backgroundColor: selected ? theme.accent : 'transparent',
        },
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.chipLabel, { color: selected ? theme.onAccent : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { fontSize: 17, textAlign: 'center' },
  content: { padding: 20, flexGrow: 1 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  section: { marginTop: 22 },
  heard: { fontSize: 14, lineHeight: 20, marginTop: 8, fontStyle: 'italic' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipLabel: { fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  sets: { gap: 12 },
  setCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 12 },
  setHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  setTitle: { fontSize: 16, fontWeight: '700' },
  remove: { fontSize: 15, fontWeight: '600' },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' },
  field: { flexGrow: 1, flexBasis: 100, minWidth: 0, gap: 4 },
  fieldLabel: { fontSize: 13 },
  unitToggle: { flexDirection: 'row', gap: 6, paddingBottom: 6 },
  setFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  converted: { fontSize: 14, fontVariant: ['tabular-nums'] },
  addSet: { marginTop: 12 },
  barRow: { marginTop: 12, gap: 4 },
  barInput: { maxWidth: 140 },
  error: { fontSize: 15, marginTop: 16 },
  actions: { marginTop: 24, gap: 10 },
  confirmText: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
});
