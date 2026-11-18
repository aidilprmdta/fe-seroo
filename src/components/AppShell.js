// AppShell — navigasi & header sesuai Figma: bottom nav (HP) / sidebar (Tablet)
import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenFrame from './ScreenFrame';
import AccountActions from './AccountActions';
import { colors, spacing, typography, radii } from '../theme/tokens';

export const NAV = {
  crew: {
    phone: [
      { key: 'beranda', label: 'Beranda', icon: '⌂', route: '/crew' },
      { key: 'menu', label: 'Menu', icon: '▦', route: '/crew/pos' },
      { key: 'pesanan', label: 'Pesanan', icon: '≡', route: '/crew/orders' },
      { key: 'stok', label: 'Stok', icon: '○', route: '/stock-requests' },
      { key: 'waste', label: 'Waste', icon: '!', route: '/waste' },
    ],
    tablet: [
      { key: 'beranda', label: 'Beranda', icon: '⌂', route: '/crew' },
      { key: 'menu', label: 'Kasir', icon: '▦', route: '/crew/pos' },
      { key: 'pesanan', label: 'Pesanan Saya', icon: '≡', route: '/crew/orders' },
      { key: 'stok', label: 'Status Stok', icon: '○', route: '/inventory' },
      { key: 'waste', label: 'Waste & Kehilangan', icon: '!', route: '/waste' },
      { key: 'permintaan', label: 'Permintaan Stok', icon: '↗', route: '/stock-requests' },
      { key: 'profil', label: 'Profil', icon: '◉', route: '/profile' },
    ],
  },
  manager: {
    phone: [
      { key: 'beranda', label: 'Beranda', icon: '⌂', route: '/manager/dashboard' },
      { key: 'stok', label: 'Stok', icon: '▦', route: '/inventory' },
      { key: 'biaya', label: 'Biaya', icon: 'Rp', route: '/expenses' },
      { key: 'closing', label: 'Closing', icon: '✓', route: '/closings' },
      { key: 'laporan', label: 'Laporan', icon: '≡', route: '/reports' },
      { key: 'waste', label: 'Waste', icon: '!', route: '/waste' },
    ],
    tablet: [
      { key: 'beranda', label: 'Beranda', icon: '⌂', route: '/manager/dashboard' },
      { key: 'menu', label: 'Menu outlet', icon: '▦', route: '/admin/catalog' },
      { key: 'stok', label: 'Inventaris', icon: '○', route: '/inventory' },
      { key: 'waste', label: 'Waste / kehilangan', icon: '!', route: '/waste' },
      { key: 'biaya', label: 'Pengeluaran', icon: 'Rp', route: '/expenses' },
      { key: 'closing', label: 'Closing', icon: '✓', route: '/closings' },
      { key: 'laporan', label: 'Laporan', icon: '≡', route: '/reports' },
      { key: 'permintaan', label: 'Permintaan stok', icon: '↗', route: '/stock-requests' },
      { key: 'profil', label: 'Profil', icon: '◉', route: '/profile' },
    ],
  },
  ownerMitra: {
    phone: [
      { key: 'ringkasan', label: 'Ringkasan', icon: '⌂', route: '/owner/dashboard' },
      { key: 'laporan', label: 'Laporan', icon: '≡', route: '/reports' },
      { key: 'stok', label: 'Stok', icon: '▦', route: '/inventory' },
      { key: 'closing', label: 'Closing', icon: '✓', route: '/closings' },
      { key: 'waste', label: 'Waste', icon: '!', route: '/waste' },
    ],
    tablet: [
      { key: 'ringkasan', label: 'Ringkasan', icon: '⌂', route: '/owner/dashboard' },
      { key: 'outlet', label: 'Outlet saya', icon: '⌖', route: '/owner/outlet-members' },
      { key: 'laporan', label: 'Laporan keuangan', icon: '≡', route: '/reports' },
      { key: 'stok', label: 'Persediaan', icon: '▦', route: '/inventory' },
      { key: 'waste', label: 'Waste / kehilangan', icon: '!', route: '/waste' },
      { key: 'closing', label: 'Closing & ekspor', icon: '✓', route: '/closings' },
      { key: 'profil', label: 'Profil', icon: '◉', route: '/profile' },
    ],
  },
  ownerPusat: {
    phone: [
      { key: 'ringkasan', label: 'Ringkasan', icon: '⌂', route: '/admin/dashboard' },
      { key: 'menu', label: 'Master Menu', icon: '▦', route: '/admin/catalog' },
      { key: 'akun', label: 'Akun', icon: '♙', route: '/admin/accounts' },
      { key: 'outlet', label: 'Outlet', icon: '⌖', route: '/admin/outlets' },
      { key: 'keamanan', label: 'Keamanan', icon: '○', route: '/admin/audit' },
    ],
    tablet: [
      { key: 'ringkasan', label: 'Ringkasan', icon: '⌂', route: '/admin/dashboard' },
      { key: 'menu', label: 'Master menu', icon: '▦', route: '/admin/catalog' },
      { key: 'harga', label: 'Harga', icon: 'Rp', route: '/admin/catalog' },
      { key: 'akun', label: 'Manajemen akun', icon: '♙', route: '/admin/accounts' },
      { key: 'outlet', label: 'Outlet & membership', icon: '⌖', route: '/admin/outlets' },
      { key: 'keamanan', label: 'Keamanan akun', icon: '○', route: '/admin/audit' },
      { key: 'profil', label: 'Profil', icon: '◉', route: '/profile' },
    ],
  },
};

