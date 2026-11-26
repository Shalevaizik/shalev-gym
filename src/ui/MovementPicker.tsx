import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { muscleOf, searchExercises } from '@/domain/exerciseCatalog';
import { SESSION_MOVEMENTS } from '@/domain/session';

import type { IconName } from './Button';
import { haptic } from './haptics';
import { useTheme } from './theme';

type Props = {
  // Movements the trainer used before, newest first.
  recent: string[];
  // Movements already in the session, shown with a tick.
  added: string[];
  onAdd: (name: string) => void;
  onDone: () => void;
};

const GROUP_ICON: Record<string, IconName> = {
  Recent: 'time-outline',
  Bodyweight: 'body-outline',
  Gymnastics: 'git-pull-request-outline',
  'Kettlebell and dumbbell': 'barbell-outline',
  Barbell: 'barbell',
  'Ball, sled and more': 'basketball-outline',
  Cardio: 'heart-outline',
};

// Picking movements for a HIIT or CrossFit session (requirement 24c). The groups are a list of
// titles; tapping one opens its movements underneath (one group open at a time). Tapping a
// movement adds it and ticks it, so several can be added before tapping Done. Searching looks
// through every group, and anything not found can be added as typed.
export function MovementPicker({ recent, added, onAdd, onDone }: Props) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const typed = query.trim();

  const groups = useMemo(
    () => [...(recent.length > 0 ? [{ group: 'Recent', names: recent.slice(0, 10) }] : []), ...SESSION_MOVEMENTS],
    [recent],
  );
  const found = useMemo(() => (typed.length >= 2 ? searchExercises(typed, recent).map((o) => o.name).slice(0, 8) : []), [typed, recent]);
  const exact = found.some((name) => name.toLowerCase() === typed.toLowerCase());

  function toggle(group: string) {
    if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    haptic.select();
    setOpen((current) => (current === group ? null : group));
  }

  function add(name: string) {
    onAdd(name);
    setQuery('');
  }

  const row = (name: string, index: number) => {
    const isAdded = added.some((a) => a.toLowerCase() === name.toLowerCase());
    const muscle = muscleOf(name);
    return (
      <Pressable
        key={name}
        accessibilityLabel={isAdded ? `${name}, added. Add again` : `Add ${name}`}
        accessibilityRole="button"
        android_ripple={{ color: theme.ripple }}
        onPress={() => add(name)}
        style={({ pressed }) => [
          styles.row,
          index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
          pressed && styles.pressed,
        ]}>
        <Ionicons
          color={isAdded ? theme.accent : theme.textMuted}
          name={isAdded ? 'checkmark-circle' : 'add-circle-outline'}
          size={22}
        />
        <Text numberOfLines={1} style={[styles.name, { color: theme.text }, isAdded && styles.bold]}>
          {name}
        </Text>
        {muscle && muscle !== 'Cardio' && <Text style={[styles.muscle, { color: theme.textMuted }]}>{muscle}</Text>}
      </Pressable>
    );
  };

  return (
    <View style={[styles.box, { borderColor: theme.accent, backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Add movements</Text>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onDone} style={[styles.done, { backgroundColor: theme.accent }]}>
          <Text style={[styles.doneText, { color: theme.onAccent }]}>Done</Text>
        </Pressable>
      </View>

      <View style={[styles.search, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <Ionicons color={theme.textMuted} name="search" size={18} />
        <TextInput
          accessibilityLabel="Search movements"
          onChangeText={setQuery}
          onSubmitEditing={() => typed && add(exact ? found[0] : typed)}
          placeholder="Search, or type a new movement"
          placeholderTextColor={theme.textMuted}
          returnKeyType="done"
          style={[styles.searchInput, { color: theme.text }]}
          value={query}
        />
        {query.length > 0 && (
          <Pressable accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery('')}>
            <Ionicons color={theme.textMuted} name="close-circle" size={18} />
          </Pressable>
        )}
      </View>

      {typed ? (
        <View style={[styles.list, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          {found.map(row)}
          {!exact && (
            <Pressable
              accessibilityRole="button"
              onPress={() => add(typed)}
              style={({ pressed }) => [
                styles.row,
                found.length > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                pressed && styles.pressed,
              ]}>
              <Ionicons color={theme.accent} name="create-outline" size={22} />
              <Text numberOfLines={1} style={[styles.name, { color: theme.accent }]}>
                Add “{typed}”
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={[styles.list, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          {groups.map(({ group, names }, index) => {
            const isOpen = open === group;
            const picked = names.filter((n) => added.some((a) => a.toLowerCase() === n.toLowerCase())).length;
            return (
              <View key={group} style={index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }}>
                <Pressable
                  accessibilityLabel={`${group}, ${names.length} movements`}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  android_ripple={{ color: theme.ripple }}
                  onPress={() => toggle(group)}
                  style={({ pressed }) => [styles.groupRow, isOpen && { backgroundColor: theme.accentSoft }, pressed && styles.pressed]}>
                  <Ionicons color={theme.accent} name={GROUP_ICON[group] ?? 'list'} size={22} />
                  <Text style={[styles.groupName, { color: theme.text }]}>{group}</Text>
                  {picked > 0 && (
                    <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                      <Text style={[styles.badgeText, { color: theme.onAccent }]}>{picked}</Text>
                    </View>
                  )}
                  <Text style={[styles.count, { color: theme.textMuted }]}>{names.length}</Text>
                  <Ionicons color={theme.textMuted} name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} />
                </Pressable>
                {isOpen && <View style={styles.subList}>{names.map(row)}</View>}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1.5, borderRadius: 16, padding: 12, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '700' },
  done: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  doneText: { fontSize: 15, fontWeight: '700' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 46 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 16, paddingVertical: 8 },
  list: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 14 },
  groupName: { flex: 1, fontSize: 16, fontWeight: '600' },
  count: { fontSize: 14, fontVariant: ['tabular-nums'] },
  badge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  subList: { paddingStart: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14 },
  name: { flex: 1, fontSize: 16 },
  bold: { fontWeight: '600' },
  muscle: { fontSize: 13 },
  pressed: { opacity: 0.7 },
});
