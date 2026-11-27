import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IconName } from './Button';
import { haptic } from './haptics';
import { useTheme } from './theme';

export type Tab = 'home' | 'workouts' | 'analyse';
type Soon = 'eat' | 'challenge';

const TABS: { key: Tab | Soon; label: string; icon: IconName; href?: Href }[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', href: '/' },
  { key: 'workouts', label: 'Workouts', icon: 'barbell-outline', href: '/workout' },
  { key: 'analyse', label: 'Analyse', icon: 'stats-chart-outline', href: '/analyse' },
  { key: 'eat', label: 'Eat', icon: 'restaurant-outline' },
  { key: 'challenge', label: 'Challenge', icon: 'trophy-outline' },
];

type Props = {
  current: Tab;
  // Eat and Challenge are coming soon: the screen says so when one is tapped.
  onSoon: (which: Soon) => void;
};

// The bottom tab bar of design D: Home, Workouts, Analyse, and Eat and Challenge marked "soon".
export function TabBar({ current, onSoon }: Props) {
  const theme = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {TABS.map((tab) => {
        const selected = tab.key === current;
        const soon = !tab.href;
        return (
          <Pressable
            key={tab.key}
            accessibilityLabel={soon ? `${tab.label}, coming soon` : tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            android_ripple={{ color: theme.ripple, borderless: true }}
            onPress={() => {
              haptic.select();
              if (tab.href) {
                if (!selected) router.navigate(tab.href);
              } else onSoon(tab.key as Soon);
            }}
            style={({ pressed }) => [
              styles.tab,
              selected && { backgroundColor: theme.surfaceStrong },
              pressed && styles.pressed,
            ]}>
            {soon && (
              <View style={[styles.soon, { backgroundColor: theme.surfaceStrong }]}>
                <Text style={[styles.soonText, { color: theme.textMuted }]}>SOON</Text>
              </View>
            )}
            <Ionicons color={selected ? theme.text : soon ? '#7E8592' : theme.textMuted} name={tab.icon} size={21} />
            <Text style={[styles.label, { color: selected ? theme.text : soon ? '#7E8592' : theme.textMuted }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderWidth: 1, borderRadius: 999, padding: 5 },
  tab: { flex: 1, minHeight: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 11, fontWeight: '600' },
  soon: { position: 'absolute', top: 3, right: 4, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 },
  soonText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.4 },
  pressed: { opacity: 0.7 },
});
