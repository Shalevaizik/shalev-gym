import Ionicons from '@expo/vector-icons/Ionicons';
import { randomUUID } from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { getExercise, recentExerciseNames, saveSession, updateSession } from '@/data/exerciseRepo';
import { getRoutine, listRoutines, saveRoutine, touchRoutine, updateRoutine } from '@/data/routineRepo';
import {
  KIND_LABEL,
  defaultUnit,
  isSessionName,
  newSession,
  STRUCTURES,
  structureDefaults,
  UNIT_LABEL,
  type AmountUnit,
  type Routine,
  type SessionDetails,
  type SessionKind,
  type Structure,
} from '@/domain/session';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { haptic } from '@/ui/haptics';
import { MovementPicker } from '@/ui/MovementPicker';
import { useTheme, type Theme } from '@/ui/theme';

type DraftMovement = { key: string; name: string; amount: string; unit: AmountUnit; weight: string };

const UNITS: AmountUnit[] = ['reps', 'calories', 'meters', 'seconds'];

const text = (n: number | null) => (n === null ? '' : String(n));
function number(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// A HIIT or CrossFit session (requirement 24): logged, not run. Its structure, its movements with
// their amounts, and how long it took. Opened by saying "HIIT", "CrossFit", "AMRAP" and so on, from
// a saved routine, or to change a session already logged.
export default function SessionScreen() {
  const params = useLocalSearchParams<{
    workoutId: string;
    kind?: SessionKind;
    structure?: Structure;
    routineId?: string;
    exerciseId?: string;
  }>();
  const db = useSQLiteContext();
  const { user } = useAuth();
  const theme = useTheme();
  const userId = user?.id;

  const [loaded, setLoaded] = useState(false);
  const [kind, setKind] = useState<SessionKind>(params.kind ?? 'hiit');
  const [structure, setStructure] = useState<Structure>(params.structure ?? newSession(params.kind ?? 'hiit').structure);
  const [work, setWork] = useState('');
  const [rest, setRest] = useState('');
  const [rounds, setRounds] = useState('');
  const [clock, setClock] = useState('');
  const [movements, setMovements] = useState<DraftMovement[]>([]);
  const [minutes, setMinutes] = useState('');
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [saveAs, setSaveAs] = useState(false);
  const [routineName, setRoutineName] = useState('');
  const [updateSaved, setUpdateSaved] = useState(false);
  const [adding, setAdding] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = !!params.exerciseId;

  // The structure already sets the time, except For Time (how long the rounds took): rounds × (work
  // + rest) for Intervals and Tabata, and the clock for EMOM and AMRAP. Null when it must be typed.
  const setTime = ((): number | null => {
    if (structure === 'intervals' || structure === 'tabata') {
      const w = number(work) ?? 0;
      const r = number(rest) ?? 0;
      const n = number(rounds);
      return n && w + r > 0 ? (n * (w + r)) / 60 : null;
    }
    if (structure === 'emom' || structure === 'amrap') return number(clock);
    return null;
  })();
  const fixedTime = structure !== 'for-time';
  const timeText = (m: number) => {
    const total = Math.round(m * 60);
    const s = total % 60;
    return s === 0 ? `${total / 60} min` : `${Math.floor(total / 60)} min ${s} s`;
  };

  function apply(details: SessionDetails) {
    setKind(details.kind);
    setStructure(details.structure);
    setWork(text(details.workS));
    setRest(text(details.restS));
    setRounds(text(details.rounds));
    setClock(text(details.minutes));
    setMovements(
      details.movements.map((m) => ({
        key: randomUUID(),
        name: m.name,
        amount: text(m.amount),
        unit: m.unit,
        weight: text(m.weightKg),
      })),
    );
  }

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const [names, saved] = await Promise.all([recentExerciseNames(db, userId, 30), listRoutines(db, userId)]);
        if (cancelled) return;
        setHistory(names);
        setRoutines(saved);
        if (params.exerciseId) {
          const exercise = await getExercise(db, userId, params.exerciseId);
          if (cancelled) return;
          if (exercise?.session) {
            apply(exercise.session);
            const seconds = exercise.sets[0]?.durationS ?? null;
            setMinutes(seconds ? String(Math.round((seconds / 60) * 10) / 10) : '');
            if (exercise.routineId) setRoutine(saved.find((r) => r.id === exercise.routineId) ?? null);
          }
        } else if (params.routineId) {
          const found = await getRoutine(db, userId, params.routineId);
          if (cancelled) return;
          if (found) {
            setRoutine(found);
            apply(found.details);
          }
        } else {
          apply(newSession(params.kind ?? 'hiit', params.structure));
        }
      } catch {
        if (!cancelled) setError('This session could not be loaded.');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userId, params.exerciseId, params.routineId, params.kind, params.structure]);

  function pickStructure(value: Structure) {
    haptic.select();
    setStructure(value);
    const defaults = structureDefaults(value);
    setWork(text(defaults.workS));
    setRest(text(defaults.restS));
    setRounds(text(defaults.rounds));
    setClock(text(defaults.minutes));
  }

  function pickRoutine(picked: Routine) {
    haptic.select();
    setRoutine(picked);
    apply(picked.details);
    setSaveAs(false);
    setUpdateSaved(false);
  }

  function addMovement(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    haptic.select();
    setMovements((current) => [
      ...current,
      { key: randomUUID(), name: trimmed, amount: '', unit: defaultUnit(trimmed), weight: '' },
    ]);
  }

  function change(key: string, update: Partial<DraftMovement>) {
    setMovements((current) => current.map((m) => (m.key === key ? { ...m, ...update } : m)));
  }

  // Recently used movements, for the picker's Recent group.
  const recent = useMemo(() => history.filter((name) => !isSessionName(name)), [history]);

  async function save() {
    if (!userId) return;
    setError(null);
    const named = movements.filter((m) => m.name.trim());
    if (named.length === 0) return setError('Add at least one movement with the + button.');
    const time = fixedTime ? setTime : number(minutes);
    if (!time) {
      return setError(
        fixedTime
          ? 'Fill in the structure (work, rest and rounds, or the clock) so the session time can be worked out.'
          : 'Enter how long the session took, in minutes.',
      );
    }
    if (saveAs && !routineName.trim()) return setError('Give the routine a name, or untick Save as routine.');

    const details: SessionDetails = {
      kind,
      structure,
      workS: structure === 'intervals' || structure === 'tabata' ? number(work) : null,
      restS: structure === 'intervals' || structure === 'tabata' ? number(rest) : null,
      rounds: structure === 'emom' || structure === 'amrap' ? null : number(rounds),
      minutes: structure === 'emom' || structure === 'amrap' ? number(clock) : null,
      movements: named.map((m) => ({
        name: m.name.trim(),
        amount: number(m.amount),
        unit: m.unit,
        weightKg: number(m.weight),
      })),
    };

    setSaving(true);
    try {
      const now = new Date();
      let used = routine;
      if (saveAs) used = await saveRoutine(db, userId, routineName, details, now, randomUUID);
      else if (routine && updateSaved) await updateRoutine(db, userId, routine.id, details, now);
      else if (routine) await touchRoutine(db, userId, routine.id, now);

      const entry = { name: used?.name ?? KIND_LABEL[kind], details, durationS: Math.round(time * 60), routineId: used?.id ?? null };
      if (params.exerciseId) await updateSession(db, userId, params.exerciseId, entry);
      else await saveSession(db, userId, params.workoutId, entry, now, randomUUID);
      haptic.success();
      router.back();
    } catch {
      setError('The session could not be saved. Please try again.');
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }];
  const field = (label: string, value: string, onChange: (v: string) => void, unit: string) => (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel={label}
          inputMode="decimal"
          keyboardType="decimal-pad"
          maxLength={5}
          onChangeText={onChange}
          style={[inputStyle, styles.flex]}
          value={value}
        />
        <Text style={[styles.unit, { color: theme.textMuted }]}>{unit}</Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'web' ? undefined : 'padding'} style={styles.flex}>
      <Stack.Screen options={{ title: editing ? 'Edit session' : routine ? routine.name : `${KIND_LABEL[kind]} session` }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <View style={styles.chips}>
            {(Object.keys(KIND_LABEL) as SessionKind[]).map((value) => (
              <Chip key={value} label={KIND_LABEL[value]} onPress={() => setKind(value)} selected={kind === value} />
            ))}
          </View>

          {!editing && routines.length > 0 && (
            <Section theme={theme} title="YOUR ROUTINES">
              <View style={styles.chips}>
                {routines.slice(0, 8).map((r) => (
                  <Chip
                    key={r.id}
                    icon="bookmark-outline"
                    label={r.name}
                    onPress={() => pickRoutine(r)}
                    selected={routine?.id === r.id}
                  />
                ))}
              </View>
            </Section>
          )}

          <Section theme={theme} title="STRUCTURE">
            <View style={styles.chips}>
              {STRUCTURES.map((s) => (
                <Chip key={s.value} label={s.label} onPress={() => pickStructure(s.value)} selected={structure === s.value} />
              ))}
            </View>
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              {STRUCTURES.find((s) => s.value === structure)?.detail}
            </Text>
            <View style={styles.fields}>
              {(structure === 'intervals' || structure === 'tabata') && (
                <>
                  {field('Work', work, setWork, 's')}
                  {field('Rest', rest, setRest, 's')}
                  {field('Rounds', rounds, setRounds, '')}
                </>
              )}
              {(structure === 'emom' || structure === 'amrap') && field('Clock', clock, setClock, 'min')}
              {structure === 'for-time' && field('Rounds', rounds, setRounds, '')}
            </View>
          </Section>

          <Section theme={theme} title="MOVEMENTS">
            {movements.length === 0 && !adding && (
              <Text style={[styles.hint, { color: theme.textMuted }]}>Add each movement with the + button.</Text>
            )}
            {movements.map((m, index) => (
              <View key={m.key} style={[styles.movement, { borderColor: theme.border }]}>
                <View style={styles.movementHead}>
                  <Text style={[styles.index, { color: theme.textMuted }]}>{index + 1}</Text>
                  <TextInput
                    accessibilityLabel={`Movement ${index + 1} name`}
                    onChangeText={(name) => change(m.key, { name })}
                    style={[inputStyle, styles.flex, styles.nameInput]}
                    value={m.name}
                  />
                  <Pressable
                    accessibilityLabel={`Remove ${m.name}`}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => setMovements((current) => current.filter((x) => x.key !== m.key))}
                    style={styles.remove}>
                    <Ionicons color={theme.danger} name="close-circle" size={24} />
                  </Pressable>
                </View>
                <View style={styles.inputRow}>
                  <TextInput
                    accessibilityLabel={`${m.name} amount`}
                    inputMode="decimal"
                    keyboardType="decimal-pad"
                    maxLength={5}
                    onChangeText={(amount) => change(m.key, { amount })}
                    placeholder="Amount"
                    placeholderTextColor={theme.textMuted}
                    style={[inputStyle, styles.amount]}
                    value={m.amount}
                  />
                  <View style={[styles.chips, styles.flex]}>
                    {UNITS.map((unit) => (
                      <Chip key={unit} label={UNIT_LABEL[unit]} onPress={() => change(m.key, { unit })} selected={m.unit === unit} />
                    ))}
                  </View>
                </View>
                <View style={styles.inputRow}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Weight</Text>
                  <TextInput
                    accessibilityLabel={`${m.name} weight in kg`}
                    inputMode="decimal"
                    keyboardType="decimal-pad"
                    maxLength={5}
                    onChangeText={(weight) => change(m.key, { weight })}
                    placeholder="—"
                    placeholderTextColor={theme.textMuted}
                    style={[inputStyle, styles.amount]}
                    value={m.weight}
                  />
                  <Text style={[styles.unit, { color: theme.textMuted }]}>kg</Text>
                </View>
              </View>
            ))}

            {adding ? (
              <MovementPicker
                added={movements.map((m) => m.name)}
                onAdd={addMovement}
                onDone={() => setAdding(false)}
                recent={recent}
              />
            ) : (
              <Button icon="add" label="Add movement" onPress={() => setAdding(true)} variant="secondary" />
            )}
          </Section>

          <Section theme={theme} title="SESSION TIME">
            {fixedTime ? (
              <Text accessibilityLiveRegion="polite" style={[styles.body, { color: theme.text }]}>
                {setTime ? (
                  <>
                    <Text style={styles.bold}>{timeText(setTime)}</Text>
                    {structure === 'intervals' || structure === 'tabata'
                      ? `, from ${number(rounds)} rounds × (${number(work) ?? 0} s work + ${number(rest) ?? 0} s rest)`
                      : ', the clock you set above'}
                  </>
                ) : (
                  'Worked out from the structure above once it’s filled in.'
                )}
              </Text>
            ) : (
              field('How long it took', minutes, setMinutes, 'min')
            )}
          </Section>

          <Section theme={theme} title="ROUTINE">
            {routine && !saveAs ? (
              <>
                <Text style={[styles.body, { color: theme.text }]}>
                  From your routine <Text style={styles.bold}>{routine.name}</Text>. Changes are saved with this workout.
                </Text>
                <Chip
                  icon={updateSaved ? 'checkbox' : 'square-outline'}
                  label="Also update the routine"
                  onPress={() => setUpdateSaved((v) => !v)}
                  selected={updateSaved}
                />
              </>
            ) : null}
            <Chip
              icon={saveAs ? 'checkbox' : 'square-outline'}
              label={routine ? 'Save as a new routine' : 'Save as routine'}
              onPress={() => setSaveAs((v) => !v)}
              selected={saveAs}
            />
            {saveAs && (
              <TextInput
                accessibilityLabel="Routine name"
                onChangeText={setRoutineName}
                placeholder="Name, e.g. Friday WOD"
                placeholderTextColor={theme.textMuted}
                style={inputStyle}
                value={routineName}
              />
            )}
          </Section>

          {error && (
            <Text accessibilityLiveRegion="polite" style={[styles.error, { color: theme.danger }]}>
              {error}
            </Text>
          )}

          <Button busy={saving} icon="checkmark" label={editing ? 'Save changes' : 'Save session'} onPress={save} />
          <Button disabled={saving} label="Cancel" onPress={() => router.back()} variant="secondary" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, theme, children }: { title: string; theme: Theme; children: ReactNode }) {
  return (
    <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.textMuted }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 14 },
  section: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.9 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontSize: 14 },
  body: { fontSize: 15, lineHeight: 21 },
  bold: { fontWeight: '700' },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  field: { flexGrow: 1, flexBasis: 90, gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 16 },
  nameInput: { fontWeight: '600' },
  amount: { width: 84 },
  unit: { fontSize: 15, minWidth: 24 },
  movement: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 8 },
  movementHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  index: { width: 18, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  remove: { padding: 2 },
  error: { fontSize: 15 },
});
