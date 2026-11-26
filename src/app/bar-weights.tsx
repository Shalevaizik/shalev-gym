import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { listBarWeights, setBarWeight, type BarWeight } from '@/data/exerciseRepo';
import { DEFAULT_BAR_KG, kindFor } from '@/domain/equipment';
import { exerciseName, t } from '@/i18n/core';
import { Button } from '@/ui/Button';
import { useTheme } from '@/ui/theme';

// The bar weight each barbell exercise uses (requirement 17a), opened from the ☰ menu.
export default function BarWeights() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const theme = useTheme();
  const [bars, setBars] = useState<BarWeight[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const userId = user?.id;

  const load = useCallback(async () => {
    if (!userId) return;
    const list = await listBarWeights(db, userId);
    setBars(list);
    setDrafts(Object.fromEntries(list.map((b) => [b.name, String(b.barKg)])));
  }, [db, userId]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setMessage({ tone: 'error', text: t('Your bar weights could not be loaded.') }));
    }, [load]),
  );

  async function save(bar: BarWeight) {
    if (!userId) return;
    const value = Number((drafts[bar.name] ?? '').replace(',', '.'));
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setMessage({ tone: 'error', text: t('{name}: enter the bar’s weight in kg, between 0 and 100.', { name: exerciseName(bar.name) }) });
      return;
    }
    try {
      await setBarWeight(db, userId, bar.name, value);
      await load();
      setMessage({ tone: 'ok', text: t('{name} now uses a {kg} kg bar.', { name: exerciseName(bar.name), kg: value }) });
    } catch {
      setMessage({ tone: 'error', text: t('The bar weight could not be saved. Please try again.') });
    }
  }

  async function reset(bar: BarWeight) {
    if (!userId) return;
    try {
      await setBarWeight(db, userId, bar.name, null);
      await load();
      setMessage({ tone: 'ok', text: t('{name} is back to the usual {kg} kg bar.', { name: exerciseName(bar.name), kg: kindFor(bar.name).barKg ?? DEFAULT_BAR_KG }) });
    } catch {
      setMessage({ tone: 'error', text: t('The bar weight could not be reset. Please try again.') });
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
      <View style={styles.column}>
        <Text style={[styles.intro, { color: theme.textMuted }]}>
          {t(
            'On a barbell you say the weight per side, and the app adds the bar. Most bars weigh {kg} kg; change it here for an EZ bar, a Smith machine or a lighter bar. It applies to that exercise from now on.',
            { kg: DEFAULT_BAR_KG },
          )}
        </Text>

        {message && (
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.message, { color: message.tone === 'error' ? theme.danger : theme.accent }]}>
            {message.text}
          </Text>
        )}

        {bars !== null && bars.length === 0 && (
          <Text style={[styles.empty, { color: theme.textMuted }]}>
            {t('Barbell exercises you do will appear here.')}
          </Text>
        )}

        {bars?.map((bar) => (
          <View key={bar.name} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.flex}>
              <Text style={[styles.name, { color: theme.text }]}>{exerciseName(bar.name)}</Text>
              <Text style={[styles.note, { color: theme.textMuted }]}>{bar.own ? t('Your setting') : t('Usual bar')}</Text>
            </View>
            <TextInput
              accessibilityLabel={t('{name} bar weight in kg', { name: exerciseName(bar.name) })}
              inputMode="decimal"
              keyboardType="decimal-pad"
              maxLength={5}
              onChangeText={(text) => setDrafts((current) => ({ ...current, [bar.name]: text }))}
              onSubmitEditing={() => save(bar)}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              value={drafts[bar.name] ?? ''}
            />
            <Text style={[styles.unit, { color: theme.textMuted }]}>kg</Text>
            <View style={styles.buttons}>
              <Button label={t('Save')} onPress={() => save(bar)} variant="secondary" />
              {bar.own && <Button label={t('Reset')} onPress={() => reset(bar)} variant="plain" />}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, flexGrow: 1 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 12 },
  intro: { fontSize: 15, lineHeight: 22 },
  message: { fontSize: 15, fontWeight: '600' },
  empty: { fontSize: 16, textAlign: 'center', marginTop: 30 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 140 },
  name: { fontSize: 17, fontWeight: '700' },
  note: { fontSize: 13, marginTop: 2 },
  input: { width: 72, minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 17, textAlign: 'center' },
  unit: { fontSize: 15 },
  buttons: { flexDirection: 'row', gap: 6 },
});
