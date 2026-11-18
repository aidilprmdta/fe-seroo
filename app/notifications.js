// NotificationsScreen — Figma 171:294 · Inbox & Notifikasi
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../src/auth/AuthContext';
import ScreenFrame from '../src/components/ScreenFrame';
import ActivityNav from '../src/components/ActivityNav';
import StateCard from '../src/components/StateCard';
import { colors, spacing, typography, radii } from '../src/theme/tokens';

const NOTIFICATIONS = [
  {
    tag: 'BARU · PERSEDIAAN',
    title: 'Permintaan stok perlu ditinjau',
    body: 'Menunggu tindakan sesuai kewenangan akun.',
    unread: true,
  },
  {
    tag: 'OPERASIONAL',
    title: 'Laporan waste diperbarui',
    body: 'Status pemeriksaan tersedia pada outlet aktif.',
    unread: true,
  },
  {
    tag: 'KEUANGAN',
    title: 'Closing outlet telah disimpan',
    body: 'Ringkasan closing dapat dibuka dari laporan.',
    unread: false,
  },
  {
    tag: 'AKUN & AKSES',
    title: 'Perubahan akun tercatat',
    body: 'Informasi hanya terlihat oleh role berwenang.',
    unread: false,
  },
];

export default function NotificationsScreen() {
  const { user, selection } = useAuth();
  const [filter, setFilter] = useState('all');
  const role = user?.memberships?.find((m) => m.outletId === selection.activeOutletId)?.role;
  const roleLabel = role === 'ADMIN_PUSAT' ? 'OWNER PUSAT'
    : role === 'OWNER_MITRA' || role === 'OWNER' ? 'OWNER MITRA'
    : role === 'MANAGER' ? 'MANAGER' : 'CREW OUTLET';

  const items = filter === 'unread' ? NOTIFICATIONS.filter((n) => n.unread) : NOTIFICATIONS;

  return (
    <ScreenFrame>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>Seroo.</Text>
            <Text style={styles.role}>{roleLabel}</Text>
          </View>
          <Text style={styles.scope}>Konten mengikuti role dan outlet aktif</Text>
          <View style={styles.divider} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>Notifikasi</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>ROLE-AWARE</Text></View>
          </View>

          <View style={styles.chips}>
            <TouchableOpacity
              style={[styles.chip, filter === 'all' && styles.chipActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.chipText, filter === 'all' && styles.chipTextActive]}>Semua</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, filter === 'unread' && styles.chipActive]}
              onPress={() => setFilter('unread')}
            >
              <Text style={[styles.chipText, filter === 'unread' && styles.chipTextActive]}>
                Belum dibaca
              </Text>
            </TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <StateCard
              title="Belum ada notifikasi"
              tone="empty"
              description="Tidak ada notifikasi belum dibaca untuk outlet ini."
            />
          ) : (
            items.map((item) => (
              <View key={item.title} style={styles.card}>
                <Text style={styles.cardTag}>{item.tag}</Text>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBody}>{item.body}</Text>
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
  chips: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  chip: { height: 31, borderRadius: 16, borderWidth: 1, borderColor: colors.light.border, backgroundColor: colors.light.surface, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  chipText: { ...typography.fontFamily.semibold, fontWeight: typography.weights.semibold, fontSize: 10, color: colors.light.textSecondary },
  chipTextActive: { color: colors.light.surface },
  card: { backgroundColor: colors.light.surface, borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.lg - 1, padding: spacing.md, gap: 5, marginBottom: spacing.sm },
  cardTag: { ...typography.fontFamily.bold, fontWeight: typography.weights.bold, fontSize: 9, color: colors.light.maroon },
  cardTitle: { ...typography.fontFamily.display, fontSize: 14, color: colors.light.textPrimary },
  cardBody: { ...typography.fontFamily.regular, fontSize: 9, color: colors.light.textSecondary },
  footer: { ...typography.fontFamily.regular, fontSize: 9, color: colors.light.textSecondary, textAlign: 'center', marginTop: spacing.lg },
});
