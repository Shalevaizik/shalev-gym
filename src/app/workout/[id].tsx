import Ionicons from '@expo/vector-icons/Ionicons';
import { randomUUID } from 'expo-crypto';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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
  startExercise,
  type NewExercise,
} from '@/data/exerciseRepo';
import { equipmentHint, equipmentLabel, formatSetFor, shortSetFor } from '@/domain/equipment';
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
import { count, exerciseName, t, titleText } from '@/i18n/core';
import { muscleName } from '@/i18n/names';
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

// The set logged last among the given exercises: for "undo", and the "Last:" line (requirement 22c).
function lastLogged(exercises: LoggedExercise[]): { exercise: LoggedExercise; set: LoggedSet } | null {
  let best: { exercise: LoggedExercise; set: LoggedSet } | null = null;
  for (const exercise of exercises) {
    const set = exercise.sets.at(-1);
    if (set && (!best || (set.endedAt ?? '') >= (best.set.endedAt ?? ''))) best = { exercise, set };
  }
  return best;
}

// Whether the on-screen keyboard is open, so the workout screen can make room for typing.
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const shown = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return open;
}

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { user } = useAuth();
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const keyboardOpen = useKeyboardOpen();
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
          if (!cancelled) setError(t('This workout could not be loaded.'));
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
      const names = chosen.map((e) => exerciseName(e.name)).join(' + ');
      say({
        tone: 'success',
        text:
          logged > 0
            ? t('{names} started with {sets}.', { names, sets: count(logged, 'set') })
            : t('{names} started. Do a set, then tap Record.', { names }),
      });
    } catch {
      say({ tone: 'error', text: t('The exercise could not be started. Please try again.') });
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
      // The "Last:" line under the logging area confirms what was saved (requirement 22c).
      setNotice(null);
      haptic.success();
      if (active.length > 1) setTargetIndex((active.indexOf(exercise) + 1) % active.length);
    } catch {
      say({ tone: 'error', text: t('The set could not be saved. Please try again.') });
      setTyped((current) => current || submitted);
    } finally {
      setSaving(false);
    }
  }

  async function undo() {
    if (!userId) return;
    const last = lastLogged(active);
    if (!last) {
      say({ tone: 'info', text: t('There is no set to undo yet.') });
      return;
    }
    setSaving(true);
    try {
      await deleteLastSet(db, userId, last.exercise.id);
      await refresh();
      setTargetIndex(Math.max(0, active.indexOf(last.exercise)));
      haptic.warning();
      setNotice({
        tone: 'info',
        text: t('Removed set {n} of {name}.', { n: last.exercise.sets.length, name: exerciseName(last.exercise.name) }),
      });
    } catch {
      say({ tone: 'error', text: t('The set could not be removed. Please try again.') });
    } finally {
      setSaving(false);
    }
  }

  async function nextExercise() {
    if (!userId) return;
    setSaving(true);
    try {
      const summary = active.map((e) => `${exerciseName(e.name)}: ${count(e.sets.length, 'set')}`).join(', ');
      await finishExercises(db, userId, id, new Date());
      await refresh();
      setTargetIndex(0);
      setTyped('');
      say({ tone: 'success', text: t('{summary}. What’s next?', { summary }) });
    } catch {
      say({ tone: 'error', text: t('The exercise could not be finished. Please try again.') });
    } finally {
      setSaving(false);
    }
  }

  const readSet = (heardText: string, at: Date, fromVoice: boolean, versions: string[] = [heardText]) => {
    if (!target) return;
    const previous = target.sets.at(-1) ?? null;
    const cardio = target.equipment === 'cardio';
    // The first version the phone heard that makes sense as a set (requirement 15b).
    let text = heardText;
    let command = parseSetLog(text, previous, target.measure, cardio);
    for (const version of versions.slice(1)) {
      if (command.kind !== 'not-understood') break;
      const other = parseSetLog(version, previous, target.measure, cardio);
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
            setNotice({
              tone: 'info',
              text: t('That sounds like a new exercise. Confirm it to finish {name}.', { name: exerciseName(target.name) }),
            });
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
      setError(t('The workout could not be ended. Please try again.'));
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
      setError(t('The title could not be saved. Please try again.'));
    }
  }

  async function remove() {
    if (!userId) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteWorkout(db, userId, id);
      haptic.warning();
      goHome();
    } catch {
      setError(t('The workout could not be deleted. Please try again.'));
      setDeleting(false);
    }
  }

  function openLog() {
    setNotice(null);
    if (speech.listening) speech.cancel();
    router.push({ pathname: '/workout/session-log', params: { id } });
  }

  function openEditor(exercise: LoggedExercise) {
    setNotice(null);
    router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } });
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
        <Text style={[styles.message, { color: theme.text }]}>{t('This workout could not be found.')}</Text>
        <View style={styles.notFoundAction}>
          <Button label={t('Back to workouts')} onPress={goHome} variant="secondary" />
        </View>
      </View>
    );
  }

  const totalSets = exercises.reduce((n, e) => n + e.sets.length, 0);
  const autoTitle = workoutTitle(exercises.map((e) => ({ name: e.name, muscle: e.muscle, sets: e.sets.length })));

  // --- A finished workout: its title, times and every exercise, to look back on -----------------

  if (!inProgress) {
    const shownTitle = workout.title ?? titleText(autoTitle);
    return (
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          {renaming ? (
            <View style={styles.renameBox}>
              <TextInput
                accessibilityLabel={t('Workout title')}
                autoFocus
                maxLength={60}
                onChangeText={setTitleDraft}
                onSubmitEditing={saveTitle}
                placeholder={titleText(autoTitle)}
                placeholderTextColor={theme.textMuted}
                returnKeyType="done"
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
                value={titleDraft}
              />
              <Text style={[styles.renameHint, { color: theme.textMuted }]}>
                {t('Leave it empty to use the app’s title, “{title}”.', { title: titleText(autoTitle) })}
              </Text>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button label={t('Save title')} onPress={saveTitle} />
                </View>
                <View style={styles.flex}>
                  <Button label={t('Cancel')} onPress={() => setRenaming(false)} variant="secondary" />
                </View>
              </View>
            </View>
          ) : (
            <Pressable
              accessibilityHint={t('Rename this workout')}
              accessibilityLabel={t('Title: {title}', { title: shownTitle })}
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
          )}
          <View>
            <Text style={[styles.date, { color: theme.textMuted }]}>{formatLongDate(new Date(workout.startedAt))}</Text>
            <Text style={[styles.times, { color: theme.text }]}>
              {workout.endedAt &&
                t('{start} to {end}', { start: formatTime(workout.startedAt), end: formatTime(workout.endedAt) })}
            </Text>
          </View>
          <Text style={[styles.summary, { color: theme.textMuted }]}>
            {workout.endReason === 'auto'
              ? t('Ended automatically after a long time without activity.')
              : t('Lasted {time}.', { time: formatDuration(durationMs(workout, now)) })}
          </Text>

          {exercises.length > 0 ? (
            <View style={styles.list}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                {count(exercises.length, 'exercise').toUpperCase()}
              </Text>
              {exercises.map((exercise, index) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  inSuperset={
                    exercise.supersetGroup !== null &&
                    (exercises[index - 1]?.supersetGroup === exercise.supersetGroup ||
                      exercises[index + 1]?.supersetGroup === exercise.supersetGroup)
                  }
                  onEdit={() => openEditor(exercise)}
                />
              ))}
            </View>
          ) : (
            <View style={[styles.placeholder, { borderColor: theme.border }]}>
              <Text style={[styles.placeholderText, { color: theme.textMuted }]}>{t('No exercises logged.')}</Text>
            </View>
          )}

          {error && (
            <Text accessibilityLiveRegion="polite" style={[styles.error, { color: theme.danger }]}>
              {error}
            </Text>
          )}

          {confirmingDelete ? (
            <View style={[styles.actions, styles.endBox, { borderColor: theme.danger }]}>
              <Text style={[styles.confirmText, { color: theme.text }]}>{t('Delete this workout?')}</Text>
              <Text style={[styles.confirmNote, { color: theme.textMuted }]}>
                {t('Its {exercises} and {sets} will be removed. This can’t be undone.', {
                  exercises: count(exercises.length, 'exercise'),
                  sets: count(totalSets, 'set'),
                })}
              </Text>
              <Button busy={deleting} icon="trash" label={t('Delete workout')} onPress={remove} variant="danger" />
              <Button disabled={deleting} label={t('Keep it')} onPress={() => setConfirmingDelete(false)} variant="secondary" />
            </View>
          ) : (
            <Button
              disabled={deleting}
              icon="trash-outline"
              label={t('Delete workout')}
              onPress={() => {
                haptic.warning();
                setConfirmingDelete(true);
              }}
              variant="dangerPlain"
            />
          )}
        </View>
      </ScrollView>
    );
  }

  // --- A running workout (requirement 22): everything to log the next set on one screen ---------
  //
  // The timer and the Session log button stay at the top, the typing box and the main buttons at
  // the bottom, and the exercise and the record button fill the space between. Small phones get a
  // smaller record button and tighter spacing; tall phones get a bigger one. While the keyboard is
  // open, the record button steps aside so the typing box stays above the keyboard.

  const compact = height < 700;
  const tall = height >= 820;
  const gap = compact ? 10 : 14;
  const micSize = compact ? 80 : tall ? 116 : 96;
  const shownNotice: Notice | null = notice ?? (speech.error ? { tone: 'error', text: speech.error } : null);
  const lastSetEnd = exercises
    .flatMap((e) => e.sets.map((s) => s.endedAt))
    .filter((time): time is string => time !== null)
    .sort()
    .at(-1);
  const latest = lastLogged(exercises);
  const suggestions = mode === 'choose' && typed.trim().length >= 2 ? searchExercises(typed, history).slice(0, compact ? 3 : 4) : [];
  // Requirement 16: what usually comes next on a day like this one.
  const next =
    mode === 'choose' && exercises.length > 0
      ? suggestNext(
          exercises.map((e) => ({ name: e.name, muscle: e.muscle })),
          past,
        )
      : null;
  const previous = target?.sets.at(-1) ?? null;
  const showMic = !keyboardOpen;

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
      <Text numberOfLines={3} style={[styles.noticeText, { color: shownNotice.tone === 'error' ? theme.danger : theme.text }]}>
        {shownNotice.text}
      </Text>
    </View>
  );

  const transcript = speech.listening && (
    <Text
      accessibilityLiveRegion="polite"
      numberOfLines={2}
      style={[styles.heard, { color: speech.partial ? theme.text : theme.textMuted }]}>
      {speech.partial || t('Listening…')}
    </Text>
  );

  const hint = (text: string) =>
    !compact || !keyboardOpen ? (
      <Text numberOfLines={compact ? 2 : 3} style={[styles.hint, { color: theme.textMuted }]}>
        {text}
      </Text>
    ) : null;

  let stage: ReactNode = null;
  if (mode === 'confirm' && pending) {
    stage = (
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
    );
  } else if (mode === 'choose') {
    stage = (
      <>
        <View>
          <Text style={[styles.eyebrow, { color: theme.textMuted }]}>
            {exercises.length === 0 ? t('FIRST EXERCISE') : t('NEXT EXERCISE')}
          </Text>
          <Text style={[styles.prompt, compact && styles.promptCompact, { color: theme.text }]}>
            {t('What are you training?')}
          </Text>
        </View>
        {showMic && (
          <MicButton
            label={speech.listening ? t('Tap when done') : t('Say the exercise')}
            level={speech.level}
            listening={speech.listening}
            onPress={toggleMic}
            size={micSize}
          />
        )}
        {transcript || hint(t('For example “bench press”, “treadmill”, or “curls superset with pushdowns”.'))}
        {suggestions.length > 0 && (
          <View style={[styles.suggestions, { borderColor: theme.border }]}>
            {suggestions.map((option, index) => (
              <Pressable
                key={option.name}
                accessibilityLabel={t('Start {name}', { name: exerciseName(option.name) })}
                accessibilityRole="button"
                android_ripple={{ color: theme.ripple }}
                onPress={() => begin([{ name: option.name, muscle: option.muscle }], null)}
                style={({ pressed }) => [
                  styles.suggestion,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.flex}>
                  <Text numberOfLines={1} style={[styles.suggestionName, { color: theme.text }]}>
                    {exerciseName(option.name)}
                  </Text>
                  {option.muscle && (
                    <Text style={[styles.suggestionNote, { color: theme.textMuted }]}>{muscleName(option.muscle)}</Text>
                  )}
                </View>
                <Ionicons color={theme.accent} name="arrow-forward-circle" size={24} />
              </Pressable>
            ))}
          </View>
        )}
        {suggestions.length === 0 && next && next.options.length > 0 && !typed && (
          <View style={styles.recentBlock}>
            <Text numberOfLines={1} style={[styles.eyebrow, { color: theme.accent }]}>
              {t('SUGGESTED NEXT · {focus}', { focus: titleText(next.focus).toUpperCase() })}
            </Text>
            <View style={styles.chips}>
              {next.options.map((option) => (
                <Chip
                  key={option.name}
                  accessibilityLabel={t('Suggested: start {name}', { name: exerciseName(option.name) })}
                  disabled={saving || speech.listening}
                  icon="sparkles-outline"
                  label={exerciseName(option.name)}
                  onPress={() => begin([{ name: option.name, muscle: option.muscle }], null)}
                />
              ))}
            </View>
          </View>
        )}
        {suggestions.length === 0 && history.length > 0 && !typed && (
          <View style={styles.recentBlock}>
            <Text style={[styles.eyebrow, { color: theme.textMuted }]}>{t('RECENT')}</Text>
            <View style={styles.chips}>
              {history.slice(0, compact ? 4 : 6).map((name) => (
                <Chip
                  key={name}
                  accessibilityLabel={t('Start {name}', { name: exerciseName(name) })}
                  disabled={saving || speech.listening}
                  label={exerciseName(name)}
                  onPress={() => begin([{ name, muscle: muscleOf(name) }], null)}
                />
              ))}
            </View>
          </View>
        )}
      </>
    );
  } else if (mode === 'sets' && target) {
    const cardio = target.equipment === 'cardio';
    stage = (
      <>
        <View style={styles.currentHeader}>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>
            {active.length > 1 ? t('SUPERSET IN PROGRESS') : t('NOW TRAINING')}
          </Text>
          {lastSetEnd && (
            <View
              accessibilityLabel={t('Resting for {time}', {
                time: formatDuration(now.getTime() - new Date(lastSetEnd).getTime()),
              })}
              style={[styles.rest, { backgroundColor: theme.accentSoft }]}>
              <Ionicons color={theme.accent} name="timer-outline" size={15} />
              <Text style={[styles.restText, { color: theme.text }]}>
                {t('Rest {time}', { time: formatClock(Math.max(0, now.getTime() - new Date(lastSetEnd).getTime())) })}
              </Text>
            </View>
          )}
        </View>
        {active.map((exercise, index) => (
          <CurrentExercise
            key={exercise.id}
            compact={compact}
            exercise={exercise}
            isTarget={exercise.id === target.id}
            onEdit={() => openEditor(exercise)}
            onSelect={
              active.length > 1
                ? () => {
                    haptic.select();
                    setTargetIndex(index);
                  }
                : undefined
            }
            theme={theme}
          />
        ))}
        {showMic && !doubt && (
          <MicButton
            busy={saving}
            label={
              speech.listening
                ? t('Tap when done')
                : active.length > 1
                  ? t('Record set · {name}', { name: exerciseName(target.name) })
                  : cardio
                    ? t('Record time')
                    : t('Record set')
            }
            level={speech.level}
            listening={speech.listening}
            onPress={toggleMic}
            size={micSize}
          />
        )}
        {!doubt &&
          (transcript ||
            hint(
              target.sets.length > 0
                ? cardio
                  ? t('Say another time, “undo” or “next exercise”.')
                  : target.measure === 'time'
                    ? t('Say “45 seconds”, “same again”, “undo” or “next exercise”.')
                    : t('Say “8 reps”, “same again”, “undo” or “next exercise”.')
                : target.measure === 'time' && !cardio
                  ? t('After your hold, tap and say the time, like “60 seconds” or “1:30”. Add weight with “plus 10 kg”.')
                  : target.equipment
                    ? `${cardio ? '' : t('After your set, tap and say it.') + ' '}${equipmentHint(target.equipment)}`
                    : t('After your set, tap and say it, like “80 kg 10 reps”.'),
            ))}
        {doubt && doubt.exercise.id === target.id && (
          <View
            accessibilityLiveRegion="polite"
            style={[styles.doubt, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}>
            <View style={styles.doubtTitleRow}>
              <Ionicons color={theme.accent} name="help-circle" size={22} />
              <Text style={[styles.doubtTitle, { color: theme.text }]}>
                {t('Did you say {weight} {unit}?', { weight: doubt.doubt.heard, unit: doubt.doubt.unit })}
              </Text>
            </View>
            <Text style={[styles.doubtText, { color: theme.textMuted }]}>
              {t('That’s far from your usual weight on {name}. Did you mean {weight} {unit}?', {
                name: exerciseName(doubt.exercise.name),
                weight: doubt.doubt.suggestion,
                unit: doubt.doubt.unit,
              })}
            </Text>
            <Button
              label={t('No, {weight} {unit}', { weight: doubt.doubt.suggestion, unit: doubt.doubt.unit })}
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
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button
                  label={t('Yes, {weight} {unit}', { weight: doubt.doubt.heard, unit: doubt.doubt.unit })}
                  onPress={() => {
                    const { exercise, sets, technique, at } = doubt;
                    setDoubt(null);
                    addSets(exercise, sets, technique, at);
                  }}
                  variant="secondary"
                />
              </View>
              <View style={styles.flex}>
                <Button label={t('Cancel')} onPress={() => setDoubt(null)} variant="secondary" />
              </View>
            </View>
          </View>
        )}
        {!doubt && (previous || lastLogged(active)) && (
          <View style={[styles.chips, styles.centerChips]}>
            {previous && (
              <Chip
                accessibilityLabel={t('Log the same set again: {set}', { set: formatSetFor(previous, kindOf(target)) })}
                disabled={saving || speech.listening}
                icon="repeat"
                label={t('Same again · {set}', { set: shortSetFor(previous, kindOf(target)) })}
                onPress={() => addSets(target, [previous], null, new Date())}
              />
            )}
            {lastLogged(active) && (
              <Chip disabled={saving || speech.listening} icon="arrow-undo" label={t('Undo last set')} onPress={undo} />
            )}
          </View>
        )}
      </>
    );
  }

  const typePlaceholder =
    mode === 'sets' && target
      ? target.equipment === 'cardio'
        ? t('Or type the time, e.g. 15 min')
        : target.measure === 'time'
          ? t('Or type the time, e.g. 60 s')
          : t('Or type the set, e.g. 80 kg 10')
      : t('Or type the exercise name');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'web' ? undefined : 'padding'} style={styles.flex}>
      <View style={[styles.live, { gap, paddingVertical: compact ? 10 : 14 }]}>
        <View style={styles.topBar}>
          <View style={styles.flex}>
            <Text
              accessibilityLabel={t('Elapsed time {time}', { time: formatDuration(durationMs(workout, now)) })}
              style={[styles.clock, compact && styles.clockCompact, { color: theme.text }]}>
              {formatClock(durationMs(workout, now))}
            </Text>
            <Text numberOfLines={1} style={[styles.date, { color: theme.textMuted }]}>
              {t('Started at {time}', { time: formatTime(workout.startedAt) })}
            </Text>
          </View>
          <Pressable
            accessibilityHint={t('Shows the exercises and sets of this workout')}
            accessibilityLabel={t('Session log, {exercises}', { exercises: count(exercises.length, 'exercise') })}
            accessibilityRole="button"
            android_ripple={{ color: theme.ripple }}
            onPress={openLog}
            style={({ pressed }) => [
              styles.logButton,
              { borderColor: theme.border, backgroundColor: theme.surface },
              pressed && styles.pressed,
            ]}>
            <Ionicons color={theme.accent} name="list" size={20} />
            <Text style={[styles.logLabel, { color: theme.text }]}>{t('Session log')}</Text>
            {exercises.length > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
                <Text style={[styles.badgeText, { color: theme.accent }]}>{exercises.length}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={[styles.card, styles.stage, { backgroundColor: theme.surface, borderColor: mode === 'sets' ? theme.accent : theme.border }]}>
          {/* Only scrolls if a very small phone can't fit an unusually long list. */}
          <ScrollView
            bounces={false}
            contentContainerStyle={[styles.stageContent, { gap }]}
            keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {stage}
          </ScrollView>
        </View>

        {noticeView}
        {latest && !shownNotice && (
          <Text accessibilityLiveRegion="polite" numberOfLines={1} style={[styles.last, { color: theme.textMuted }]}>
            <Ionicons color={theme.accent} name="checkmark-circle" size={14} />{' '}
            {t('Last: {name}, {set}', {
              name: exerciseName(latest.exercise.name),
              set: shortSetFor(latest.set, kindOf(latest.exercise)),
            })}
          </Text>
        )}

        {mode !== 'confirm' && (
          <View style={styles.typeRow}>
            <TextInput
              accessibilityLabel={mode === 'sets' ? t('Type a set') : t('Type the exercise name')}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!speech.listening}
              id="exercise-text"
              onChangeText={setTyped}
              onSubmitEditing={submitTyped}
              placeholder={typePlaceholder}
              placeholderTextColor={theme.textMuted}
              returnKeyType={mode === 'sets' ? 'send' : 'search'}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
              submitBehavior="submit"
              value={typed}
            />
            <View style={styles.goButton}>
              <Button
                disabled={!typed.trim() || saving || speech.listening}
                label={mode === 'sets' ? t('Log') : t('Go')}
                onPress={submitTyped}
                variant="secondary"
              />
            </View>
          </View>
        )}

        {error && (
          <Text accessibilityLiveRegion="polite" style={[styles.error, { color: theme.danger }]}>
            {error}
          </Text>
        )}

        {!keyboardOpen &&
          (confirmingEnd ? (
            <View style={[styles.endBox, { borderColor: theme.border, backgroundColor: theme.surface, gap: compact ? 8 : 10 }]}>
              <Text style={[styles.confirmText, { color: theme.text }]}>{t('End this workout?')}</Text>
              <Text style={[styles.confirmNote, { color: theme.textMuted }]}>
                {t('{exercises}, {sets} in {time}.', {
                  exercises: count(exercises.filter((e) => e.sets.length > 0).length, 'exercise'),
                  sets: count(totalSets, 'set'),
                  time: formatDuration(durationMs(workout, now)),
                })}
              </Text>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button disabled={ending} label={t('Keep going')} onPress={() => setConfirmingEnd(false)} variant="secondary" />
                </View>
                <View style={styles.flex}>
                  <Button busy={ending} icon="flag" label={t('Yes, end workout')} onPress={end} variant="primary" />
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.row}>
              {mode === 'sets' && (
                <View style={styles.flex}>
                  <Button
                    disabled={saving || speech.listening}
                    icon="play-skip-forward"
                    label={t('Next exercise')}
                    onPress={nextExercise}
                    variant="secondary"
                  />
                </View>
              )}
              <View style={styles.flex}>
                <Button
                  icon="flag-outline"
                  label={t('End workout')}
                  onPress={() => {
                    haptic.select();
                    setConfirmingEnd(true);
                  }}
                  variant={mode === 'sets' ? 'secondary' : 'plain'}
                />
              </View>
            </View>
          ))}
      </View>
    </KeyboardAvoidingView>
  );
}

