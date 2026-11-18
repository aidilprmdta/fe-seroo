// ActivityNav — bottom nav reference Figma 171:294 / 171:206 (Aktivitas aktif)
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../auth/AuthContext';
import { colors, spacing, typography, radii } from '../theme/tokens';

function routesForRole(role) {
  if (role === 'ADMIN_PUSAT') {
    return { home: '/admin/dashboard', menu: '/admin/catalog' };
  }
  if (role === 'OWNER_MITRA' || role === 'OWNER') {
    return { home: '/owner/dashboard', menu: '/reports' };
  }
  if (role === 'MANAGER') {
    return { home: '/manager/dashboard', menu: '/inventory' };
  }
  return { home: '/crew', menu: '/crew/pos' };
}

export default function ActivityNav() {
  const router = useRouter();
  const { user, selection } = useAuth();
  const role = user?.memberships?.find((m) => m.outletId === selection.activeOutletId)?.role;
  const routes = routesForRole(role);

  const items = [
    { key: 'beranda', label: 'Beranda', icon: '⌂', route: routes.home },
    { key: 'menu', label: 'Menu', icon: '▦', route: routes.menu },
    { key: 'aktivitas', label: 'Aktivitas', icon: '≡', route: '/notifications' },
    { key: 'profil', label: 'Profil', icon: '○', route: '/profile' },
  ];

  return (
    <View style={styles.nav}>
      {items.map((item) => {
        const active = item.key === 'aktivitas';
        return (
          <TouchableOpacity key={item.key} style={styles.item} onPress={() => router.push(item.route)}>
            <Text style={[styles.icon, active && styles.active]}>{item.icon}</Text>
            <Text style={[styles.label, active && styles.active]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    height: 64,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    backgroundColor: colors.light.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  icon: {
    ...typography.fontFamily.bold,
    fontWeight: typography.weights.bold,
    fontSize: 15,
    color: colors.light.textSecondary,
  },
  label: {
    ...typography.fontFamily.medium,
    fontSize: 9,
    color: colors.light.textSecondary,
  },
  active: { color: colors.light.primary },
});
