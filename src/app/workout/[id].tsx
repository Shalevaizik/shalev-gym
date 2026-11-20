import Ionicons from '@expo/vector-icons/Ionicons';
import { randomUUID } from 'expo-crypto';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  deleteLastSet,
  finishExercises,
  getCorrections,
  listExercises,
  logSets,
  recentExerciseNames,
  recentWeightsKg,
  recordCorrection,
  resumeExercise,
  startExercise,
  type NewExercise,
} from '@/data/exerciseRepo';
import { EQUIPMENT_HINT, EQUIPMENT_LABEL, formatSetFor, shortSetFor } from '@/domain/equipment';
import { suggestNext } from '@/domain/suggestions';
import type { TrainingWorkout } from '@/domain/training';
import { checkWeight, typicalKg, type WeightDoubt } from '@/domain/weightCheck';
import { loadTraining } from '@/data/analysisRepo';
import { deleteWorkout, endWorkout, getWorkout, renameWorkout } from '@/data/workoutRepo';
import { correctionKey, muscleOf, searchExercises, type MatchContext } from '@/domain/exerciseCatalog';
import { bestTranscript, parseExerciseChoice, type ChosenPart } from '@/domain/exerciseChoice';
import {
  kindOf,
  toKg,
  type LoggedExercise,
  type LoggedSet,
  type ParsedSet,
  type Technique,
} from '@/domain/exerciseLog';
import { parseSetLog } from '@/domain/setLog';
import {
  durationMs,
  formatClock,
  formatDuration,
  formatLongDate,
  formatTime,
  type Workout,
} from '@/domain/workout';
import { workoutTitle } from '@/domain/workoutTitle';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { ExerciseCard } from '@/ui/ExerciseCard';
import { ExerciseConfirm } from '@/ui/ExerciseConfirm';
import { haptic } from '@/ui/haptics';
import { MicButton } from '@/ui/MicButton';
import { useTheme, type Theme } from '@/ui/theme';
import { useSpeechToText } from '@/voice/useSpeechToText';

function goHome() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