// The exercise in progress: its name and what was done so far. Every set is in the Session log.
function CurrentExercise({
  compact,
  exercise,
  isTarget,
  onEdit,
  onSelect,
  theme,
}: {
  compact: boolean;
  exercise: LoggedExercise;
  isTarget: boolean;
  onEdit: () => void;
  onSelect?: () => void;
  theme: Theme;
}) {
  const dimmed = onSelect && !isTarget;
  const cardio = exercise.equipment === 'cardio';
  const doneCount = exercise.sets.length;
  return (
    <View style={[styles.exerciseHeader, dimmed && styles.dimmed]}>
      <Pressable
        accessibilityLabel={onSelect ? t('Log the next set for {name}', { name: exerciseName(exercise.name) }) : undefined}
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
          <Text
            numberOfLines={onSelect ? 1 : 2}
            style={[styles.exerciseName, (compact || onSelect) && styles.exerciseNameSmall, { color: theme.text }]}>
            {exerciseName(exercise.name)}
          </Text>
        </View>
        <Text numberOfLines={1} style={[styles.exerciseMeta, { color: theme.textMuted }]}>
          {[
            exercise.muscle && muscleName(exercise.muscle),
            exercise.equipment && !cardio && equipmentLabel(exercise.equipment),
            exercise.equipment === 'barbell' && exercise.barKg !== null && t('{kg} kg bar', { kg: exercise.barKg }),
            doneCount > 0 ? t('{sets} done', { sets: count(doneCount, cardio ? 'session' : 'set') }) : null,
            exercise.technique && t(exercise.technique),
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </Pressable>
      <Pressable
        accessibilityLabel={t('Edit {name}', { name: exerciseName(exercise.name) })}
        accessibilityRole="button"
        android_ripple={{ color: theme.ripple, borderless: true }}
        hitSlop={10}
        onPress={onEdit}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
        <Ionicons color={theme.accent} name="create-outline" size={22} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', gap: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { fontSize: 17, textAlign: 'center' },
  notFoundAction: { marginTop: 18 },
  content: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 16 },
  live: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clock: { fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'], textAlign: 'left' },
  clockCompact: { fontSize: 28 },
  logButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  logLabel: { fontSize: 15, fontWeight: '600' },
  badge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  stage: { flex: 1, padding: 0, overflow: 'hidden' },
  stageContent: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  last: { fontSize: 14, textAlign: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  workoutTitle: { fontSize: 26, fontWeight: '800', flexShrink: 1, textAlign: 'left' },
  renameBox: { gap: 8 },
  renameHint: { fontSize: 14, textAlign: 'left' },
  doubt: { borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 10 },
  doubtTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doubtTitle: { fontSize: 18, fontWeight: '700', flexShrink: 1, textAlign: 'left' },
  doubtText: { fontSize: 15, lineHeight: 21, textAlign: 'left' },
  date: { fontSize: 15, textAlign: 'left' },
  times: { fontSize: 18, fontWeight: '700', marginTop: 2, textAlign: 'left' },
  summary: { fontSize: 17, textAlign: 'left' },
  card: { borderWidth: 1, borderRadius: 20 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.9, textAlign: 'left' },
  prompt: { fontSize: 24, fontWeight: '700', marginTop: 2, textAlign: 'left' },
  promptCompact: { fontSize: 20 },
  hint: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  heard: { fontSize: 19, lineHeight: 26, minHeight: 26, textAlign: 'center', fontWeight: '600' },
  typeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    textAlign: 'auto',
  },
  goButton: { width: 76 },
  suggestions: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  suggestion: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 6 },
  suggestionName: { fontSize: 16, fontWeight: '600', textAlign: 'left' },
  suggestionNote: { fontSize: 13, marginTop: 1, textAlign: 'left' },
  recentBlock: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  centerChips: { justifyContent: 'center' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  noticeText: { flex: 1, fontSize: 15, lineHeight: 21, textAlign: 'left' },
  currentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rest: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  restText: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  dimmed: { opacity: 0.6 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exerciseName: { fontSize: 26, fontWeight: '800', flexShrink: 1, textAlign: 'left' },
  exerciseNameSmall: { fontSize: 20 },
  exerciseMeta: { fontSize: 14, marginTop: 2, textAlign: 'left' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  list: { gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.9, marginTop: 4, textAlign: 'left' },
  placeholder: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 24 },
  placeholderText: { fontSize: 16, textAlign: 'center' },
  error: { fontSize: 15, textAlign: 'left' },
  actions: { gap: 10 },
  endBox: { borderWidth: 1, borderRadius: 16, padding: 14 },
  confirmText: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  confirmNote: { fontSize: 15, textAlign: 'center' },
  pressed: { opacity: 0.8 },
});
