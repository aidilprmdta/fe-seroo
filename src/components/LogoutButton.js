// LogoutButton — logout action
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radii } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';

export default function LogoutButton() {
  const { logout } = useAuth();

  return (
    <TouchableOpacity
      style={[styles.button, styles.logout]}
      onPress={logout}
      activeOpacity={0.7}
      accessibilityLabel="Logout"
    >
      <Text style={styles.label}>Logout</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: spacing.md,
    borderRadius: radii.md,
  },
  logout: {
    backgroundColor: colors.light.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  label: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.textSecondary,
  },
});
