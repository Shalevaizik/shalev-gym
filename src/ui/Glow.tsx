import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { useTheme } from './theme';

type Props = { size?: number; top?: number; left?: number; opacity?: number };

// The soft lime glow behind key screens (design D). Drawn as a radial gradient, so it looks the
// same on every phone; it never takes touches.
export function Glow({ size = 380, top = 80, left = 0, opacity = 0.22 }: Props) {
  const theme = useTheme();
  return (
    <View pointerEvents="none" style={[styles.glow, { width: size, height: size, top, left }]}>
      <Svg height={size} width={size}>
        <Defs>
          <RadialGradient cx="50%" cy="50%" id="glow" r="50%">
            <Stop offset="0" stopColor={theme.glow} stopOpacity={opacity} />
            <Stop offset="1" stopColor={theme.glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} fill="url(#glow)" r={size / 2} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute' },
});
