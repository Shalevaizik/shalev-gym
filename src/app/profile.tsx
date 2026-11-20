import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { getProfile, saveProfile } from '@/data/profileRepo';
import {
  ageOn,
  birthDateFrom,
  cmFromFeetInches,
  feetInchesFromCm,
  toKg,
  type BodyWeightUnit,
  type HeightUnit,
  type Sex,
} from '@/domain/profile';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { useTheme } from '@/ui/theme';

const num = (text: string) => (text.trim() === '' ? NaN : Number(text.replace(',', '.')));
const show = (n: number) => String(Math.round(n * 10) / 10);

// The trainer's profile form (requirement 20), opened from the ☰ menu or the start screen.
export default function ProfileScreen() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const theme = useTheme();
  const [loaded, setLoaded] = useState(false);
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [cm, setCm] = useState('');
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<BodyWeightUnit>('kg');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getProfile(db, userId)
      .then((profile) => {
        if (cancelled) return;
        if (profile.birthDate) {
          const [y, m, d] = profile.birthDate.split('-');
          setDay(String(Number(d)));
          setMonth(String(Number(m)));
          setYear(y);
        }
        setSex(profile.sex);
        setHeightUnit(profile.heightUnit);
        if (profile.heightCm) {
          setCm(String(Math.round(profile.heightCm)));
          const imperial = feetInchesFromCm(profile.heightCm);
          setFeet(String(imperial.feet));
          setInches(String(imperial.inches));
        }
        if (profile.weight) {
          setWeight(show(profile.weight.weight));
          setWeightUnit(profile.weight.unit);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Your profile could not be loaded.');
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [db, userId]);

  // Switching units converts what is already filled in, so nothing has to be typed again.
  function switchHeight(unit: HeightUnit) {
    if (unit === heightUnit) return;
    if (unit === 'ft' && num(cm) > 0) {
      const imperial = feetInchesFromCm(num(cm));
      setFeet(String(imperial.feet));
      setInches(String(imperial.inches));
    }
    if (unit === 'cm' && num(feet) > 0) {
      setCm(String(Math.round(cmFromFeetInches(num(feet), num(inches) || 0))));
    }
    setHeightUnit(unit);
  }

  function switchWeight(unit: BodyWeightUnit) {
    if (unit === weightUnit) return;
    const value = num(weight);
    if (value > 0) setWeight(show(unit === 'kg' ? toKg(value, 'lb') : value / toKg(1, 'lb')));
    setWeightUnit(unit);
  }

  async function save() {
    if (!userId) return;
    const now = new Date();
    const birthDate = birthDateFrom(num(day), num(month), num(year), now);
    const heightCm = heightUnit === 'cm' ? num(cm) : cmFromFeetInches(num(feet), num(inches) || 0);
    const weightValue = num(weight);

    if (!birthDate) return setError('Enter a real date of birth: day, month and a 4-digit year.');
    if (!sex) return setError('Choose male or female.');
    if (!(heightCm >= 100 && heightCm <= 250)) return setError('Enter your height (between 100 and 250 cm, or 3′4″ and 8′2″).');
    const kg = toKg(weightValue, weightUnit);
    if (!(kg >= 30 && kg <= 300)) return setError('Enter your weight (between 30 and 300 kg, or 66 and 660 lb).');

    setError(null);
    setSaving(true);
    try {
      await saveProfile(
        db,
        userId,
        { birthDate, sex, heightCm, heightUnit, weight: weightValue, weightUnit },
        randomUUID(),
        now,
      );
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch {
      setError('Your profile could not be saved. Please try again.');
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const inputStyle = [styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }];
  const field = (
    label: string,
    value: string,
    onChange: (text: string) => void,
    placeholder: string,
    maxLength: number,
    decimal = false,
    accessibilityLabel = label,
  ) => (
    <View style={styles.field}>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        inputMode={decimal ? 'decimal' : 'numeric'}
        maxLength={maxLength}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        style={inputStyle}
        value={value}
      />
      <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
  const age = (() => {
    const date = birthDateFrom(num(day), num(month), num(year), new Date());
    return date ? ageOn(date, new Date()) : null;
  })();

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <Text style={[styles.label, { color: theme.text }]}>Date of birth</Text>
          <View style={styles.row}>
            {field('Day', day, setDay, 'DD', 2)}
            {field('Month', month, setMonth, 'MM', 2)}
            <View style={styles.wide}>{field('Year', year, setYear, 'YYYY', 4)}</View>
          </View>
          {age !== null && <Text style={[styles.hint, { color: theme.textMuted }]}>Age {age}</Text>}

          <Text style={[styles.label, { color: theme.text }]}>Sex</Text>
          <View style={styles.chips}>
            <Chip label="Male" onPress={() => setSex('male')} selected={sex === 'male'} />
            <Chip label="Female" onPress={() => setSex('female')} selected={sex === 'female'} />
          </View>

          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: theme.text }]}>Height</Text>
            <View style={styles.chips}>
              <Chip label="cm" onPress={() => switchHeight('cm')} selected={heightUnit === 'cm'} />
              <Chip label="ft / in" onPress={() => switchHeight('ft')} selected={heightUnit === 'ft'} />
            </View>
          </View>
          <View style={styles.row}>
            {heightUnit === 'cm' ? (
              field('cm', cm, setCm, '180', 3, false, 'Height in cm')
            ) : (
              <>
                {field('feet', feet, setFeet, '5', 1, false, 'Height, feet')}
                {field('inches', inches, setInches, '11', 2, false, 'Height, inches')}
              </>
            )}
          </View>

          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: theme.text }]}>Body weight</Text>
            <View style={styles.chips}>
              <Chip label="kg" onPress={() => switchWeight('kg')} selected={weightUnit === 'kg'} />
              <Chip label="lb" onPress={() => switchWeight('lb')} selected={weightUnit === 'lb'} />
            </View>
          </View>
          <View style={styles.row}>{field(weightUnit, weight, setWeight, weightUnit === 'kg' ? '80' : '176', 5, true, `Body weight in ${weightUnit}`)}</View>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Each weight you save is kept with its date, so older workouts use the weight you had then.
          </Text>

          {error && (
            <Text accessibilityLiveRegion="polite" style={[styles.error, { color: theme.danger }]}>
              {error}
            </Text>
          )}

          <View style={styles.save}>
            <Button busy={saving} icon="checkmark" label="Save" onPress={save} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, flexGrow: 1 },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  label: { fontSize: 17, fontWeight: '700', marginTop: 22, marginBottom: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, gap: 4 },
  wide: { flex: 1.4 },
  fieldLabel: { fontSize: 13 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 18 },
  chips: { flexDirection: 'row', gap: 8 },
  hint: { fontSize: 14, marginTop: 6, lineHeight: 20 },
  error: { fontSize: 15, marginTop: 16 },
  save: { marginTop: 26 },
});
