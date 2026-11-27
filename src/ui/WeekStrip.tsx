import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import type { WeekDay } from '@/domain/week';

import { FONT, useTheme } from './theme';

// The week of design D, Sunday to Saturday: trained days with a tick and the workout's type, rest
// days with a moon, today outlined, and the days still to come faded.
export function WeekStrip({ days }: { days: WeekDay[] }) {
  const theme = useTheme();
  return (
    <View accessibilityLabel="This week, day by day" style={styles.row}>
      {days.map((day) => {
        const future = day.state === 'open' && !day.isToday;
        const label =
          day.state === 'trained'
            ? `${day.name}: ${day.type ?? 'trained'}`
            : day.state === 'rest'
              ? `${day.name}: rest day`
              : day.isToday
                ? 'Today: not trained yet'
                : `${day.name}: still to come`;
        return (
          <View
            key={day.name}
            accessibilityLabel={label}
            accessible
            style={[
              styles.day,
              day.state === 'trained' && { backgroundColor: theme.surface },
              day.isToday && { borderColor: theme.accent, backgroundColor: theme.surfaceStrong },
              future && styles.faded,
            ]}>
            <Text style={[styles.name, { color: day.isToday ? theme.accent : theme.textMuted }]}>
              {day.isToday ? 'Today' : day.name}
            </Text>
            <Text style={[styles.date, { color: day.state === 'trained' || day.isToday ? theme.text : theme.textMuted }]}>
              {day.date.getDate()}
            </Text>
            {day.state === 'trained' ? (
              <View style={[styles.dot, { backgroundColor: theme.accent }]}>
                <Ionicons color={theme.onAccent} name="checkmark" size={16} />
              </View>
            ) : day.state === 'rest' ? (
              <View style={[styles.dot, styles.ring, { borderColor: theme.border }]}>
                <Ionicons color={theme.textMuted} name="moon-outline" size={13} />
              </View>
            ) : day.isToday ? (
              <View style={[styles.dot, styles.ring, styles.dashed, { borderColor: theme.accent }]}>
                <Ionicons color={theme.accent} name="add" size={15} />
              </View>
            ) : (
              <View style={[styles.dot, styles.ring, styles.dotted, { borderColor: theme.border }]} />
            )}
            <Text numberOfLines={1} style={[styles.type, { color: day.state === 'trained' ? theme.text : day.isToday ? theme.accent : theme.textMuted }]}>
              {day.state === 'trained' ? day.type : day.state === 'rest' ? 'Rest' : day.isToday ? 'Train?' : '—'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5 },
  day: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  faded: { opacity: 0.55 },
  name: { fontSize: 11, fontWeight: '600' },
  date: { fontSize: 17, fontFamily: FONT.display },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  ring: { borderWidth: 1.5 },
  dashed: { borderStyle: 'dashed' },
  dotted: { borderStyle: 'dotted' },
  type: { fontSize: 10, fontWeight: '600' },
});
