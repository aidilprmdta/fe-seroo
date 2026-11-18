// ScreenFrame — wrapper dengan safe-area adaptif (status bar / notch / gesture bar)
import React from 'react';
import { View, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export default function ScreenFrame({ children, style, backgroundColor, edges = ['top', 'bottom'] }) {
  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: backgroundColor || colors.light.background }, style]}
      edges={edges}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.light.background} />
      <View style={styles.container}>{children}</View>
    </SafeAreaView>
  );
}

const styles = {
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
};
