// ManagerShiftHandoverScreen — Terima & konfirmasi serah terima shift (Manager)
// Figma: 17 · Manager · Terima serah terima · Tablet · Prototype
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Alert } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { createShiftHandoverApi } from '../../src/shift-handover/api';
import { createApiRequestWrapper } from '../../src/api/api';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import Card from '../../src/components/Card';
import Input from '../../src/components/Input';
import BaseButton from '../../src/components/BaseButton';
import Badge from '../../src/components/Badge';
import EmptyState from '../../src/components/EmptyState';
import AppShell from '../../src/components/AppShell';
import Notice from '../../src/components/Notice';

export default function ManagerShiftHandoverScreen() {
  const { user, selection, apiRequest } = useAuth();
  const outletId = selection?.activeOutletId;

  const [pending, setPending] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const [checks, setChecks] = useState({ cash: false, orders: false, notes: false });

  const loadPending = useCallback(async () => {
    if (!outletId) return;
    try {
      const api = createShiftHandoverApi({ request: createApiRequestWrapper(apiRequest) });
      const handovers = await api.listPending(outletId);
      setPending(handovers);
      setSelectedId((current) => current ?? handovers[0]?.id ?? null);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Daftar serah terima gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, [outletId, apiRequest]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const selected = pending.find((item) => item.id === selectedId) ?? null;
  const outletLabel =
    (user?.memberships ?? []).find((membership) => membership.outletId === outletId)
      ?.outletName ?? "Outlet";

  const checklist = [
    { key: 'cash', label: 'Kas fisik sudah diperiksa' },
    { key: 'orders', label: 'Pesanan dan kondisi stok ditinjau' },
    { key: 'notes', label: 'Catatan shift sudah dibaca' },
  ];
  const allChecked = checklist.every((item) => checks[item.key]);

  useEffect(() => {
    setChecks({ cash: false, orders: false, notes: false });
  }, [selectedId]);

  const handleDecide = async (status) => {
    if (!selected) {
      setError('Pilih permintaan serah terima terlebih dahulu.');
      return;
    }
    try {
      setSaving(true);
      const api = createShiftHandoverApi({ request: createApiRequestWrapper(apiRequest) });
      await api.decide(outletId, selected.id, {
        status,
        notes: notes.trim() || undefined,
      });
      setConfirmed(true);
      Alert.alert(
        'Berhasil',
        status === 'ACCEPTED'
          ? 'Serah terima shift berhasil dikonfirmasi.'
          : 'Serah terima shift ditolak.',
      );
    } catch (err) {
      setError(err?.message || 'Konfirmasi serah terima gagal.');
    } finally {
      setSaving(false);
    }
  };

  if (confirmed) {
    return (
      <AppShell
        navRole="manager"
        active="shift-handover"
        title="Serah Terima Berhasil"
        subtitle="Serah terima shift telah dikonfirmasi."
        roleLabel="MANAGER · OUTLET"
        outletLabel={outletLabel}
        scopeLabel={outletLabel}
        contentStyle={styles.container}
      >
        <Card style={styles.successCard}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Konfirmasi diterima</Text>
          <Text style={styles.successSubtitle}>
            Crew telah berhasil menyerah shift dan kas telah diverifikasi.
          </Text>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      navRole="manager"
      active="shift-handover"
      title="Terima Serah Terima"
      subtitle="Konfirmasi & verifikasi serah terima shift crew."
      roleLabel="MANAGER · OUTLET"
      outletLabel={outletLabel}
      scopeLabel={outletLabel}
      contentStyle={styles.container}
    >
      {error && <Notice message={error} type="error" />}

      {loading ? (
        <Text style={styles.hint}>Memuat permintaan serah terima...</Text>
      ) : pending.length === 0 ? (
        <EmptyState
          title="Tidak ada permintaan"
          subtitle="Belum ada permintaan serah terima shift yang menunggu konfirmasi."
        />
      ) : (
        <View style={styles.stack}>
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Permintaan menunggu konfirmasi</Text>
            {pending.map((item) => (
              <TouchableOpacity
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedId === item.id }}
                style={[styles.requestRow, selectedId === item.id && styles.requestRowActive]}
                onPress={() => setSelectedId(item.id)}
              >
                <View style={styles.rowBetween}>
                  <Text style={styles.requestTitle}>{item.crewName || 'Crew'}</Text>
                  <Badge label={item.status || 'PENDING'} variant="warning" size="sm" />
                </View>
                <Text style={styles.hint}>
                  {item.currentOutlet} → {item.nextOutlet}
                </Text>
              </TouchableOpacity>
            ))}
          </Card>
        </View>
      )}

      {selected && (
        <View style={[styles.stack, styles.stackSpaced]}>
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Serah terima shift</Text>
            <Text style={styles.value}>
              {selected.currentOutlet} → {selected.nextOutlet}
            </Text>
            <Text style={styles.meta}>
              Diserahkan oleh {selected.crewName || 'Crew'}
            </Text>
            {selected.summary ? (
              <Text style={styles.body}>{selected.summary}</Text>
            ) : null}
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Pemeriksaan kas</Text>
            <Text style={styles.body}>
              {selected.cashHandover ||
                'Crew belum mencatat jumlah kas pada serah terima ini.'}
            </Text>
            <Text style={styles.meta}>
              Nominal kas sistem dan kas fisik diverifikasi pada proses closing
              harian.
            </Text>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Catatan crew</Text>
            <Text style={styles.body}>
              {selected.notes || 'Catatan operasional akan ditampilkan di sini.'}
            </Text>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Konfirmasi penerimaan</Text>
            {checklist.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: checks[item.key] }}
                onPress={() =>
                  setChecks((current) => ({
                    ...current,
                    [item.key]: !current[item.key],
                  }))
                }
                style={styles.checkRow}
              >
                <View style={[styles.checkBox, checks[item.key] && styles.checkBoxOn]}>
                  {checks[item.key] ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
                <Text style={styles.checkLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </Card>

          <View style={styles.notesWrap}>
            <Text style={styles.sectionTitle}>Catatan konfirmasi</Text>
            <Input
              value={notes}
              onChangeText={setNotes}
              placeholder="Catatan untuk crew (opsional)"
            />
          </View>

          <BaseButton
            label="Konfirmasi Penerimaan"
            onPress={() => handleDecide('ACCEPTED')}
            size="lg"
            fullWidth
            loading={saving}
            disabled={saving || !allChecked}
          />
          {!allChecked ? (
            <Text style={styles.hint}>
              Centang ketiga pemeriksaan sebelum mengonfirmasi.
            </Text>
          ) : null}
          <BaseButton
            label="Tolak serah terima"
            onPress={() => handleDecide('REJECTED')}
            variant="secondary"
            size="lg"
            fullWidth
            disabled={saving}
          />
          <Text style={styles.footnote}>
            Konfirmasi penerimaan tidak otomatis mengubah saldo kas.
          </Text>
        </View>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  stack: { gap: spacing.md },
  stackSpaced: { marginTop: spacing.md },
  card: { gap: spacing.xs },
  sectionTitle: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hint: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
  },
  value: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
  },
  meta: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
  },
  body: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
    marginTop: spacing.xs,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.light.borderMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  checkMark: {
    color: colors.light.onPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkLabel: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
    flex: 1,
  },
  notesWrap: {
    gap: spacing.xs,
  },
  footnote: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
  requestRow: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 2,
  },
  requestRowActive: {
    borderColor: colors.light.primary,
    backgroundColor: colors.light.surfaceMuted,
  },
  requestTitle: {
    ...typography.fontFamily.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
  },
  successCard: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.light.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconText: {
    fontSize: 24,
    color: colors.light.success,
    fontWeight: 'bold',
  },
  successTitle: {
    ...typography.fontFamily.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
  },
  successSubtitle: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
});
