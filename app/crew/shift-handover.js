// CrewShiftHandoverScreen — Permintaan serah terima shift (Crew)
// Figma: 16 · Crew · Serah terima shift · Tablet · Prototype
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

export default function CrewShiftHandoverScreen() {
  const { user, selection } = useAuth();
  const outletId = selection?.activeOutletId;

  const [summary, setSummary] = useState('');
  const [cashHandover, setCashHandover] = useState('');
  const [checklistAgenda, setChecklistAgenda] = useState('');
  const [checklistServer, setChecklistServer] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!summary.trim()) {
      setError('Ringkasan shift wajib diisi.');
      return;
    }
    if (!cashHandover.trim()) {
      setError('Rincian cash handover wajib diisi.');
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
      await shopeeApi.createOrder(outletId, {
        clientTransactionId: `handover-${Date.now()}`,
        recordedOffline: false,
        paymentMethod: 'CASH',
        payments: [
          { paymentMethod: 'CASH', amount: formatRupiah(cashHandover.trim()) },
        ],
        items: [
          {
            productVariantId: 'handover-summary',
            quantity: 1,
            expectedVariantPrice: '0',
            addOns: [],
          },
          {
            productVariantId: 'handover-agenda',
            quantity: 1,
            expectedVariantPrice: '0',
            addOns: [],
          },
          {
            productVariantId: 'handover-server',
            quantity: 1,
            expectedVariantPrice: '0',
            addOns: [],
          },
        ],
      });
      setSubmitted(true);
      Alert.alert('Berhasil', 'Permintaan serah terima shift berhasil dikirim ke Manager.');
    } catch (err) {
      setError(err?.message || 'Permintaan serah terima gagal dikirim.');
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <AppShell
        navRole="crew"
        active="shift-handover"
        title="Serah Terima Shift"
        subtitle="Permintaan telah dikirim. Tunggu konfirmasi Manager."
        roleLabel="CREW · OUTLET"
        outletLabel={outletId || 'Outlet'}
        scopeLabel={outletId || 'Outlet'}
        contentStyle={styles.container}
      >
        <Card style={styles.successCard}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Permintaan terkirim</Text>
          <Text style={styles.successSubtitle}>
            Manager akan menerima atau menolak permintaan serah terima Anda.
          </Text>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      navRole="crew"
      active="shift-handover"
      title="Serah Terima Shift"
      subtitle="Serahkan kerja shift ke crew berikutnya."
      roleLabel="CREW · OUTLET"
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
          <Text style={styles.sectionTitle}>Ringkasan shift</Text>
          <Input
            value={summary}
            onChangeText={(v) => setSummary(v)}
            placeholder="Contoh: Shift pagi, pelayanan 06.00-14.00"
            multiline
            numberOfLines={3}
          />

          <Text style={styles.sectionTitle}>Cash handover (uang yang diserahkan)</Text>
          <Input
            value={cashHandover}
            onChangeText={(v) => setCashHandover(v)}
            placeholder="Jumlah uang tunai yang diserahkan (Rp)"
            keyboardType="numeric"
          />

          <View style={styles.rowBetween}>
            <Text style={styles.label}>Agenda checklist</Text>
            <Text style={styles.hint}>Lista yang harus dicek</Text>
          </View>
          <Input
            value={checklistAgenda}
            onChangeText={(v) => setChecklistAgenda(v)}
            placeholder="Contoh: cek stok minuman, pastikan uang pas, cek PR waste"
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
            placeholder="Untuk info crew berikutnya"
            multiline
            numberOfLines={3}
          />
        </Card>

        <BaseButton
          label="Kirim permintaan serah terima"
          onPress={handleSubmit}
          fullWidth
          size="lg"
          loading={saving}
          disabled={saving}
          style={styles.saveButton}
        />
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
