// BrandLogo — logo resmi Seroo dari Figma (lingkaran merah + wordmark)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../theme/tokens';

export default function BrandLogo({ size = 82 }) {
  return (
    <View style={[styles.logo, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.above, { fontSize: size * 0.16, lineHeight: size * 0.22 }]}>Teh Tarik</Text>
      <Text style={[styles.wordmark, { fontSize: size * 0.32, lineHeight: size * 0.43 }]}>Seroo.</Text>
      <Text style={[styles.authentic, { fontSize: Math.max(5, size * 0.06), lineHeight: size * 0.22 }]}>
        A U T H E N T I C
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    backgroundColor: colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  above: {
    ...typography.fontFamily.displayItalic,
    color: colors.light.goldBorder,
    fontStyle: 'italic',
  },
  wordmark: {
    ...typography.fontFamily.display,
    color: colors.light.goldBorder,
  },
  authentic: {
    ...typography.fontFamily.regular,
    color: colors.light.goldBorder,
    letterSpacing: 1,
  },
});
