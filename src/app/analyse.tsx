import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { IconName } from '@/ui/Button';
import { useTheme } from '@/ui/theme';

const SECTIONS: { icon: IconName; title: string; detail: string }[] = [
  {
    icon: 'list',
    title: 'Workout summary',
    detail: 'Pick a workout and see its exercises, sets, weights and reps.',
  },
  {
    icon: 'body',
    title: 'Monthly summary',
    detail: 'A body heat map of the muscles you trained, your PRs and advice for next month.',
  },
  {
    icon: 'trending-up',
    title: 'Progress',
    detail: 'How each exercise has improved over time.',
  },
];

// Behind the Analyse button (requirement 18b). The sections are built in a later round.
export default function Analyse() {
  const theme = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.column}>
        {SECTIONS.map((section) => (
          <View
            accessibilityLabel={`${section.title}, coming soon. ${section.detail}`}
            key={section.title}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons color={theme.analyse} name={section.icon} size={30} />
            <View style={styles.text}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: theme.text }]}>{section.title}</Text>
                <View style={[styles.badge, { borderColor: theme.textMuted }]}>
                  <Text style={[styles.badgeText, { color: theme.textMuted }]}>Coming soon</Text>
                </View>
              </View>
              <Text style={[styles.detail, { color: theme.textMuted }]}>{section.detail}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, flexGrow: 1 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 14 },
  card: { borderWidth: 1, borderRadius: 16, padding: 18, flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  text: { flex: 1, minWidth: 0, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  title: { fontSize: 19, fontWeight: '700' },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  detail: { fontSize: 15, lineHeight: 21 },
});
