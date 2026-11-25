// NotificationsScreen — Figma 171:294 · Inbox & Notifikasi (data nyata dari backend)
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useAuth } from '../src/auth/AuthContext';
import { createApiRequestWrapper } from '../src/api/api';
import { createNotificationsApi } from '../src/notifications/api';
import ScreenFrame from '../src/components/ScreenFrame';
import ActivityNav from '../src/components/ActivityNav';
import Notice from '../src/components/Notice';
import { colors, spacing, typography, radii } from '../src/theme/tokens';

const FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'STOCK', label: 'Stok' },
  { key: 'WASTE', label: 'Waste' },
  { key: 'LOSS_REPORT', label: 'Kehilangan' },
  { key: 'QRIS_PENDING', label: 'QRIS' },
];

const TYPE_LABEL = {
  STOCK: 'PERSEDIAAN',
  WASTE: 'OPERASIONAL',
  LOSS_REPORT: 'KEHILANGAN',
  QRIS_PENDING: 'PEMBAYARAN',
};

const SEVERITY_COLOR = {
  CRITICAL: colors.light.danger,
  WARNING: colors.light.maroon,
  INFO: colors.light.textSecondary,
};

function formatTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationsScreen() {
  const { user, selection, apiRequest } = useAuth();
  const outletId = selection?.activeOutletId;
  const role = user?.memberships?.find((m) => m.outletId === outletId)?.role || selection?.activeRole;
  const roleLabel = role === 'ADMIN_PUSAT' ? 'OWNER PUSAT'
    : role === 'OWNER_MITRA' || role === 'OWNER' ? 'OWNER MITRA'
    : role === 'MANAGER' ? 'MANAGER' : 'CREW OUTLET';

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ count: 0, unreadCount: 0 });
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadNotifications = useCallback(async () => {
    if (!outletId) {
      setError('Pilih outlet aktif terlebih dahulu.');
      setLoading(false);
      return;
    }
    try {
      const api = createNotificationsApi({ request: createApiRequestWrapper(apiRequest) });
      const data = await api.getNotifications(outletId);
      setItems(data.notifications);
      setSummary({ count: data.count, unreadCount: data.unreadCount });
      setError(null);
    } catch (err) {
      setError(err?.message || 'Notifikasi gagal dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [outletId, apiRequest]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  const visibleItems = filter === 'all' ? items : items.filter((item) => item.type === filter);

  return (
    <ScreenFrame>
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.brandRow}>
            <Text style={styles.brand}>Seroo.</Text>
            <Text style={styles.role}>{roleLabel}</Text>
          </View>
          <Text style={styles.scope}>Konten mengikuti role dan outlet aktif</Text>
          <View style={styles.divider} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>Notifikasi</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{summary.unreadCount} PERLU TINDAKAN</Text>
            </View>
          </View>

          <View style={styles.chips}>
            {FILTERS.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.chip, filter === item.key && styles.chipActive]}
                onPress={() => setFilter(item.key)}
              >
                <Text style={[styles.chipText, filter === item.key && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {error ? (
            <Notice message={error} type="error" />
          ) : loading ? (
            <Text style={styles.emptyText}>Memuat notifikasi...</Text>
          ) : visibleItems.length === 0 ? (
            <Text style={styles.emptyText}>
              {filter === 'all'
                ? 'Tidak ada notifikasi untuk outlet ini.'
                : 'Tidak ada notifikasi pada kategori ini.'}
            </Text>
          ) : (
            visibleItems.map((item) => (
              <View key={item.id} style={styles.card}>
                <Text style={[styles.cardTag, { color: SEVERITY_COLOR[item.severity] || colors.light.maroon }]}>
                  {TYPE_LABEL[item.type] || item.type}
                </Text>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBody}>{item.body}</Text>
                <Text style={styles.cardTime}>{formatTime(item.createdAt)}</Text>
              </View>
            ))
          )}

          <Text style={styles.footer}>Notifikasi dibatasi oleh role dan outlet pengguna.</Text>
        </ScrollView>
        <ActivityNav />
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xl },
  brandRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  brand: { ...typography.fontFamily.display, fontSize: 28, color: colors.light.primary },
  role: { ...typography.fontFamily.bold, fontWeight: typography.weights.bold, fontSize: 9, color: colors.light.textSecondary, marginBottom: spacing.sm },
  scope: { ...typography.fontFamily.medium, fontSize: 10, color: colors.light.maroon, marginTop: spacing.sm },
  divider: { height: 1, backgroundColor: colors.light.border, marginVertical: spacing.md },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.fontFamily.display, fontSize: 25, color: colors.light.textPrimary },
  badge: { backgroundColor: colors.light.surfaceMuted, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  badgeText: { ...typography.fontFamily.bold, fontWeight: typography.weights.bold, fontSize: 9, color: colors.light.maroon },
  chips: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md, flexWrap: 'wrap' },
  chip: { height: 31, borderRadius: 16, borderWidth: 1, borderColor: colors.light.border, backgroundColor: colors.light.surface, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  chipText: { ...typography.fontFamily.semibold, fontWeight: typography.weights.semibold, fontSize: 10, color: colors.light.textSecondary },
  chipTextActive: { color: colors.light.surface },
  card: { backgroundColor: colors.light.surface, borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.lg - 1, padding: spacing.md, gap: 5, marginBottom: spacing.sm },
  cardTag: { ...typography.fontFamily.bold, fontWeight: typography.weights.bold, fontSize: 9, color: colors.light.maroon },
  cardTitle: { ...typography.fontFamily.display, fontSize: 14, color: colors.light.textPrimary },
  cardBody: { ...typography.fontFamily.regular, fontSize: 9, color: colors.light.textSecondary },
  cardTime: { ...typography.fontFamily.regular, fontSize: 8, color: colors.light.textSecondary },
  emptyText: { ...typography.fontFamily.regular, fontSize: 10, color: colors.light.textSecondary, textAlign: 'center', marginTop: spacing.lg },
  footer: { ...typography.fontFamily.regular, fontSize: 9, color: colors.light.textSecondary, textAlign: 'center', marginTop: spacing.lg },
});
