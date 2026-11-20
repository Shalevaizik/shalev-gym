import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { IconName } from '@/ui/Button';
import { useTheme } from '@/ui/theme';

const SECTIONS: { icon: IconName; title: string; detail: string; href: Href }[] = [
  {
    icon: 'body',
    title: 'Monthly summary',
    detail: 'A body heat map of the muscles you trained, your records and advice for next month.',
    href: '/analyse/monthly',
  },
  {
    icon: 'list',
    title: 'Workout summary',
    detail: 'Pick a workout and see its exercises, sets, weights and reps.',
    href: '/analyse/summary',
  },
  {
    icon: 'trending-up',
    title: 'Progress',
    detail: 'How each exercise has improved over time.',
    href: '/analyse/progress',
  },
];

// Behind the Analyse button (requirement 18b).
export default function Analyse() {
  const theme = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.column}>
        {SECTIONS.map((section) => (
          <Pressable
            key={section.title}
            accessibilityHint={section.detail}
            accessibilityLabel={section.title}
            accessibilityRole="button"
            android_ripple={{ color: theme.ripple }}
            onPress={() => router.push(section.href)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
              pressed && styles.pressed,
            ]}>
            <Ionicons color={theme.analyse} name={section.icon} size={30} />
            <View style={styles.text}>
              <Text style={[styles.title, { color: theme.text }]}>{section.title}</Text>
              <Text style={[styles.detail, { color: theme.textMuted }]}>{section.detail}</Text>
            </View>
            <Ionicons color={theme.textMuted} name="chevron-forward" size={22} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, flexGrow: 1 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 14 },
  card: { borderWidth: 1, borderRadius: 16, padding: 18, flexDirection: 'row', gap: 16, alignItems: 'center' },
  text: { flex: 1, minWidth: 0, gap: 6 },
  title: { fontSize: 19, fontWeight: '700' },
  detail: { fontSize: 15, lineHeight: 21 },
  pressed: { opacity: 0.8 },
});
