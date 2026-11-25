// AdminDashboardScreen — Figma 01 · Owner Pusat Ringkasan (HP & Tablet)
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import { ROUTES } from '../../src/auth/routePolicy';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import AppShell from '../../src/components/AppShell';

const TASKS = [
  { icon: '▦', title: 'Master menu', desc: 'Produk dan ukuran', route: ROUTES.adminCatalog },
  { icon: 'Rp', title: 'Harga menu', desc: 'Berlaku dari pusat', route: ROUTES.adminCatalog },
  { icon: '♙', title: 'Manajemen akun', desc: 'Role dan membership', route: ROUTES.adminAccounts },
  { icon: '⌖', title: 'Penugasan outlet', desc: 'Owner Mitra, Manager, Crew', route: ROUTES.adminOutlets },
];

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <AppShell
      navRole="ownerPusat"
      active="ringkasan"
      title="Pengelolaan pusat"
      subtitle="Kelola master produk, harga, akun, dan penugasan outlet."
      roleLabel="OWNER PUSAT"
      outletLabel="AKSES GLOBAL"
      scopeLabel="AKSES GLOBAL"
    >
      <View style={styles.taskCard}>
        <Text style={styles.taskCardTitle}>Tugas pengelolaan</Text>
        {TASKS.map((task, index) => (
          <React.Fragment key={task.title}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <TouchableOpacity style={styles.taskRow} onPress={() => router.push(task.route)}>
              <View style={styles.taskIcon}>
                <Text style={styles.taskIconText}>{task.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskDesc}>{task.desc}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>

      <View style={styles.boundaryCard}>
        <Text style={styles.boundaryTitle}>Batas akses data keuangan</Text>
        <Text style={styles.boundaryText}>
          Halaman ini untuk administrasi brand. Laporan keuangan outlet tetap mengikuti hak
          akses Owner Mitra terhadap outlet miliknya, bukan agregat seluruh jaringan.
        </Text>
      </View>

      <View style={styles.privilegeBadge}>
        <Text style={styles.privilegeText}>MASTER & AKUN</Text>
      </View>

      <TouchableOpacity onPress={() => router.push(ROUTES.adminAudit)}>
        <Text style={styles.auditLink}>Riwayat aktivitas →</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Halo, {user?.name || 'Administrator'}</Text>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  taskCard: {
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  taskCardTitle: {
    ...typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 15,
    color: colors.light.textPrimary,
    marginBottom: spacing.sm,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  taskIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.light.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskIconText: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 12,
    color: colors.light.primary,
  },
  taskTitle: {
    ...typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 12,
    color: colors.light.textPrimary,
  },
  taskDesc: {
    ...typography.fontFamily.regular,
    fontSize: 10,
    color: colors.light.textSecondary,
  },
  arrow: { fontSize: 18, color: colors.light.primary },
  divider: { height: 1, backgroundColor: colors.light.border },
  boundaryCard: {
    backgroundColor: colors.light.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  boundaryTitle: {
    ...typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 14,
    color: colors.light.maroon,
  },
  boundaryText: {
    ...typography.fontFamily.regular,
    fontSize: 10,
    lineHeight: 15,
    color: colors.light.textPrimary,
  },
  privilegeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.light.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.md,
  },
  privilegeText: {
    ...typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 10,
    color: colors.light.surface,
  },
  auditLink: {
    ...typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 10,
    color: colors.light.primary,
    marginTop: spacing.lg,
  },
  footer: {
    ...typography.fontFamily.regular,
    fontSize: 10,
    color: colors.light.textSecondary,
    marginTop: spacing.md,
  },
});
