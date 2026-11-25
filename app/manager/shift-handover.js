// ManagerShiftHandoverScreen — Terima & konfirmasi serah terima shift (Manager)
// Figma: 17 · Manager · Terima serah terima · Tablet · Prototype
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { createShiftHandoverApi } from '../../src/shift-handover/api';
import { createApiRequestWrapper } from '../../src/api/api';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import Card from '../../src/components/Card';
import Input from '../../src/components/Input';
import BaseButton from '../../src/components/BaseButton';
import EmptyState from '../../src/components/EmptyState';
import ScreenFrame from '../../src/components/ScreenFrame';
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
        outletLabel={outletId || 'Outlet'}
        scopeLabel={outletId || 'Outlet'}
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
      outletLabel={outletId || 'Outlet'}
      scopeLabel={outletId || 'Outlet'}
      contentStyle={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {error && <Notice message={error} type="error" />}

        {loading ? (
          <Text style={styles.hint}>Memuat permintaan serah terima...</Text>
        ) : pending.length === 0 ? (
          <EmptyState
            title="Tidak ada permintaan"
            description="Belum ada permintaan serah terima shift yang menunggu konfirmasi."
          />
        ) : (
          <Card style={styles.formCard}>
            <Text style={styles.sectionTitle}>Permintaan menunggu konfirmasi</Text>
            {pending.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.requestRow, selectedId === item.id && styles.requestRowActive]}
                onPress={() => setSelectedId(item.id)}
              >
                <Text style={styles.requestTitle}>{item.crewName || 'Crew'}</Text>
                <Text style={styles.hint}>
                  {item.currentOutlet} → {item.nextOutlet}
                  {item.notes ? ` · ${item.notes}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {selected && (
          <Card style={styles.formCard}>
            <Text style={styles.sectionTitle}>Catatan konfirmasi</Text>
            <Input
              value={notes}
              onChangeText={setNotes}
              placeholder="Catatan untuk crew (opsional)"
              multiline
              numberOfLines={3}
            />
          </Card>
        )}

        {selected && (
          <View style={styles.actionRow}>
            <BaseButton
              label="Tolak"
              onPress={() => handleDecide('REJECTED')}
              variant="secondary"
              size="lg"
              loading={saving}
              disabled={saving}
              style={styles.actionButton}
            />
            <BaseButton
              label="Konfirmasi"
              onPress={() => handleDecide('ACCEPTED')}
              size="lg"
              loading={saving}
              disabled={saving}
              style={styles.actionButton}
            />
          </View>
        )}

        <Text style={styles.safeguard}>
          ⚠️ Pastikan kas dan serah terima sudah sesuai sebelum mengkonfirmasi.
        </Text>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  scrollContent: { paddingBottom: spacing.lg },
  formCard: { gap: spacing.md, marginBottom: spacing.lg },
  sectionTitle: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    marginTop: spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...typography.fontFamily.medium,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
  },
  hint: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
  },
  saveButton: {
    backgroundColor: colors.light.primary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
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
  safeguard: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
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
