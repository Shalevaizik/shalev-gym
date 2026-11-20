import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IconName } from './Button';
import { useTheme } from './theme';

type Props = {
  label: string;
  detail: string;
  icon: IconName;
  background: string;
  foreground: string;
  onPress: () => void;
  badge?: string;
};

// One of the large, coloured buttons on the start screen (requirement 18).
export function SectionButton({ label, detail, icon, background, foreground, onPress, badge }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.clip}>
      <Pressable
        accessibilityHint={detail}
        accessibilityLabel={badge ? `${label}, ${badge}` : label}
        accessibilityRole="button"
        android_ripple={{ color: theme.ripple }}
        onPress={onPress}
        style={({ pressed }) => [styles.button, { backgroundColor: background }, pressed && styles.pressed]}>
        <Ionicons color={foreground} name={icon} size={34} />
        <View style={styles.text}>
          <View style={styles.titleRow}>
            <Text numberOfLines={2} style={[styles.label, { color: foreground }]}>
              {label}
            </Text>
            {badge && (
              <View style={[styles.badge, { borderColor: foreground }]}>
                <Text style={[styles.badgeText, { color: foreground }]}>{badge}</Text>
              </View>
            )}
          </View>
          <Text numberOfLines={2} style={[styles.detail, { color: foreground }]}>
            {detail}
          </Text>
        </View>
        <Ionicons color={foreground} name="chevron-forward" size={22} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { borderRadius: 20, overflow: 'hidden' },
  button: {
    minHeight: 112,
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  text: { flex: 1, minWidth: 0, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  label: { fontSize: 24, fontWeight: '800', flexShrink: 1 },
  detail: { fontSize: 15, opacity: 0.92 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.88 },
});
