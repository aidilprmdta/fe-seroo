// AdminAuditScreen — Figma 171:206 · Audit Log (role-aware)
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { createAdminApi } from '../../src/api/admin';
import { createApiRequestWrapper } from '../../src/api/api';
import { useAuth } from '../../src/auth/AuthContext';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import AppShell from '../../src/components/AppShell';
import StateCard from '../../src/components/StateCard';
import Notice from '../../src/components/Notice';

const FILTERS = [
  { key: 'today', label: 'Hari ini' },
  { key: 'all', label: 'Semua modul' },
  { key: 'user', label: 'Pengguna' },
];

export default function AdminAuditScreen() {
  const { user, selection, apiRequest } = useAuth();
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const role = user?.memberships?.find((m) => m.outletId === selection.activeOutletId)?.role;
  const scope = role === 'ADMIN_PUSAT' ? 'Ruang lingkup: seluruh outlet'
    : `Ruang lingkup: ${selection.activeOutletId || 'outlet aktif'}`;
  const title = role === 'ADMIN_PUSAT' ? 'Audit Log Pusat'
    : role === 'MANAGER' ? 'Audit Log Manager' : 'Audit Log Mitra';

  const loadLogs = useCallback(async () => {
    try {
      const api = createAdminApi({ request: createApiRequestWrapper(apiRequest) });
      const data = await api.listAuditLogs({ page: 1, pageSize: 100 });
      setLogs(data?.data?.auditLogs || []);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Audit log gagal dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const visible = logs.filter((log) => {
    if (filter === 'today') {
      const today = new Date().toISOString().slice(0, 10);
      return (log.createdAt || '').slice(0, 10) === today;
    }
    if (filter === 'user') return Boolean(log.actor);
    return true;
  });

  return (
    <AppShell
      navRole="ownerPusat"
      active="keamanan"
      title={title}
      subtitle={scope}
      roleLabel="OWNER PUSAT"
      outletLabel="AKSES GLOBAL"
      scopeLabel="AKSES GLOBAL"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={loadLogs} />
      }
    >
      <View style={styles.content}>
        {error ? <Notice message={error} type="error" /> : null}

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

        {loading ? (
          <StateCard title="Memuat data" tone="loading" description="Menyiapkan riwayat aktivitas outlet." />
        ) : visible.length === 0 ? (
          <StateCard
            title="Belum ada aktivitas"
            tone="empty"
            description="Audit log akan muncul setelah ada transaksi atau perubahan data."
          />
        ) : (
          visible.map((log) => (
            <View key={log.id} style={styles.logCard}>
              <Text style={styles.logTag}>
                {(log.createdAt || '').slice(11, 16).replace(':', '.')} · {(log.resourceType || 'AKUN').toUpperCase()}
              </Text>
              <Text style={styles.logTitle}>{log.action}</Text>
              <Text style={styles.logActor}>
                {log.actor?.name || 'Sistem'} · {log.outcome || 'SUCCESS'}
              </Text>
              <Text style={styles.logBody}>
                {log.actor?.email || 'Aktivitas sistem'} · {(log.createdAt || '').slice(0, 10)}
              </Text>
            </View>
          ))
        )}

        <Text style={styles.footer}>
          {role === 'ADMIN_PUSAT'
            ? 'Akses global khusus Owner Pusat.'
            : 'Aktivitas dibatasi oleh role dan outlet aktif.'}
        </Text>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { height: 31, borderRadius: 16, borderWidth: 1, borderColor: colors.light.border, backgroundColor: colors.light.surface, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  chipText: { ...typography.fontFamily.semibold, fontWeight: typography.weights.semibold, fontSize: 10, color: colors.light.textSecondary },
  chipTextActive: { color: colors.light.surface },
  logCard: { backgroundColor: colors.light.surface, borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.lg - 1, padding: spacing.md, gap: 5, marginBottom: spacing.sm },
  logTag: { ...typography.fontFamily.bold, fontWeight: typography.weights.bold, fontSize: 9, color: colors.light.maroon },
  logTitle: { ...typography.fontFamily.display, fontSize: 15, color: colors.light.textPrimary },
  logActor: { ...typography.fontFamily.semibold, fontWeight: typography.weights.semibold, fontSize: 10, color: colors.light.maroon },
  logBody: { ...typography.fontFamily.regular, fontSize: 10, color: colors.light.textSecondary },
  footer: { ...typography.fontFamily.regular, fontSize: 9, color: colors.light.textSecondary, textAlign: 'center', marginTop: spacing.lg },
});
