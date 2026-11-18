// Theme provider & wrapper components
import React from 'react';
import { StyleSheet, StatusBar as RNStatusBar, SafeAreaView } from 'react-native';
import { useColorScheme } from 'react-native';
import Constants from 'expo-constants';
import { colors, spacing, typography, radii, shadows } from './tokens';

const isIos = Constants.platform === 'ios';

// Determine mode
export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { isDark, mode: isDark ? 'dark' : 'light' };
}

// Combined theme object
export const theme = {
  colors,
  spacing,
  radii,
  shadows,
  typography,
  isIos,
};

// Status bar
export function StatusBar({ style = 'light-content', ...props }) {
  return <RNStatusBar style={style} {...props} />;
}

// Safe area wrapper
export function SafeAreaWrapper({ children, style }) {
  return (
    <SafeAreaView style={[styles.safeArea, style]}>
      {children}
    </SafeAreaView>
  );
}

// Screen frame wrapper
export function ScreenFrame({ children, style, contentContainerStyle }) {
  return (
    <SafeAreaWrapper style={style}>
      <SafeAreaView
        style={[StyleSheet.absoluteFillObject, styles.absoluteFill]}
      >
        <StatusBar />
        <SafeAreaView
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: colors.light.background },
          ]}
        >
          <SafeAreaView
            style={[
              styles.frame,
              contentContainerStyle,
              { backgroundColor: colors.light.background },
            ]}
          >
            {children}
          </SafeAreaView>
        </SafeAreaView>
      </SafeAreaView>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  frame: {
    flex: 1,
  },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

// Hook for managing theme mode
export function useThemeMode() {
  const { isDark, mode } = useTheme();
  return { ...theme, isDark, mode };
}
