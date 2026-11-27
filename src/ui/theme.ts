// The app's look (1.4.0, design option D): dark only, one lime accent, and "milky" glass tiles.
// Every screen takes its colours from here, so the whole app follows one change.
// Design canvas: https://claude.ai/artifact/MiQ1ZUC1waYJpFzef6hUi5

const dark = {
  background: '#0B0D0B',
  // Milky glass tiles: a see-through white over the dark background.
  surface: 'rgba(255, 255, 255, 0.07)',
  surfaceStrong: 'rgba(255, 255, 255, 0.12)',
  // Menus and pop-ups drawn over a screen need a solid colour, or the screen shows through.
  panel: '#16191C',
  border: 'rgba(255, 255, 255, 0.12)',
  text: '#F3F5F8',
  textMuted: '#A7AFBC',
  accent: '#C6F432',
  accentSoft: 'rgba(198, 244, 50, 0.14)',
  onAccent: '#101405',
  ripple: 'rgba(255, 255, 255, 0.14)',
  danger: '#FF8A7A',
  onDanger: '#2A0B06',
  // Analyse shares the accent; Eat and the other "coming soon" parts are dimmed glass.
  analyse: '#C6F432',
  onAnalyse: '#101405',
  eat: 'rgba(255, 255, 255, 0.07)',
  onEat: '#A7AFBC',
  overlay: 'rgba(0, 0, 0, 0.6)',
  // Body heat map (requirement 19b), from neglected to overtrained; each step also differs in lightness.
  heatNeglected: '#6A737D',
  heatMaintaining: '#8AA63A',
  heatGrowing: '#C6F432',
  heatOvertrained: '#F06A4F',
  bodyNeutral: '#4A525B',
  // Recovery colours (fresh, recovering, trained yesterday).
  recovering: '#E8B04A',
  // The soft glow behind key screens.
  glow: '#C6F432',
};

export type Theme = typeof dark;

// Fonts: Space Grotesk for headings and big numbers, the phone's own font for text.
export const FONT = {
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_600SemiBold',
};

// 1.4.0 is dark only (decided 2026-11-27); a light version of the design is kept on the canvas.
export function useTheme(): Theme {
  return dark;
}
