import { LocaleProvider, Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { DATABASE_NAME, migrate } from '@/data/db';
import { t } from '@/i18n/core';
import { startLanguage } from '@/i18n/language';
import { AppMenu } from '@/ui/AppMenu';
import { Button } from '@/ui/Button';
import { useTheme } from '@/ui/theme';

// The language is chosen before anything draws, so every screen starts in it (Hebrew or English).
const language = startLanguage();

const menu = () => <AppMenu />;

function Routes() {
  const { loading, user } = useAuth();
  const theme = useTheme();
  // Android draws the app behind its navigation bar (back, home, recent apps), so every screen
  // stops above it and the last button can always be reached. iOS screens adjust for this themselves.
  const { bottom } = useSafeAreaInsets();
  const navBarSpace = process.env.EXPO_OS === 'android' ? bottom : 0;

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.background,
        }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <LocaleProvider direction={language === 'he' ? 'rtl' : 'ltr'}>
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background, paddingBottom: navBarSpace },
      }}>
      <Stack.Protected guard={user !== null}>
        <Stack.Screen name="index" options={{ title: t('Shalev Gym'), headerRight: menu }} />
        <Stack.Screen name="workout/index" options={{ title: t('Workout'), headerRight: menu }} />
        <Stack.Screen name="workout/history" options={{ title: t('Previous workouts'), headerRight: menu }} />
        <Stack.Screen name="workout/[id]" options={{ title: t('Workout'), headerRight: menu }} />
        <Stack.Screen name="workout/session-log" options={{ title: t('Session log') }} />
        <Stack.Screen name="workout/session" options={{ title: t('Session') }} />
        <Stack.Screen name="exercise/[id]" options={{ title: t('Edit exercise') }} />
        <Stack.Screen name="analyse/index" options={{ title: t('Analyse'), headerRight: menu }} />
        <Stack.Screen name="analyse/monthly" options={{ title: t('Monthly summary'), headerRight: menu }} />
        <Stack.Screen name="analyse/summary/index" options={{ title: t('Workout summary'), headerRight: menu }} />
        <Stack.Screen name="analyse/summary/[id]" options={{ title: t('Workout summary'), headerRight: menu }} />
        <Stack.Screen name="analyse/progress/index" options={{ title: t('Progress'), headerRight: menu }} />
        <Stack.Screen name="analyse/progress/[name]" options={{ title: t('Progress'), headerRight: menu }} />
        <Stack.Screen name="profile" options={{ title: t('Your profile') }} />
        <Stack.Screen name="bar-weights" options={{ title: t('Bar weights') }} />
      </Stack.Protected>
      <Stack.Protected guard={user === null}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
    </LocaleProvider>
  );
}

// Shown instead of a crash when the on-device database can't be opened. In a browser this happens
// when the app is already open in another tab, because only one tab at a time can use it.
function DatabaseUnavailable({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const theme = useTheme();
  const otherTab = /access handle/i.test(error.message);
  return (
    <View style={[styles.unavailable, { backgroundColor: theme.background }]}>
      <Text accessibilityRole="header" style={[styles.unavailableTitle, { color: theme.text }]}>
        {otherTab ? t('Shalev Gym is open in another tab') : t('Your workouts could not be opened')}
      </Text>
      <Text style={[styles.unavailableText, { color: theme.textMuted }]}>
        {otherTab
          ? t('The app can only be open in one browser tab at a time. Close the other tab, then tap Try again.')
          : t('Something went wrong while opening your data. Tap Try again.')}
      </Text>
      <Button icon="refresh" label={t('Try again')} onPress={onRetry} />
    </View>
  );
}

// When a browser page reloads, the closing page can hold the database for a moment longer. The app
// then reloads once by itself before saying anything; only a second failure shows the message.
const RETRY_KEY = 'shalev-gym:db-retry';
let reloading = false;

function reloadOnceInBrowser(): boolean {
  if (process.env.EXPO_OS !== 'web') return false;
  if (reloading) return true;
  try {
    if (window.sessionStorage.getItem(RETRY_KEY)) return false;
    window.sessionStorage.setItem(RETRY_KEY, '1');
  } catch {
    return false;
  }
  reloading = true;
  setTimeout(() => window.location.reload(), 800);
  return true;
}

async function openDatabase(db: Parameters<typeof migrate>[0]) {
  await migrate(db);
  if (process.env.EXPO_OS === 'web') {
    try {
      window.sessionStorage.removeItem(RETRY_KEY);
    } catch {
      // Only the automatic retry is affected.
    }
  }
}

export default function RootLayout() {
  const [dbError, setDbError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Called while the database component renders, so the state update waits a tick.
  const onDbError = useCallback((error: Error) => {
    if (reloadOnceInBrowser()) return;
    setTimeout(() => setDbError(error), 0);
  }, []);

  return (
    <SafeAreaProvider>
      {dbError ? (
        <DatabaseUnavailable
          error={dbError}
          onRetry={() => {
            // In a browser the failed attempt can keep the file busy, so start the page afresh.
            if (process.env.EXPO_OS === 'web') {
              window.location.reload();
              return;
            }
            setDbError(null);
            setAttempt((n) => n + 1);
          }}
        />
      ) : (
        <SQLiteProvider databaseName={DATABASE_NAME} key={attempt} onError={onDbError} onInit={openDatabase}>
          <AuthProvider>
            <StatusBar style="auto" />
            <Routes />
          </AuthProvider>
        </SQLiteProvider>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  unavailable: { flex: 1, justifyContent: 'center', padding: 24, gap: 14, alignItems: 'stretch' },
  unavailableTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  unavailableText: { fontSize: 16, lineHeight: 23, textAlign: 'center', marginBottom: 8 },
});
