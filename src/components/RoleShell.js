// RoleShell — shell for role-based screens (manager, owner, crew, admin)
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { colors, spacing, typography, radii } from '../theme/tokens';
import LogoutButton from './LogoutButton';
import Notice from './Notice';
import PrimaryButton from './PrimaryButton';
import ProfileButton from './ProfileButton';
import ScreenFrame from './ScreenFrame';

export default function RoleShell({ title, subtitle, emptyState, readOnly = false, actions = [] }) {
  const { user, session, selection } = useAuth();
  const memberships = user?.memberships ?? [];
  const outlet = memberships.find(m => m.outletId === selection.activeOutletId);
  const outletLabel = outlet?.outletName ?? 'Outlet belum dipilih';

  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Seroo · {user?.role ?? ''}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>
              {user?.name} · {readOnly ? 'Akses baca saja' : user?.role}
            </Text>
          </View>
          {memberhips?.length > 1 && (
            <PrimaryButton
              label="Pilih outlet"
              secondary
              onPress={() => router.push(ROUTES.selectOutlet)}
            />
          )}
        </View>

        {/* Outlet context */}
        <View style={styles.context}>
          <Text style={styles.contextLabel}>Outlet aktif</Text>
          <Text style={styles.contextTitle}>{outletLabel}</Text>
          {outlet ? (
            <Text style={styles.contextDetail}>
              {outlet.outletCode} · {outlet.role}
            </Text>
          ) : null}
        </View>

        {/* Main content */}
        {emptyState ? (
          <View style={styles.emptyState}>
            <Text style={styles.status}>Dalam Pengembangan</Text>
            <Text style={styles.emptyTitle}>{title}</Text>
            <Text style={styles.emptyText}>{emptyState}</Text>
          </View>
        ) : null}

        {/* Actions */}
        {actions.length > 0 ? (
          <View style={styles.actions}>
            {actions.map(action => (
              <PrimaryButton
                key={action.label}
                label={action.label}
                onPress={action.onPress}
                secondary={action.secondary}
              />
            ))}
          </View>
        ) : null}

        {/* Notice */}
        <Notice message={session?.notice} type="info" />

        {/* Footer */}
        <View style={styles.footer}>
          <ProfileButton />
          <LogoutButton />
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    minWidth: 220,
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xxl,
    color: colors.light.textPrimary,
  },
  subtitle: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.base,
    color: colors.light.textSecondary,
  },
  context: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    backgroundColor: colors.light.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  contextLabel: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  contextTitle: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.lg,
    color: colors.light.textPrimary,
  },
  contextDetail: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.base,
    color: colors.light.textSecondary,
  },
  emptyState: {
    flex: 1,
    minHeight: 220,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    backgroundColor: colors.light.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  status: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  emptyTitle: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xl,
    color: colors.light.textPrimary,
  },
  emptyText: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.base,
    color: colors.light.textSecondary,
    lineHeight: 23,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
