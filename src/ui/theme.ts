import { useColorScheme } from 'react-native';

const light = {
  background: '#F5F6F4',
  surface: '#FFFFFF',
  border: '#DADDD8',
  text: '#171A17',
  textMuted: '#5C635C',
  accent: '#1F6F4A',
  accentSoft: '#E1F0E7',
  onAccent: '#FFFFFF',
  ripple: 'rgba(23, 26, 23, 0.12)',
  danger: '#B3261E',
  onDanger: '#FFFFFF',
  // The start screen's sections: Workout uses accent (green), Analyse blue, Eat grey.
  analyse: '#1F5FA8',
  onAnalyse: '#FFFFFF',
  eat: '#6B716B',
  onEat: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.25)',
  // Body heat map (requirement 19b), from neglected to possibly overtrained. Each step is also
  // darker than the last, so the order reads without telling the hues apart.
  heatNeglected: '#D5DAD4',
  heatMaintaining: '#5DBE85',
  heatGrowing: '#2F6FC4',
  heatOvertrained: '#5A2595',
  bodyNeutral: '#ECEEEA',
};

const dark: typeof light = {
  background: '#111311',
  surface: '#1C1F1C',
  border: '#343934',
  text: '#F0F2EF',
  textMuted: '#A3ABA3',
  accent: '#5CC895',
  accentSoft: '#183A29',
  onAccent: '#0B1F15',
  ripple: 'rgba(240, 242, 239, 0.16)',
  danger: '#F2B8B5',
  onDanger: '#3D0B08',
  analyse: '#8AB8F2',
  onAnalyse: '#0A1B2E',
  eat: '#3E443E',
  onEat: '#E4E8E3',
  overlay: 'rgba(0, 0, 0, 0.5)',
  // In dark mode more training is brighter.
  heatNeglected: '#363C36',
  heatMaintaining: '#3E9A66',
  heatGrowing: '#5C9CEB',
  heatOvertrained: '#D2B0FA',
  bodyNeutral: '#262A26',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
