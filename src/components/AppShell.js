// AppShell — navigasi & header sesuai Figma: bottom nav (HP) / sidebar (Tablet)
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenFrame from './ScreenFrame';
import AccountActions from './AccountActions';
import { useAuth } from '../auth/AuthContext';
import { createApiRequestWrapper } from '../api/api';
import { createNotificationsApi } from '../notifications/api';
import { colors, spacing, typography, radii } from '../theme/tokens';

export const NAV = {
  crew: {
    phone: [
      { key: 'beranda', label: 'Beranda', icon: '⌂', route: '/crew' },
      { key: 'menu', label: 'Kasir', icon: '▦', route: '/crew/pos' },
      { key: 'shopee', label: 'Shopee', icon: '🛒', route: '/crew/shopee-food' },
      { key: 'recept', label: 'Struk', icon: '🧾', route: '/crew/receipt-preview' },
      { key: 'qris', label: 'Verif QRIS', icon: '✓', route: '/crew/qris-verify' },
      { key: 'pesanan', label: 'Pesanan Saya', icon: '≡', route: '/crew/orders' },
      { key: 'stok', label: 'Stok', icon: '○', route: '/stock-requests' },
      { key: 'waste', label: 'Waste', icon: '!', route: '/waste' },
    ],
    tablet: [
      { key: 'beranda', label: 'Beranda', icon: '⌂', route: '/crew' },
      { key: 'menu', label: 'Kasir', icon: '▦', route: '/crew/pos' },
      { key: 'shopee', label: 'ShopeeFood', icon: '🛒', route: '/crew/shopee-food' },
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
      { key: 'shift', label: 'Serah Terima', icon: '↩', route: '/manager/shift-handover' },
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
  refreshControl,
  children,
  contentStyle,
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { selection, apiRequest, logout } = useAuth();
  const outletId = selection?.activeOutletId;
  const isTablet = width >= 768;
  const items = NAV[navRole]?.[isTablet ? 'tablet' : 'phone'] || [];
  const roleInitials = (roleLabel || navRole || 'SR')
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!outletId || !apiRequest) return;
    try {
      const api = createNotificationsApi({ request: createApiRequestWrapper(apiRequest) });
      const data = await api.getNotifications(outletId);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Badge hanya penambah informasi; gagal memuat tidak perlu mengganggu layar.
      setUnreadCount(0);
    }
  }, [outletId, apiRequest]);

  useEffect(() => {
    loadUnread();
  }, [loadUnread]);

  const renderBell = () => (
    <TouchableOpacity
      style={styles.bell}
      onPress={() => router.push('/notifications')}
      accessibilityLabel={`Notifikasi, ${unreadCount} perlu tindakan`}
    >
      <Text style={styles.bellIcon}>🔔</Text>
      {unreadCount > 0 && (
        <View style={styles.bellBadge}>
          <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const handleLogout = () => {
    Alert.alert('Keluar dari Seroo?', 'Anda akan diminta login kembali.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => logout() },
    ]);
  };

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
          <Text style={[styles.tabletNavText, isActive && styles.tabletNavTextActive]}>
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
          <View style={[styles.sidebar, { width: Math.min(240, width * 0.2) }]}>
            <View style={styles.tabletSidebarHeader}>
              <Text style={styles.tabletWordmark}>Seroo.</Text>
              <Text style={styles.tabletRole}>{roleLabel || navRole?.toUpperCase()}</Text>
            </View>

            <View style={styles.tabletNav}>
              <Text style={styles.tabletNavSection}>MENU UTAMA</Text>
              {items.map((item) => renderNavItem(item, true))}
            </View>

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
            <View style={styles.sidebarFooter}>
              <TouchableOpacity onPress={() => router.push('/profile')}>
                <Text style={styles.sidebarFooterLink}>Akun</Text>
              </TouchableOpacity>
              <Text style={styles.sidebarFooterDot}>·</Text>
              <TouchableOpacity onPress={handleLogout}>
                <Text style={styles.sidebarFooterLink}>Keluar</Text>
              </TouchableOpacity>
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
              {renderBell()}
            </View>

            <ScrollView
              style={styles.tabletScroll}
              contentContainerStyle={[styles.tabletContent, contentStyle]}
              showsVerticalScrollIndicator={false}
              refreshControl={refreshControl}
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
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
          >
            <View style={styles.phoneHeader}>
              <View style={styles.phoneBrand}>
                <Text style={styles.phoneBrandTop}>Teh Tarik</Text>
                <Text style={styles.phoneWordmark}>Seroo.</Text>
                <Text style={styles.phoneAuthentic}>AUTHENTIC</Text>
                <Text style={styles.phoneRole}>{roleLabel || navRole?.toUpperCase()}</Text>
              </View>
              <View style={styles.phoneHeaderActions}>
                {renderBell()}
                <View style={styles.phoneScope}>
                  <Text style={styles.phoneScopeText} numberOfLines={1}>
                    {scopeLabel || outletLabel}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.phoneAvatar}
                  onPress={() => router.push('/profile')}
                  accessibilityLabel="Buka profil"
                >
                  <Text style={styles.phoneAvatarText}>{roleInitials}</Text>
                </TouchableOpacity>
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
  bell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  bellIcon: { fontSize: 15 },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.light.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 8,
    color: colors.light.surface,
  },
  phoneRoot: { flex: 1, backgroundColor: colors.light.background },
  phoneScroll: { flex: 1 },
  phoneContent: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 90 },
  phoneHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  phoneBrand: { flex: 1 },
  phoneBrandTop: {
    ...typography.fontFamily.displayItalic,
    fontSize: 11,
    color: colors.light.primary,
  },
  phoneWordmark: {
    ...typography.fontFamily.display,
    fontSize: 24,
    lineHeight: 26,
    color: colors.light.primary,
  },
  phoneAuthentic: {
    ...typography.fontFamily.regular,
    fontSize: 6,
    letterSpacing: 1.6,
    color: colors.light.textSecondary,
    marginTop: 1,
  },
  phoneHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  phoneAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneAvatarText: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 10,
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
    flexShrink: 1,
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
    fontSize: 12,
    lineHeight: 18,
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
    backgroundColor: colors.light.maroon,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.12)',
  },
  tabletSidebarHeader: {
    backgroundColor: colors.light.surface,
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
    marginTop: spacing.xs,
  },
  tabletNav: { flex: 1, gap: spacing.xs, paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  tabletNavSection: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.light.goldBorder,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  tabletNavItem: {
    height: 42,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  tabletNavActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  navDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.35)' },
  navDotActive: { backgroundColor: colors.light.goldBorder },
  tabletNavText: {
    ...typography.fontFamily.medium,
    fontSize: 13,
    color: colors.light.surface,
  },
  tabletNavTextActive: { color: colors.light.goldBorder },
  sidebarProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: radii.md,
    padding: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 12,
    color: colors.light.surface,
  },
  profileName: {
    ...typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 12,
    color: colors.light.surface,
  },
  profileOutlet: {
    ...typography.fontFamily.regular,
    fontSize: 10,
    color: colors.light.goldBorder,
  },
  sidebarFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  sidebarFooterLink: {
    ...typography.fontFamily.semibold,
    fontWeight: typography.weights.semibold,
    fontSize: 11,
    color: colors.light.goldBorder,
  },
  sidebarFooterDot: {
    fontSize: 11,
    color: colors.light.goldBorder,
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
