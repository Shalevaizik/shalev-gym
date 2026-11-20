import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { getProfile } from '@/data/profileRepo';
import { ageOn, formatBodyWeight, formatHeight, type Profile } from '@/domain/profile';

import { Button } from './Button';
import { useTheme } from './theme';

const SEX_LABEL = { male: 'Male', female: 'Female' } as const;

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// The ☰ button in the top-right corner and the drop-down menu it opens (requirement 18e):
// the trainer's profile (requirement 20), settings and sign-out.
export function AppMenu() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { user, accountsEnabled, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function show() {
    setError(null);
    setOpen(true);
    if (!user) return;
    try {
      setProfile(await getProfile(db, user.id));
    } catch {
      setError('Your profile could not be loaded.');
    }
  }

  function goTo(path: '/profile') {
    setOpen(false);
    router.push(path);
  }

  async function handleSignOut() {
    setError(null);
    try {
      await signOut();
      setOpen(false);
    } catch {
      setError('You could not be signed out. Please try again.');
    }
  }

  const hasProfile = profile !== null && (profile.birthDate !== null || profile.weight !== null);
  const rows: [string, string][] = profile
    ? [
        ['Age', profile.birthDate ? String(ageOn(profile.birthDate, new Date())) : '—'],
        ['Sex', profile.sex ? SEX_LABEL[profile.sex] : '—'],
        ['Height', profile.heightCm ? formatHeight(profile.heightCm, profile.heightUnit) : '—'],
        ['Weight', profile.weight ? formatBodyWeight(profile.weight) : '—'],
      ]
    : [];

  return (
    <>
      <Pressable
        accessibilityLabel="Menu"
        accessibilityRole="button"
        hitSlop={10}
        onPress={show}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
        <Ionicons color={theme.text} name="menu" size={28} />
      </Pressable>

      <Modal animationType="fade" onRequestClose={() => setOpen(false)} transparent visible={open}>
        <Pressable
          accessibilityLabel="Close the menu"
          onPress={() => setOpen(false)}
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }]}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.panel,
            { top: insets.top + 8, right: insets.right + 12, backgroundColor: theme.surface, borderColor: theme.border },
          ]}>
          <ScrollView contentContainerStyle={styles.panelContent}>
            <View style={styles.headerRow}>
              <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
                Your profile
              </Text>
              <Pressable accessibilityLabel="Close" accessibilityRole="button" hitSlop={10} onPress={() => setOpen(false)}>
                <Ionicons color={theme.textMuted} name="close" size={24} />
              </Pressable>
            </View>

            {profile === null && !error && <Text style={{ color: theme.textMuted }}>Loading…</Text>}

            {profile !== null && !hasProfile && (
              <Text style={[styles.body, { color: theme.textMuted }]}>
                Add your date of birth, sex, height and weight. Your weight is used for bodyweight exercises
                like pull-ups and dips.
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
                Weight updated {formatDay(profile.weight.recordedAt)}
              </Text>
            )}

            {profile !== null && (
              <Button
                icon={hasProfile ? 'create-outline' : 'person-add-outline'}
                label={hasProfile ? 'Update' : 'Set up your profile'}
                onPress={() => goTo('/profile')}
                variant={hasProfile ? 'secondary' : 'primary'}
              />
            )}

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.settingRow}>
              <Ionicons color={theme.textMuted} name="barbell-outline" size={22} />
              <Text style={[styles.settingLabel, { color: theme.textMuted }]}>Bar weights</Text>
              <Text style={[styles.small, { color: theme.textMuted }]}>Coming soon</Text>
            </View>

            {accountsEnabled && (
              <>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                {user?.email && <Text style={[styles.small, { color: theme.textMuted }]}>{user.email}</Text>}
                <Button icon="log-out-outline" label="Sign out" onPress={handleSignOut} variant="plain" />
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
  trigger: { padding: 6, marginRight: 4 },
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
  body: { fontSize: 15, lineHeight: 21 },
  table: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11 },
  rowLabel: { fontSize: 15 },
  rowValue: { fontSize: 15, fontWeight: '600' },
  small: { fontSize: 13 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  settingLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
});