export default function AppShell({
  navRole,
  active,
  title,
  subtitle,
  roleLabel,
  outletLabel = 'Outlet',
  scopeLabel,
  children,
  contentStyle,
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const items = NAV[navRole]?.[isTablet ? 'tablet' : 'phone'] || [];

  const renderNavItem = (item, tablet = false) => {
    const isActive = item.key === active;
    if (tablet) {
      return (
        <TouchableOpacity
          key={item.key}
          style={[styles.tabletNavItem, isActive && styles.tabletNavActive]}
          onPress={() => router.push(item.route)}
        >
          <View style={[styles.navDot, isActive && styles.navDotActive]} />
          <Text style={[styles.tabletNavText, isActive && styles.navTextActive]}>
            {item.label}
          </Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        key={item.key}
        style={[styles.navItem, isActive && styles.navActive]}
        onPress={() => router.push(item.route)}
      >
        <Text style={[styles.navIcon, isActive && styles.navTextActive]}>{item.icon}</Text>
        <Text style={[styles.navLabel, isActive && styles.navTextActive]}>{item.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenFrame>
      {isTablet ? (
        <View style={styles.tabletRow}>
          <View style={[styles.sidebar, { width: Math.min(222, width * 0.2) }]}>
            <Text style={styles.tabletWordmark}>seroo</Text>
            <Text style={styles.tabletRole}>{roleLabel || navRole?.toUpperCase()}</Text>

            <View style={styles.tabletNav}>{items.map((item) => renderNavItem(item, true))}</View>

            <View style={styles.sidebarProfile}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(roleLabel || 'SR').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{roleLabel || 'Seroo'}</Text>
                <Text style={styles.profileOutlet}>{outletLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.tabletMain}>
            <View style={styles.topbar}>
              <Text style={styles.breadcrumb}>
                {(roleLabel || 'Seroo').toLowerCase()}  /  {title || 'Beranda'}
              </Text>
              <View style={styles.outletBadge}>
                <Text style={styles.outletBadgeText}>{outletLabel}</Text>
              </View>
            </View>

            <ScrollView
              style={styles.tabletScroll}
              contentContainerStyle={[styles.tabletContent, contentStyle]}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.tabletTitle}>{title}</Text>
              {subtitle ? <Text style={styles.tabletSubtitle}>{subtitle}</Text> : null}
              {children}
              <View style={{ height: spacing.xl }} />
              <AccountActions />
            </ScrollView>
          </View>
        </View>
      ) : (
        <View style={styles.phoneRoot}>
          <ScrollView
            style={styles.phoneScroll}
            contentContainerStyle={[styles.phoneContent, contentStyle]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.phoneHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.phoneWordmark}>Seroo.</Text>
                <Text style={styles.phoneRole}>{roleLabel || navRole?.toUpperCase()}</Text>
              </View>
              <View style={styles.phoneScope}>
                <Text style={styles.phoneScopeText}>{scopeLabel || outletLabel}</Text>
              </View>
            </View>

            <Text style={styles.phoneTitle}>{title}</Text>
            {subtitle ? <Text style={styles.phoneSubtitle}>{subtitle}</Text> : null}

            {children}
            <View style={{ height: spacing.lg }} />
            <AccountActions />
          </ScrollView>

          <View style={styles.bottomNav}>{items.map((item) => renderNavItem(item))}</View>
        </View>
      )}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  phoneRoot: { flex: 1, backgroundColor: colors.light.background },
  phoneScroll: { flex: 1 },
  phoneContent: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 90 },
  phoneHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  phoneWordmark: {
    ...typography.fontFamily.display,
    fontSize: 25,
    color: colors.light.primary,
  },
  phoneRole: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 9,
    color: colors.light.textSecondary,
    marginTop: spacing.xs,
  },
  phoneScope: {
    backgroundColor: colors.light.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: 130,
  },
  phoneScopeText: {
    ...typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 10,
    color: colors.light.maroon,
    textAlign: 'center',
  },
  phoneTitle: {
    ...typography.fontFamily.display,
    fontSize: 25,
    color: colors.light.textPrimary,
    marginBottom: spacing.xs,
  },
  phoneSubtitle: {
    ...typography.fontFamily.regular,
    fontSize: 10,
    color: colors.light.textSecondary,
    marginBottom: spacing.lg,
  },
  bottomNav: {
    position: 'absolute',
    left: 9,
    right: 9,
    bottom: 8,
    height: 58,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    justifyContent: 'space-between',
  },
  navItem: {
    flex: 1,
    height: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  navActive: { backgroundColor: colors.light.surfaceMuted },
  navIcon: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 13,
    color: colors.light.textSecondary,
  },
  navLabel: {
    ...typography.fontFamily.medium,
    fontSize: 9,
    color: colors.light.textSecondary,
  },
  navTextActive: { color: colors.light.primary },

  tabletRow: { flex: 1, flexDirection: 'row', backgroundColor: colors.light.background },
  sidebar: {
    backgroundColor: colors.light.surface,
    borderRightWidth: 1,
    borderRightColor: colors.light.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  tabletWordmark: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 28,
    color: colors.light.primary,
  },
  tabletRole: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 10,
    color: colors.light.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  tabletNav: { gap: spacing.xs },
  tabletNavItem: {
    height: 42,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  tabletNavActive: { backgroundColor: colors.light.surfaceMuted },
  navDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.light.border },
  navDotActive: { backgroundColor: colors.light.primary },
  tabletNavText: {
    ...typography.fontFamily.medium,
    fontSize: 13,
    color: colors.light.textPrimary,
  },
  sidebarProfile: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.light.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 12,
    color: colors.light.primary,
  },
  profileName: {
    ...typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 12,
    color: colors.light.textPrimary,
  },
  profileOutlet: {
    ...typography.fontFamily.regular,
    fontSize: 10,
    color: colors.light.textSecondary,
  },
  tabletMain: { flex: 1 },
  topbar: {
    height: 70,
    backgroundColor: colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  breadcrumb: {
    ...typography.fontFamily.medium,
    fontSize: 13,
    color: colors.light.textSecondary,
  },
  outletBadge: {
    backgroundColor: colors.light.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  outletBadgeText: {
    ...typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 11,
    color: colors.light.maroon,
  },
  tabletScroll: { flex: 1 },
  tabletContent: { padding: spacing.xl, paddingBottom: spacing.xxl },
  tabletTitle: {
    ...typography.fontFamily.display,
    fontSize: 30,
    color: colors.light.textPrimary,
    marginBottom: spacing.xs,
  },
  tabletSubtitle: {
    ...typography.fontFamily.regular,
    fontSize: 13,
    color: colors.light.textSecondary,
    marginBottom: spacing.xl,
  },
});
