// ManagerShiftHandoverScreen — Terima & konfirmasi serah terima shift (Manager)
// Figma: 17 · Manager · Terima serah terima · Tablet · Prototype
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { createShopeeApi } from '../../src/api/shopee';
import { createApiClient } from '../../src/api/api';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import Card from '../../src/components/Card';
import Input from '../../src/components/Input';
import BaseButton from '../../src/components/BaseButton';
import EmptyState from '../../src/components/EmptyState';
import ScreenFrame from '../../src/components/ScreenFrame';
import AppShell from '../../src/components/AppShell';
import Notice from '../../src/components/Notice';

function formatRupiah(value) {
  if (!value) return '0';
  return Number(value).toLocaleString('id-ID');
}

export default function ManagerShiftHandoverScreen() {
  const { user, selection } = useAuth();
  const outletId = selection?.activeOutletId;

  const [pendingId, setPendingId] = useState(null);
  const [cashVerification, setCashVerification] = useState('');
  const [checklistAgenda, setChecklistAgenda] = useState('');
  const [checklistServer, setChecklistServer] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleAccept = async () => {
    setError(null);
    if (!cashVerification.trim()) {
      setError('Verifikasi kas wajib diisi.');
      return;
    }
    if (!checklistAgenda.trim()) {
      setError('Agenda checklist wajib diisi.');
      return;
    }
    if (!checklistServer.trim()) {
      setError('Checklist service wajib diisi.');
      return;
    }

    try {
      setSaving(true);
      const client = createApiClient();
      const shopeeApi = createShopeeApi({ request: client });
      // Simpan konfirmasi serah terima (bekas permintaan crew)
      await shopeeApi.createOrder(outletId, {
        clientTransactionId: `handover-accept-${Date.now()}`,
        recordedOffline: false,
        paymentMethod: 'CASH',
        payments: [
          { paymentMethod: 'CASH', amount: formatRupiah(cashVerification.trim()) },
        ],
        items: [
          {
            productVariantId: 'handover-accept',
            quantity: 1,
            expectedVariantPrice: '0',
            addOns: [],
          },
        ],
      });
      setConfirmed(true);
      Alert.alert('Berhasil', 'Serah terima shift berhasil dikonfirmasi.');
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

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Verifikasi kas</Text>
          <Input
            value={cashVerification}
            onChangeText={(v) => setCashVerification(v)}
            placeholder="Jumlah kas yang diterima (Rp)"
            keyboardType="numeric"
          />

          <Text style={styles.sectionTitle}>Agenda checklist</Text>
          <Input
            value={checklistAgenda}
            onChangeText={(v) => setChecklistAgenda(v)}
            placeholder="Cek: SLI, KTM, stok, PR waste, dsb."
            multiline
            numberOfLines={3}
          />

          <View style={styles.rowBetween}>
            <Text style={styles.label}>Checklist service</Text>
            <Text style={styles.hint}>SLI / KTM / Laporan</Text>
          </View>
          <Input
            value={checklistServer}
            onChangeText={(v) => setChecklistServer(v)}
            placeholder="Contoh: SLI terlaksana, KTM terbit, laporan bulanan diunggah"
            multiline
            numberOfLines={3}
          />

          <Text style={styles.sectionTitle}>Catatan tambahan</Text>
          <Input
            value={notes}
            onChangeText={(v) => setNotes(v)}
            placeholder="Catatan untuk crew berikutnya"
            multiline
            numberOfLines={3}
          />
        </Card>

        <BaseButton
          label="Konfirmasi serah terima"
          onPress={handleAccept}
          fullWidth
          size="lg"
          loading={saving}
          disabled={saving}
          style={styles.saveButton}
        />

        <Text style={styles.safeguard}>
          ⚠️ Pastikan kas, checklist, dan catatan sudah sesuai sebelum mengkonfirmasi.
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