type Notice = { tone: 'success' | 'info' | 'error'; text: string };
type Pending = { parts: ChosenPart[]; superset: boolean; spokenText: string; at: Date };
// Sets held back because a weight looked misheard (requirement 15e), until the trainer confirms.
type Doubt = { exercise: LoggedExercise; sets: ParsedSet[]; technique: Technique | null; at: Date; doubt: WeightDoubt };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The set logged last among the exercises in progress, for "undo".
function lastLogged(active: LoggedExercise[]): { exercise: LoggedExercise; set: LoggedSet } | null {
  let best: { exercise: LoggedExercise; set: LoggedSet } | null = null;
  for (const exercise of active) {
    const set = exercise.sets.at(-1);
    if (set && (!best || (set.endedAt ?? '') >= (best.set.endedAt ?? ''))) best = { exercise, set };
  }
  return best;
}

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { user } = useAuth();
  const theme = useTheme();
  const [workout, setWorkout] = useState<Workout | null | undefined>(undefined);
  const [exercises, setExercises] = useState<LoggedExercise[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [targetIndex, setTargetIndex] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [typed, setTyped] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Map<string, string>>(new Map());
  const [past, setPast] = useState<TrainingWorkout[]>([]);
  const [usual, setUsual] = useState<{ exerciseId: string; kg: number | null } | null>(null);
  const [doubt, setDoubt] = useState<Doubt | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const userId = user?.id;
  const inProgress = workout?.endedAt === null;

  const active = useMemo(
    () => (inProgress ? exercises.filter((e) => e.finishedAt === null) : []),
    [exercises, inProgress],
  );
  const done = exercises.filter((e) => !active.includes(e));
  const target: LoggedExercise | null = active[Math.min(targetIndex, active.length - 1)] ?? null;
  const mode: 'choose' | 'confirm' | 'sets' = pending ? 'confirm' : target ? 'sets' : 'choose';

  // What this workout is about so far and what the trainer corrected before, for telling
  // close-sounding exercises apart (requirement 15c and d).
  const context = useMemo<MatchContext>(
    () => ({
      focus: exercises.map((e) => e.muscle ?? muscleOf(e.name)).filter((m): m is NonNullable<typeof m> => m !== null),
      corrections,
    }),
    [exercises, corrections],
  );

  // How heavy the trainer usually goes on the exercise in progress, to catch misheard weights.
  const targetId = target?.id ?? null;
  const targetName = target?.name ?? null;
  const targetEquipment = target?.equipment ?? null;
  useEffect(() => {
    if (!userId || !targetId || !targetName) return;
    let cancelled = false;
    recentWeightsKg(db, userId, targetName, targetId, targetEquipment)
      .then((kg) => !cancelled && setUsual({ exerciseId: targetId, kg: typicalKg(kg) }))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [db, userId, targetId, targetName, targetEquipment]);
  const usualKg = usual?.exerciseId === targetId ? usual.kg : null;

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [loaded, names] = await Promise.all([
      listExercises(db, userId, id),
      recentExerciseNames(db, userId),
    ]);
    setExercises(loaded);
    setHistory(names);
  }, [db, userId, id]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      Promise.all([
        getWorkout(db, userId, id),
        listExercises(db, userId, id),
        recentExerciseNames(db, userId),
        getCorrections(db, userId),
        loadTraining(db, userId),
      ])
        .then(([loadedWorkout, loaded, names, fixes, training]) => {
          if (cancelled) return;
          setWorkout(loadedWorkout);
          setExercises(loaded);
          setHistory(names);
          setCorrections(fixes);
          setPast(training.filter((w) => w.id !== id && w.endedAt !== null));
        })
        .catch(() => {
          if (!cancelled) setError('This workout could not be loaded.');
        });
      return () => {
        cancelled = true;
      };
    }, [db, userId, id]),
  );

  useEffect(() => {
    if (!inProgress) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [inProgress]);

  const say = useCallback((next: Notice | null) => {
    setNotice(next);
    if (next?.tone === 'success') haptic.success();
    if (next?.tone === 'error') haptic.error();
  }, []);

  // --- Choosing the exercise -------------------------------------------------------------

  const readChoice = useCallback(
    (heardText: string, at: Date, fromVoice: boolean, versions: string[] = [heardText]) => {
      // Of the versions the phone heard, use the one that best names an exercise.
      const text = versions.length > 1 ? bestTranscript(versions, history, context) : heardText;
      const result = parseExerciseChoice(text, history, context);
      if (result.kind === 'end-workout') {
        setNotice(null);
        setConfirmingEnd(true);
        return;
      }
      if (result.kind === 'not-understood') {
        say({ tone: 'error', text: result.reason });
        if (fromVoice) setTyped(text);
        return;
      }
      haptic.select();
      setNotice(null);
      setTyped('');
      setPending({ parts: result.parts, superset: result.superset, spokenText: text, at });
    },
    [history, context, say],
  );

  // When the trainer picks something other than what the app was sure of, or settles a doubt,
  // remember it so the same words are understood next time (requirement 15d).
  async function rememberChoices(chosen: NewExercise[], from: Pending) {
    if (!userId) return;
    const learned = new Map(corrections);
    for (const [index, part] of from.parts.entries()) {
      const name = chosen[index]?.name;
      if (!name) continue;
      const sure = part.match.confident && part.match.best?.name === name;
      const heard = correctionKey(part.match.heard || part.spokenName);
      if (sure || !heard || heard === name.toLowerCase()) continue;
      await recordCorrection(db, userId, heard, name, new Date());
      learned.set(heard, name);
    }
    setCorrections(learned);
  }

  async function begin(chosen: NewExercise[], from: Pending | null) {
    if (!userId) return;
    setSaving(true);
    try {
      const at = new Date();
      const ids = await startExercise(db, userId, id, chosen, from?.spokenText ?? null, at, randomUUID);
      if (from) await rememberChoices(chosen, from).catch(() => undefined);
      // A first set said with the name ("bench press 80 kg 10") is logged right away.
      let logged = 0;
      for (const [index, part] of (from?.parts ?? []).entries()) {
        if (part.sets.length === 0 || !ids[index]) continue;
        await logSets(db, userId, ids[index], part.sets, part.technique, from!.at, randomUUID);
        logged += part.sets.length;
      }
      await refresh();
      setPending(null);
      setTyped('');
      setTargetIndex(logged > 0 && ids.length > 1 ? 1 : 0);
      const names = chosen.map((e) => e.name).join(' + ');
      say({
        tone: 'success',
        text: logged > 0 ? `${names} started with ${plural(logged, 'set')}.` : `${names} started. Do a set, then tap Record.`,
      });
    } catch {
      say({ tone: 'error', text: 'The exercise could not be started. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  // --- Logging sets ----------------------------------------------------------------------

  async function addSets(exercise: LoggedExercise, sets: ParsedSet[], technique: Technique | null, at: Date) {
    if (!userId) return;
    setSaving(true);
    // Cleared now, not after saving, so the next set can be typed straight away without being wiped.
    const submitted = typed;
    setTyped('');
    try {
      await logSets(db, userId, exercise.id, sets, technique, at, randomUUID);
      await refresh();
      const number = exercise.sets.length + sets.length;
      const what = sets.length === 1 ? formatSetFor(sets[0], kindOf(exercise)) : `${plural(sets.length, 'set')}`;
      const label = sets.length === 1 ? `Set ${number}` : 'Logged';
      say({ tone: 'success', text: `${label}: ${what}${active.length > 1 ? ` · ${exercise.name}` : ''}` });
      if (active.length > 1) setTargetIndex((active.indexOf(exercise) + 1) % active.length);
    } catch {
      say({ tone: 'error', text: 'The set could not be saved. Please try again.' });
      setTyped((current) => current || submitted);
    } finally {
      setSaving(false);
    }
  }

  async function undo() {
    if (!userId) return;
    const last = lastLogged(active);
    if (!last) {
      say({ tone: 'info', text: 'There is no set to undo yet.' });
      return;
    }
    setSaving(true);
    try {
      await deleteLastSet(db, userId, last.exercise.id);
      await refresh();
      setTargetIndex(Math.max(0, active.indexOf(last.exercise)));
      haptic.warning();
      setNotice({ tone: 'info', text: `Removed set ${last.exercise.sets.length} of ${last.exercise.name}.` });
    } catch {
      say({ tone: 'error', text: 'The set could not be removed. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  async function nextExercise() {
    if (!userId) return;
    setSaving(true);
    try {
      const summary = active.map((e) => `${e.name}: ${plural(e.sets.length, 'set')}`).join(', ');
      await finishExercises(db, userId, id, new Date());
      await refresh();
      setTargetIndex(0);
      setTyped('');
      say({ tone: 'success', text: `${summary}. What’s next?` });
    } catch {
      say({ tone: 'error', text: 'The exercise could not be finished. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  async function resume(exercise: LoggedExercise) {
    if (!userId) return;
    setSaving(true);
    try {
      await resumeExercise(db, userId, exercise.id, new Date());
      await refresh();
      setPending(null);
      setTargetIndex(0);
      say({ tone: 'success', text: `Back to ${exercise.name}. Tap Record after your set.` });
    } catch {
      say({ tone: 'error', text: 'The exercise could not be opened. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  const readSet = (heardText: string, at: Date, fromVoice: boolean, versions: string[] = [heardText]) => {
    if (!target) return;
    const previous = target.sets.at(-1) ?? null;
    // The first version the phone heard that makes sense as a set (requirement 15b).
    let text = heardText;
    let command = parseSetLog(text, previous, target.measure);
    for (const version of versions.slice(1)) {
      if (command.kind !== 'not-understood') break;
      const other = parseSetLog(version, previous, target.measure);
      if (other.kind !== 'not-understood') {
        text = version;
        command = other;
      }
    }
    switch (command.kind) {
      case 'sets': {
        // A weight far from this exercise's usual one was probably misheard: ask first.
        const reference =
          previous?.weight != null && previous.unit ? toKg(previous.weight, previous.unit) : usualKg;
        const found = command.sets.map((set) => checkWeight(set, reference)).find((d) => d !== null);
        if (found) {
          haptic.warning();
          setNotice(null);
          setDoubt({ exercise: target, sets: command.sets, technique: command.technique, at, doubt: found });
          return;
        }
        return addSets(target, command.sets, command.technique, at);
      }
      case 'repeat':
        return previous && addSets(target, [previous], null, at);
      case 'undo':
        return undo();
      case 'next-exercise':
        return nextExercise();
      case 'end-workout':
        setNotice(null);
        setConfirmingEnd(true);
        return;
      case 'not-understood': {
        // Saying another exercise's name moves on to it, after the usual confirmation.
        if (!/\d/.test(text)) {
          const choice = parseExerciseChoice(text, history, context);
          if (choice.kind === 'choice' && choice.parts.some((p) => p.match.confident)) {
            haptic.select();
            setTyped('');
            setPending({ parts: choice.parts, superset: choice.superset, spokenText: text, at });
            setNotice({ tone: 'info', text: `That sounds like a new exercise. Confirm it to finish ${target.name}.` });
            return;
          }
        }
        say({ tone: 'error', text: command.reason });
        if (fromVoice) setTyped(text);
      }
    }
  };

  // --- Voice and typing ------------------------------------------------------------------

  const route = (text: string, at: Date, fromVoice: boolean, versions?: string[]) => {
    if (mode === 'sets') readSet(text, at, fromVoice, versions);
    else readChoice(text, at, fromVoice, versions);
  };

  const speech = useSpeechToText((text, tappedAt, versions) => route(text, tappedAt, true, versions), history);

  useFocusEffect(
    useCallback(() => {
      return () => speech.cancel();
    }, [speech.cancel]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  function toggleMic() {
    if (speech.listening) {
      speech.stop();
      return;
    }
    setNotice(null);
    haptic.press();
    speech.start();
  }

  function submitTyped() {
    const text = typed.trim();
    if (!text || saving) return;
    route(text, new Date(), false);
  }

  async function end() {
    if (!userId) return;
    setError(null);
    setEnding(true);
    try {
      if (speech.listening) speech.cancel();
      await endWorkout(db, userId, id, new Date());
      haptic.success();
      goHome();
    } catch {
      setError('The workout could not be ended. Please try again.');
      setEnding(false);
    }
  }

  async function saveTitle() {
    if (!userId) return;
    setError(null);
    try {
      await renameWorkout(db, userId, id, titleDraft);
      setWorkout((current) => current && { ...current, title: titleDraft.trim() || null });
      setRenaming(false);
    } catch {
      setError('The title could not be saved. Please try again.');
    }
  }

  async function remove() {
    if (!userId) return;
    setError(null);
    setDeleting(true);
    try {
      if (speech.listening) speech.cancel();
      await deleteWorkout(db, userId, id);
      haptic.warning();
      goHome();
    } catch {
      setError('The workout could not be deleted. Please try again.');
      setDeleting(false);
    }
  }

  // --- Screens ---------------------------------------------------------------------------

  if (error && workout === undefined) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.message, { color: theme.danger }]}>{error}</Text>
      </View>
    );
  }

  if (workout === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (workout === null) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.message, { color: theme.text }]}>This workout could not be found.</Text>
        <View style={styles.notFoundAction}>
          <Button label="Back to workouts" onPress={goHome} variant="secondary" />
        </View>
      </View>
    );
  }

  const shownNotice: Notice | null = notice ?? (speech.error ? { tone: 'error', text: speech.error } : null);
  const lastSetEnd = exercises
    .flatMap((e) => e.sets.map((s) => s.endedAt))
    .filter((t): t is string => t !== null)
    .sort()
    .at(-1);
  const suggestions = mode === 'choose' && typed.trim().length >= 2 ? searchExercises(typed, history) : [];
  // Requirement 16: what usually comes next on a day like this one.
  const next =
    mode === 'choose' && exercises.length > 0
      ? suggestNext(
          exercises.map((e) => ({ name: e.name, muscle: e.muscle })),
          past,
        )
      : null;
  const previous = target?.sets.at(-1) ?? null;
  const autoTitle = workoutTitle(exercises.map((e) => ({ name: e.name, muscle: e.muscle, sets: e.sets.length })));
  const shownTitle = workout.title ?? autoTitle;

  const noticeView = shownNotice && (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.notice,
        {
          backgroundColor: shownNotice.tone === 'error' ? 'transparent' : theme.accentSoft,
          borderColor: shownNotice.tone === 'error' ? theme.danger : theme.accentSoft,
        },
      ]}>
      <Ionicons
        color={shownNotice.tone === 'error' ? theme.danger : theme.accent}
        name={shownNotice.tone === 'error' ? 'alert-circle' : shownNotice.tone === 'success' ? 'checkmark-circle' : 'information-circle'}
        size={20}
      />
      <Text style={[styles.noticeText, { color: shownNotice.tone === 'error' ? theme.danger : theme.text }]}>
        {shownNotice.text}
      </Text>
    </View>
  );

  const typeRow = (placeholder: string, label: string) => (
    <View style={styles.typeRow}>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!speech.listening}
        id="exercise-text"
        onChangeText={setTyped}
        onSubmitEditing={submitTyped}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        returnKeyType={mode === 'sets' ? 'send' : 'search'}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
        submitBehavior="submit"
        value={typed}
      />
      <View style={styles.logButton}>
        <Button
          disabled={!typed.trim() || saving || speech.listening}
          label={mode === 'sets' ? 'Log' : 'Go'}
          onPress={submitTyped}
          variant="secondary"
        />
      </View>
    </View>
  );

  const transcript = speech.listening && (
    <Text accessibilityLiveRegion="polite" style={[styles.heard, { color: speech.partial ? theme.text : theme.textMuted }]}>
      {speech.partial || 'Listening…'}
    </Text>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.content}
        // In a browser, scrolling a field into view counts as a drag and would take its focus away.
        keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
        keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          {!inProgress &&
            (renaming ? (
              <View style={styles.renameBox}>
                <TextInput
                  accessibilityLabel="Workout title"
                  autoFocus
                  maxLength={60}
                  onChangeText={setTitleDraft}
                  onSubmitEditing={saveTitle}
                  placeholder={autoTitle}
                  placeholderTextColor={theme.textMuted}
                  returnKeyType="done"
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
                  value={titleDraft}
                />
                <Text style={[styles.renameHint, { color: theme.textMuted }]}>
                  Leave it empty to use the app’s title, “{autoTitle}”.
                </Text>
                <View style={styles.renameActions}>
                  <View style={styles.flex}>
                    <Button label="Save title" onPress={saveTitle} />
                  </View>
                  <View style={styles.flex}>
                    <Button label="Cancel" onPress={() => setRenaming(false)} variant="secondary" />
                  </View>
                </View>
              </View>
            ) : (
              <Pressable
                accessibilityHint="Rename this workout"
                accessibilityLabel={`Title: ${shownTitle}`}
                accessibilityRole="button"
                onPress={() => {
                  setTitleDraft(workout.title ?? '');
                  setRenaming(true);
                }}
                style={({ pressed }) => [styles.titleRow, pressed && { opacity: 0.6 }]}>
                <Text accessibilityRole="header" style={[styles.workoutTitle, { color: theme.text }]}>
                  {shownTitle}
                </Text>
                <Ionicons color={theme.textMuted} name="pencil" size={18} />
              </Pressable>
            ))}
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={[styles.date, { color: theme.textMuted }]}>{formatLongDate(new Date(workout.startedAt))}</Text>
              <Text style={[styles.times, { color: theme.text }]}>
                {workout.endedAt
                  ? `${formatTime(workout.startedAt)} to ${formatTime(workout.endedAt)}`
                  : `Started at ${formatTime(workout.startedAt)}`}
              </Text>
            </View>
            {inProgress && (
              <Text
                accessibilityLabel={`Elapsed time ${formatDuration(durationMs(workout, now))}`}
                style={[styles.clock, { color: theme.text }]}>
                {formatClock(durationMs(workout, now))}
              </Text>
            )}
          </View>
          {!inProgress && (
            <Text style={[styles.summary, { color: theme.textMuted }]}>
              {workout.endReason === 'auto'
                ? 'Ended automatically after a long time without activity.'
                : `Lasted ${formatDuration(durationMs(workout, now))}.`}
            </Text>
          )}

          {inProgress && mode === 'confirm' && pending && (
            <View style={styles.stage}>
              <ExerciseConfirm
                key={pending.spokenText + pending.at.getTime()}
                busy={saving}
                onCancel={() => {
                  setPending(null);
                  setNotice(null);
                }}
                onConfirm={(chosen) => begin(chosen, pending)}
                onRetry={() => {
                  setPending(null);
                  setNotice(null);
                  haptic.press();
                  speech.start();
                }}
                parts={pending.parts}
                superset={pending.superset}
              />
              {noticeView}
            </View>
          )}

          {inProgress && mode === 'choose' && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.eyebrow, { color: theme.textMuted }]}>
                {exercises.length === 0 ? 'FIRST EXERCISE' : 'NEXT EXERCISE'}
              </Text>
              <Text style={[styles.prompt, { color: theme.text }]}>What are you training?</Text>
              <MicButton
                label={speech.listening ? 'Tap when done' : 'Say the exercise'}
                level={speech.level}
                listening={speech.listening}
                onPress={toggleMic}
              />
              {transcript || (
                <Text style={[styles.hint, { color: theme.textMuted }]}>
                  For example “bench press”, or “curls superset with pushdowns”.
                </Text>
              )}
              {typeRow('Or type the exercise name', 'Type the exercise name')}
              {suggestions.length > 0 && (
                <View style={[styles.suggestions, { borderColor: theme.border }]}>
                  {suggestions.map((option, index) => (
                    <Pressable
                      key={option.name}
                      accessibilityLabel={`Start ${option.name}`}
                      accessibilityRole="button"
                      android_ripple={{ color: theme.ripple }}
                      onPress={() => begin([{ name: option.name, muscle: option.muscle }], null)}
                      style={({ pressed }) => [
                        styles.suggestion,
                        index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                        pressed && styles.pressed,
                      ]}>
                      <View style={styles.flex}>
                        <Text style={[styles.suggestionName, { color: theme.text }]}>{option.name}</Text>
                        {option.muscle && (
                          <Text style={[styles.suggestionNote, { color: theme.textMuted }]}>{option.muscle}</Text>
                        )}
                      </View>
                      <Ionicons color={theme.accent} name="arrow-forward-circle" size={24} />
                    </Pressable>
                  ))}
                </View>
              )}
              {suggestions.length === 0 && next && next.options.length > 0 && !typed && (
                <View style={styles.recentBlock}>
                  <Text style={[styles.eyebrow, { color: theme.accent }]}>
                    SUGGESTED NEXT · {next.focus.toUpperCase()}
                  </Text>
                  <View style={styles.chips}>
                    {next.options.map((option) => (
                      <Chip
                        key={option.name}
                        accessibilityLabel={`Suggested: start ${option.name}`}
                        disabled={saving || speech.listening}
                        icon="sparkles-outline"
                        label={option.name}
                        onPress={() => begin([{ name: option.name, muscle: option.muscle }], null)}
                      />
                    ))}
                  </View>
                </View>
              )}
              {suggestions.length === 0 && history.length > 0 && !typed && (
                <View style={styles.recentBlock}>
                  <Text style={[styles.eyebrow, { color: theme.textMuted }]}>RECENT</Text>
                  <View style={styles.chips}>
                    {history.slice(0, 8).map((name) => (
                      <Chip
                        key={name}
                        accessibilityLabel={`Start ${name}`}
                        disabled={saving || speech.listening}
                        label={name}
                        onPress={() => begin([{ name, muscle: muscleOf(name) }], null)}
                      />
                    ))}
                  </View>
                </View>
              )}
              {noticeView}
            </View>
          )}

          {inProgress && mode === 'sets' && target && (
            <View style={[styles.card, styles.current, { backgroundColor: theme.surface, borderColor: theme.accent }]}>
              <View style={styles.currentHeader}>
                <Text style={[styles.eyebrow, { color: theme.accent }]}>
                  {active.length > 1 ? 'SUPERSET IN PROGRESS' : 'NOW TRAINING'}
                </Text>
                {lastSetEnd && (
                  <View
                    accessibilityLabel={`Resting for ${formatDuration(now.getTime() - new Date(lastSetEnd).getTime())}`}
                    style={[styles.rest, { backgroundColor: theme.accentSoft }]}>
                    <Ionicons color={theme.accent} name="timer-outline" size={15} />
                    <Text style={[styles.restText, { color: theme.text }]}>
                      Rest {formatClock(Math.max(0, now.getTime() - new Date(lastSetEnd).getTime()))}
                    </Text>
                  </View>
                )}
              </View>

              {active.map((exercise, index) => (
                <CurrentExercise
                  key={exercise.id}
                  exercise={exercise}
                  isTarget={exercise.id === target.id}
                  onEdit={() => {
                    setNotice(null);
                    router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } });
                  }}
                  onSelect={active.length > 1 ? () => {
                    haptic.select();
                    setTargetIndex(index);
                  } : undefined}
                  theme={theme}
                />
              ))}

              <MicButton
                busy={saving}
                label={speech.listening ? 'Tap when done' : active.length > 1 ? `Record set · ${target.name}` : 'Record set'}
                level={speech.level}
                listening={speech.listening}
                onPress={toggleMic}
              />
              {transcript || (
                <Text style={[styles.hint, { color: theme.textMuted }]}>
                  {target.sets.length > 0
                    ? target.measure === 'time'
                      ? 'Say “45 seconds”, “same again”, “undo” or “next exercise”.'
                      : 'Say “8 reps”, “same again”, “undo” or “next exercise”.'
                    : target.measure === 'time'
                      ? 'After your hold, tap and say the time, like “60 seconds” or “1:30”. Add weight with “plus 10 kg”.'
                      : target.equipment
                        ? `After your set, tap and say it. ${EQUIPMENT_HINT[target.equipment]}`
                        : 'After your set, tap and say it, like “80 kg 10 reps”.'}
                </Text>
              )}
              {doubt && doubt.exercise.id === target.id && (
                <View
                  accessibilityLiveRegion="polite"
                  style={[styles.doubt, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}>
                  <View style={styles.doubtTitleRow}>
                    <Ionicons color={theme.accent} name="help-circle" size={22} />
                    <Text style={[styles.doubtTitle, { color: theme.text }]}>
                      Did you say {doubt.doubt.heard} {doubt.doubt.unit}?
                    </Text>
                  </View>
                  <Text style={[styles.doubtText, { color: theme.textMuted }]}>
                    That’s far from your usual weight on {doubt.exercise.name}. Did you mean {doubt.doubt.suggestion}{' '}
                    {doubt.doubt.unit}?
                  </Text>
                  <Button
                    label={`No, ${doubt.doubt.suggestion} ${doubt.doubt.unit}`}
                    onPress={() => {
                      const { exercise, sets, technique, at, doubt: d } = doubt;
                      setDoubt(null);
                      addSets(
                        exercise,
                        sets.map((s) => (s.weight === d.heard && s.unit === d.unit ? { ...s, weight: d.suggestion } : s)),
                        technique,
                        at,
                      );
                    }}
                  />
                  <View style={styles.doubtActions}>
                    <View style={styles.flex}>
                      <Button
                        label={`Yes, ${doubt.doubt.heard} ${doubt.doubt.unit}`}
                        onPress={() => {
                          const { exercise, sets, technique, at } = doubt;
                          setDoubt(null);
                          addSets(exercise, sets, technique, at);
                        }}
                        variant="secondary"
                      />
                    </View>
                    <View style={styles.flex}>
                      <Button label="Cancel" onPress={() => setDoubt(null)} variant="secondary" />
                    </View>
                  </View>
                </View>
              )}
              {noticeView}

              <View style={styles.chips}>
                {previous && (
                  <Chip
                    accessibilityLabel={`Log the same set again: ${formatSetFor(previous, kindOf(target))}`}
                    disabled={saving || speech.listening}
                    icon="repeat"
                    label={`Same again · ${shortSetFor(previous, kindOf(target))}`}
                    onPress={() => addSets(target, [previous], null, new Date())}
                  />
                )}
                {lastLogged(active) && (
                  <Chip
                    disabled={saving || speech.listening}
                    icon="arrow-undo"
                    label="Undo last set"
                    onPress={undo}
                  />
                )}
              </View>

              {typeRow(target.measure === 'time' ? 'Or type the time, e.g. 60 s' : 'Or type the set, e.g. 80 kg 10', 'Type a set')}

              <Button
                disabled={saving || speech.listening}
                icon="play-skip-forward"
                label="Next exercise"
                onPress={nextExercise}
                variant="secondary"
              />
            </View>
          )}

          {done.length > 0 && (
            <View style={styles.list}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                {inProgress ? `DONE · ${plural(done.length, 'EXERCISE').toUpperCase()}` : plural(done.length, 'exercise').toUpperCase()}
              </Text>
              {done.map((exercise, index) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  inSuperset={
                    exercise.supersetGroup !== null &&
                    (done[index - 1]?.supersetGroup === exercise.supersetGroup ||
                      done[index + 1]?.supersetGroup === exercise.supersetGroup)
                  }
                  onEdit={() => {
                    setNotice(null);
                    router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } });
                  }}
                  onResume={inProgress && !saving ? () => resume(exercise) : undefined}
                />
              ))}
            </View>
          )}
          {!inProgress && exercises.length === 0 && (
            <View style={[styles.placeholder, { borderColor: theme.border }]}>
              <Text style={[styles.placeholderText, { color: theme.textMuted }]}>No exercises logged.</Text>
            </View>
          )}

          {error && (
            <Text accessibilityLiveRegion="polite" style={[styles.error, { color: theme.danger }]}>
              {error}
            </Text>
          )}

          {inProgress &&
            (confirmingEnd ? (
              <View style={[styles.actions, styles.endBox, { borderColor: theme.border }]}>
                <Text style={[styles.confirmText, { color: theme.text }]}>End this workout?</Text>
                <Text style={[styles.confirmNote, { color: theme.textMuted }]}>
                  {plural(exercises.filter((e) => e.sets.length > 0).length, 'exercise')},{' '}
                  {plural(exercises.reduce((n, e) => n + e.sets.length, 0), 'set')} in{' '}
                  {formatDuration(durationMs(workout, now))}.
                </Text>
                <Button busy={ending} icon="flag" label="Yes, end workout" onPress={end} variant="danger" />
                <Button disabled={ending} label="Keep going" onPress={() => setConfirmingEnd(false)} variant="secondary" />
              </View>
            ) : (
              <View style={styles.actions}>
                <Button
                  icon="flag-outline"
                  label="End workout"
                  onPress={() => {
                    haptic.select();
                    setConfirmingDelete(false);
                    setConfirmingEnd(true);
                  }}
                  variant="plain"
                />
              </View>
            ))}

          {confirmingDelete ? (
            <View style={[styles.actions, styles.endBox, { borderColor: theme.danger }]}>
              <Text style={[styles.confirmText, { color: theme.text }]}>Delete this workout?</Text>
              <Text style={[styles.confirmNote, { color: theme.textMuted }]}>
                Its {plural(exercises.length, 'exercise')} and{' '}
                {plural(exercises.reduce((n, e) => n + e.sets.length, 0), 'set')} will be removed. This
                can’t be undone.
              </Text>
              <Button busy={deleting} icon="trash" label="Delete workout" onPress={remove} variant="danger" />
              <Button
                disabled={deleting}
                label="Keep it"
                onPress={() => setConfirmingDelete(false)}
                variant="secondary"
              />
            </View>
          ) : (
            <Button
              disabled={ending || deleting}
              icon="trash-outline"
              label="Delete workout"
              onPress={() => {
                haptic.warning();
                setConfirmingEnd(false);
                setConfirmingDelete(true);
              }}
              variant="dangerPlain"
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CurrentExercise({
  exercise,
  isTarget,
  onEdit,
  onSelect,
  theme,
}: {
  exercise: LoggedExercise;
  isTarget: boolean;
  onEdit: () => void;
  onSelect?: () => void;
  theme: Theme;
}) {
  const dimmed = onSelect && !isTarget;
  return (
    <View style={[styles.exercise, dimmed && styles.dimmed]}>
      <View style={styles.exerciseHeader}>
        <Pressable
          accessibilityLabel={onSelect ? `Log the next set for ${exercise.name}` : undefined}
          accessibilityRole={onSelect ? 'button' : undefined}
          accessibilityState={onSelect ? { selected: isTarget } : undefined}
          disabled={!onSelect}
          onPress={onSelect}
          style={styles.flex}>
          <View style={styles.nameRow}>
            {onSelect && (
              <Ionicons
                color={isTarget ? theme.accent : theme.textMuted}
                name={isTarget ? 'radio-button-on' : 'radio-button-off'}
                size={20}
              />
            )}
            <Text style={[styles.exerciseName, { color: theme.text }]}>{exercise.name}</Text>
          </View>
          <Text style={[styles.exerciseMeta, { color: theme.textMuted }]}>
            {[
              exercise.muscle,
              exercise.equipment && EQUIPMENT_LABEL[exercise.equipment],
              exercise.equipment === 'barbell' && exercise.barKg !== null && `${exercise.barKg} kg bar`,
              plural(exercise.sets.length, 'set'),
              exercise.technique,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`Edit ${exercise.name}`}
          accessibilityRole="button"
          android_ripple={{ color: theme.ripple, borderless: true }}
          hitSlop={10}
          onPress={onEdit}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Ionicons color={theme.accent} name="create-outline" size={22} />
        </Pressable>
      </View>
      {exercise.sets.map((set, index) => (
        <View key={set.id} style={[styles.setRow, { borderTopColor: theme.border }]}>
          <View style={[styles.setBadge, { backgroundColor: theme.accentSoft }]}>
            <Text style={[styles.setBadgeText, { color: theme.accent }]}>{index + 1}</Text>
          </View>
          <Text style={[styles.setText, { color: theme.text }]}>{formatSetFor(set, kindOf(exercise))}</Text>
          {set.endedAt && <Text style={[styles.setTime, { color: theme.textMuted }]}>{formatTime(set.endedAt)}</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { fontSize: 17, textAlign: 'center' },
  notFoundAction: { marginTop: 18 },
  content: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, alignSelf: 'flex-start' },
  workoutTitle: { fontSize: 26, fontWeight: '800', flexShrink: 1 },
  renameBox: { gap: 8, marginBottom: 12 },
  renameHint: { fontSize: 14 },
  renameActions: { flexDirection: 'row', gap: 10 },
  doubt: { borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 10 },
  doubtTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doubtTitle: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  doubtText: { fontSize: 15, lineHeight: 21 },
  doubtActions: { flexDirection: 'row', gap: 10 },
  date: { fontSize: 15 },
  times: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  clock: { fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  summary: { fontSize: 17 },
  stage: { gap: 12 },
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 14 },
  current: { borderWidth: 2 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.9 },
  prompt: { fontSize: 24, fontWeight: '700', marginTop: -8 },
  hint: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  heard: { fontSize: 19, lineHeight: 26, minHeight: 26, textAlign: 'center', fontWeight: '600' },
  typeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { flex: 1, minWidth: 0, minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  logButton: { width: 76 },
  suggestions: { borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginTop: -4 },
  suggestion: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8 },
  suggestionName: { fontSize: 16, fontWeight: '600' },
  suggestionNote: { fontSize: 13, marginTop: 1 },
  recentBlock: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  noticeText: { flex: 1, fontSize: 15, lineHeight: 21 },
  currentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rest: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  restText: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  exercise: { gap: 2 },
  dimmed: { opacity: 0.6 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exerciseName: { fontSize: 24, fontWeight: '800', flexShrink: 1 },
  exerciseMeta: { fontSize: 14, marginTop: 2 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth },
  setBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  setBadgeText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  setText: { flex: 1, fontSize: 16, fontVariant: ['tabular-nums'] },
  setTime: { fontSize: 13, fontVariant: ['tabular-nums'] },
  list: { gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.9, marginTop: 4 },
  placeholder: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 24 },
  placeholderText: { fontSize: 16, textAlign: 'center' },
  error: { fontSize: 15 },
  actions: { gap: 10 },
  endBox: { borderWidth: 1, borderRadius: 16, padding: 16 },
  confirmText: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  confirmNote: { fontSize: 15, textAlign: 'center' },
  pressed: { opacity: 0.8 },
});
