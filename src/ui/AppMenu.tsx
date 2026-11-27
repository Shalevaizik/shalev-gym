import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { getProfile } from '@/data/profileRepo';
import { ageOn, formatBodyWeight, formatHeight, type Profile } from '@/domain/profile';
import { currentLanguage, dateLocale, t, type Language } from '@/i18n/core';
import { changeLanguage, HEBREW_READY } from '@/i18n/language';

import { Button } from './Button';
import { useTheme } from './theme';

const SEX_LABEL = { male: 'Male', female: 'Female' } as const;

// Each language is named in itself, so it can be found whichever language is on.
const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'he', label: 'עברית' },
];

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

// The ☰ button in the top-right corner and the drop-down menu it opens (requirement 18e):
// the trainer's profile (requirement 20), settings, the app's language and sign-out.
export function AppMenu() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { user, accountsEnabled, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState<Language | null>(null);

  async function show() {
    setError(null);
    setOpen(true);
    if (!user) return;
    try {
      setProfile(await getProfile(db, user.id));
    } catch {
      setError(t('Your profile could not be loaded.'));
    }
  }

  function goTo(path: '/profile' | '/bar-weights') {
    setOpen(false);
    router.push(path);
  }

  async function handleSignOut() {
    setError(null);
    try {
      await signOut();
      setOpen(false);
    } catch {
      setError(t('You could not be signed out. Please try again.'));
    }
  }

  const hasProfile = profile !== null && (profile.birthDate !== null || profile.weight !== null);
  const rows: [string, string][] = profile
    ? [
        [t('Age'), profile.birthDate ? String(ageOn(profile.birthDate, new Date())) : '—'],
        [t('Sex'), profile.sex ? t(SEX_LABEL[profile.sex]) : '—'],
        [t('Height'), profile.heightCm ? formatHeight(profile.heightCm, profile.heightUnit) : '—'],
        [t('Weight'), profile.weight ? formatBodyWeight(profile.weight) : '—'],
      ]
    : [];

  return (
    <>
      <Pressable
        accessibilityLabel={t('Menu')}
        accessibilityRole="button"
        hitSlop={10}
        onPress={show}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
        <Ionicons color={theme.text} name="menu" size={28} />
      </Pressable>

      <Modal animationType="fade" onRequestClose={() => setOpen(false)} transparent visible={open}>
        <Pressable
          accessibilityLabel={t('Close the menu')}
          onPress={() => setOpen(false)}
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }]}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.panel,
            { top: insets.top + 8, end: 12, backgroundColor: theme.panel, borderColor: theme.border },
          ]}>
          <ScrollView contentContainerStyle={styles.panelContent}>
            <View style={styles.headerRow}>
              <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
                {t('Your profile')}
              </Text>
              <Pressable accessibilityLabel={t('Close')} accessibilityRole="button" hitSlop={10} onPress={() => setOpen(false)}>
                <Ionicons color={theme.textMuted} name="close" size={24} />
              </Pressable>
            </View>

            {profile === null && !error && <Text style={{ color: theme.textMuted }}>{t('Loading…')}</Text>}

            {profile !== null && !hasProfile && (
              <Text style={[styles.body, { color: theme.textMuted }]}>
                {t('Add your date of birth, sex, height and weight. Your weight is used for bodyweight exercises like pull-ups and dips.')}
              </Text>
            )}

            {hasProfile && (
              <View style={[styles.table, { borderColor: theme.border }]}>
                {rows.map(([label, value], index) => (
                  <View
                    key={label}
                    style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                    <Text style={[styles.rowLabel, { color: theme.textMuted }]}>{label}</Text>
                    <Text style={[styles.rowValue, { color: theme.text }]}>{value}</Text>
                  </View>
                ))}
              </View>
            )}
            {profile?.weight && (
              <Text style={[styles.small, { color: theme.textMuted }]}>
                {t('Weight updated {date}', { date: formatDay(profile.weight.recordedAt) })}
              </Text>
            )}

            {profile !== null && (
              <Button
                icon={hasProfile ? 'create-outline' : 'person-add-outline'}
                label={hasProfile ? t('Update') : t('Set up your profile')}
                onPress={() => goTo('/profile')}
                variant={hasProfile ? 'secondary' : 'primary'}
              />
            )}

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <Pressable
              accessibilityLabel={t('Bar weights')}
              accessibilityRole="button"
              onPress={() => goTo('/bar-weights')}
              style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}>
              <Ionicons color={theme.accent} name="barbell-outline" size={22} />
              <Text style={[styles.settingLabel, { color: theme.text }]}>{t('Bar weights')}</Text>
              <Ionicons color={theme.textMuted} name="chevron-forward" size={20} />
            </Pressable>

            {HEBREW_READY && (
            <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.settingRow}>
              <Ionicons color={theme.accent} name="language-outline" size={22} />
              <Text style={[styles.settingLabel, { color: theme.text }]}>{t('Language')}</Text>
            </View>
            <View style={styles.languages}>
              {LANGUAGES.map((option) => {
                const selected = currentLanguage() === option.value;
                return (
                  <View key={option.value} style={styles.flex}>
                    <Button
                      busy={switching === option.value}
                      disabled={switching !== null}
                      label={option.label}
                      onPress={() => {
                        if (selected) return;
                        setSwitching(option.value);
                        changeLanguage(option.value).catch(() => {
                          setSwitching(null);
                          setError(t('The language could not be changed. Please try again.'));
                        });
                      }}
                      variant={selected ? 'primary' : 'secondary'}
                    />
                  </View>
                );
              })}
            </View>
            <Text style={[styles.small, { color: theme.textMuted }]}>{t('The app restarts in the language you pick.')}</Text>
            </>
            )}

            {accountsEnabled && (
              <>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                {user?.email && <Text style={[styles.small, { color: theme.textMuted }]}>{user.email}</Text>}
                <Button icon="log-out-outline" label={t('Sign out')} onPress={handleSignOut} variant="plain" />
              </>
            )}

            {error && (
              <Text accessibilityLiveRegion="polite" style={[styles.body, { color: theme.danger }]}>
                {error}
              </Text>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { padding: 6, marginEnd: 4 },
  flex: { flex: 1 },
  languages: { flexDirection: 'row', gap: 10 },
  pressed: { opacity: 0.6 },
  panel: {
    position: 'absolute',
    width: 320,
    maxWidth: '92%',
    maxHeight: '85%',
    borderRadius: 18,
    borderWidth: 1,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
  },
  panelContent: { padding: 18, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21, textAlign: 'left' },
  table: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11 },
  rowLabel: { fontSize: 15 },
  rowValue: { fontSize: 15, fontWeight: '600' },
  small: { fontSize: 13 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  settingLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
});
