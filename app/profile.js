// ProfileScreen — user profile & settings
import React, { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';
import { ROUTES } from '../src/auth/routePolicy';
import { colors, spacing, typography, radii } from '../src/theme/tokens';
import Card from '../src/components/Card';
import ListItem from '../src/components/ListItem';
import BaseButton from '../src/components/BaseButton';
import ScreenFrame from '../src/components/ScreenFrame';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleChangePassword = useCallback(() => {
    router.push(ROUTES.changePassword);
  }, [router]);

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  return (
    <ScreenFrame>
      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.avatar}>
          <View style={styles.avatarContent}>
            <Text style={styles.avatarIcon}>👤</Text>
          </View>
        </Card>

        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.role}>{user?.role}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <Text style={styles.sectionTitle}>Akun</Text>
        <ListItem
          title="Ubah Password"
          subtitle="Ganti password saat ini"
          leading={<Text style={styles.icon}>🔑</Text>}
          onPress={handleChangePassword}
        />

        <Text style={styles.sectionTitle}>Outlet</Text>
        {user?.memberships?.map(m => (
          <ListItem
            key={m.outletId}
            title={m.outletName}
            subtitle={`Kode: ${m.outletCode} · ${m.role}`}
            leading={<Text style={styles.icon}>🏢</Text>}
          />
        ))}

        <Text style={styles.sectionTitle}>Aksi</Text>
        <BaseButton
          label="Logout"
          onPress={handleLogout}
          fullWidth
          variant="secondary"
          size="lg"
        />
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  avatar: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarContent: {
    width: 100,
    height: 100,
    borderRadius: radii.xxl,
    backgroundColor: colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarIcon: {
    fontSize: 40,
  },
  name: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xxl,
    color: colors.light.textPrimary,
  },
  role: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.primary,
  },
  email: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  sectionTitle: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    marginTop: spacing.lg,
  },
  icon: {
    fontSize: 20,
  },
});
