import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { DATABASE_NAME, migrate } from '@/data/db';
import { AppMenu } from '@/ui/AppMenu';
import { useTheme } from '@/ui/theme';

const menu = () => <AppMenu />;

function Routes() {
  const { loading, user } = useAuth();
  const theme = useTheme();

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
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Protected guard={user !== null}>
        <Stack.Screen name="index" options={{ title: 'Shalev Gym', headerRight: menu }} />
        <Stack.Screen name="workout/index" options={{ title: 'Workout', headerRight: menu }} />
        <Stack.Screen name="workout/history" options={{ title: 'Previous workouts', headerRight: menu }} />
        <Stack.Screen name="workout/[id]" options={{ title: 'Workout', headerRight: menu }} />
        <Stack.Screen name="exercise/[id]" options={{ title: 'Edit exercise' }} />
        <Stack.Screen name="analyse" options={{ title: 'Analyse', headerRight: menu }} />
        <Stack.Screen name="profile" options={{ title: 'Your profile' }} />
      </Stack.Protected>
      <Stack.Protected guard={user === null}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
        <AuthProvider>
          <StatusBar style="auto" />
          <Routes />
        </AuthProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
