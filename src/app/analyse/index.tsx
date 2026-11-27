import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n/core';
import type { IconName } from '@/ui/Button';
import { Glow } from '@/ui/Glow';
import { TabBar } from '@/ui/TabBar';
import { FONT, useTheme } from '@/ui/theme';

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
  const [soon, setSoon] = useState<'eat' | 'challenge' | null>(null);
  useFocusEffect(useCallback(() => setSoon(null), []));
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
    <Glow left={60} top={-40} opacity={0.14} />
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.column}>
        {SECTIONS.map((section) => (
          <Pressable
            key={section.title}
            accessibilityHint={t(section.detail)}
            accessibilityLabel={t(section.title)}
            accessibilityRole="button"
            android_ripple={{ color: theme.ripple }}
            onPress={() => router.push(section.href)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
              pressed && styles.pressed,
            ]}>
            <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
              <Ionicons color={theme.accent} name={section.icon} size={26} />
            </View>
            <View style={styles.text}>
              <Text style={[styles.title, { color: theme.text }]}>{t(section.title)}</Text>
              <Text style={[styles.detail, { color: theme.textMuted }]}>{t(section.detail)}</Text>
            </View>
            <Ionicons color={theme.textMuted} name="chevron-forward" size={22} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
    <View style={styles.bottom}>
      {soon && (
        <Text accessibilityLiveRegion="polite" style={[styles.message, { color: theme.textMuted }]}>
          {soon === 'eat'
            ? t('Eat is coming soon. Nutrition tracking will be added in a later version.')
            : t('Challenges are coming in a later version: pick a workout you did and challenge a friend to beat it.')}
        </Text>
      )}
      <TabBar current="analyse" onSoon={setSoon} />
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, flexGrow: 1 },
  bottom: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 14, gap: 10 },
  message: { fontSize: 14, textAlign: 'center' },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 14 },
  card: { borderWidth: 1, borderRadius: 22, padding: 18, flexDirection: 'row', gap: 16, alignItems: 'center' },
  text: { flex: 1, minWidth: 0, gap: 6 },
  title: { fontSize: 19, fontFamily: FONT.display },
  detail: { fontSize: 15, lineHeight: 21 },
  pressed: { opacity: 0.8 },
});
