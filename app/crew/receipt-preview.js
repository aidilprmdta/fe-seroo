// CrewReceiptPreviewScreen — Preview struk (receipt print preview untuk Crew)
// Figma: 15 · Crew · Preview struk · Tablet · Prototype
import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import Card from '../../src/components/Card';
import BaseButton from '../../src/components/BaseButton';
import ScreenFrame from '../../src/components/ScreenFrame';
import AppShell from '../../src/components/AppShell';
import Notice from '../../src/components/Notice';

function formatRupiah(value) {
  if (!value) return '0';
  return Number(value).toLocaleString('id-ID');
}

const MOCK_RECEIPT = {
  outlet: 'Seroo Rumbai',
  date: '2026-11-24 14:30',
  cashier: 'AKU',
  items: [
    { name: 'Teh Tarik Original', qty: 2, price: 15000 },
    { name: 'Milo Serous', qty: 1, price: 12000 },
    { name: 'Teh Hijau', qty: 1, price: 11000 },
  ],
  subtotal: 48000,
  tax: 0,
  total: 48000,
  cashReceived: 50000,
  change: 2000,
  note: 'Pesanan dibayar tunai, tiap tagihan otomatis.' ,
};

export default function CrewReceiptPreviewScreen() {
  const outletId = useAuth()?.selection?.activeOutletId || 'Outlet';

  return (
    <AppShell
      navRole="crew"
      active="receipt-preview"
      title="Preview Struk"
      subtitle="Pratinjau struk & kirim ke printer."
      roleLabel="CREW · OUTLET"
      outletLabel={outletId || 'Outlet'}
      scopeLabel={outletId || 'Outlet'}
      contentStyle={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.receiptCard}>
          <View style={styles.receiptTop}>
            <Text style={styles.receiptTitle}>Seroo</Text>
            <Text style={styles.receiptOutlet}>{MOCK_RECEIPT.outlet}</Text>
            <Text style={styles.receiptDate}>{MOCK_RECEIPT.date}</Text>
            <Text style={styles.receiptCashier}>Cashier: {MOCK_RECEIPT.cashier}</Text>
          </View>

          <View style={styles.receiptItemRow}>
            <Text style={styles.receiptItemName}>{MOCK_RECEIPT.items[0].name}</Text>
            <Text style={styles.receiptItemQty}>{MOCK_RECEIPT.items[0].qty} ×</Text>
            <Text style={styles.receiptItemPrice}>{formatRupiah(MOCK_RECEIPT.items[0].price)}</Text>
          </View>
          <View style={styles.receiptItemRow}>
            <Text style={styles.receiptItemName}>{MOCK_RECEIPT.items[1].name}</Text>
            <Text style={styles.receiptItemQty}>{MOCK_RECEIPT.items[1].qty} ×</Text>
            <Text style={styles.receiptItemPrice}>{formatRupiah(MOCK_RECEIPT.items[1].price)}</Text>
          </View>
          <View style={styles.receiptItemRow}>
            <Text style={styles.receiptItemName}>{MOCK_RECEIPT.items[2].name}</Text>
            <Text style={styles.receiptItemQty}>{MOCK_RECEIPT.items[2].qty} ×</Text>
            <Text style={styles.receiptItemPrice}>{formatRupiah(MOCK_RECEIPT.items[2].price)}</Text>
          </View>

          <View style={styles.receiptDivider} />

          <View style={styles.receiptTotalRow}>
            <Text style={styles.receiptTotalLabel}>Subtotal</Text>
            <Text style={styles.receiptTotalValue}>{formatRupiah(MOCK_RECEIPT.subtotal)}</Text>
          </View>
          <View style={styles.receiptTotalRow}>
            <Text style={styles.receiptTotalLabel}>Pajak</Text>
            <Text style={styles.receiptTotalValue}>{formatRupiah(MOCK_RECEIPT.tax)}</Text>
          </View>
          <View style={styles.receiptDivider} />
          <View style={styles.receiptTotalRow}>
            <Text style={[styles.receiptTotalLabel, styles.receiptTotalLabelBold]}>Total</Text>
            <Text style={[styles.receiptTotalValue, styles.receiptTotalValueBold]}>
              {formatRupiah(MOCK_RECEIPT.total)}
            </Text>
          </View>

          <View style={styles.receiptBottom}>
            <Text style={styles.receiptNote}>{MOCK_RECEIPT.note}</Text>
            <Text style={styles.receiptSignature}>Terima kasih sudah berbelanja!</Text>
          </View>
        </Card>

        <View style={styles.buttonRow}>
          <BaseButton
            label="Cetak Struk"
            onPress={() => Alert.alert('Cetak', 'Fitur cetak akan dihubungkan ke printer')}
            fullWidth
            size="lg"
            style={styles.actionButton}
          />
          <BaseButton
            label="Bagikan Struk"
            onPress={() => Alert.alert('Bagikan', 'Fitur bagikan akan mengirim struk melalui WhatsApp/explorer')}
            fullWidth
            size="lg"
            style={styles.actionButton}
          />
        </View>

        <Notice
          message="Pratinjau ini untuk verifikasi layout cetak. Struk asli akan di-generate dari data transaksi aktual saat proses printing."
          type="info"
        />
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  scrollContent: { paddingBottom: spacing.lg },
  receiptCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  receiptTop: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  receiptTitle: {
    ...typography.fontFamily.display,
    fontSize: 22,
    color: colors.light.primary,
    fontWeight: 'bold',
  },
  receiptOutlet: {
    ...typography.fontFamily.medium,
    fontSize: 11,
    color: colors.light.textSecondary,
  },
  receiptDate: {
    ...typography.fontFamily.regular,
    fontSize: 9,
    color: colors.light.textSecondary,
  },
  receiptCashier: {
    ...typography.fontFamily.regular,
    fontSize: 9,
    color: colors.light.textSecondary,
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.light.surfaceSecondary,
    borderRadius: radii.md,
  },
  receiptItemName: {
    ...typography.fontFamily.medium,
    fontSize: 11,
    color: colors.light.textPrimary,
    flex: 1,
  },
  receiptItemQty: {
    ...typography.fontFamily.regular,
    fontSize: 10,
    color: colors.light.textSecondary,
  },
  receiptItemPrice: {
    ...typography.fontFamily.bold,
    fontSize: 11,
    color: colors.light.primary,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: colors.light.border,
    marginVertical: spacing.sm,
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
  },
  receiptTotalLabel: {
    ...typography.fontFamily.medium,
    fontSize: 10,
    color: colors.light.textSecondary,
  },
  receiptTotalLabelBold: {
    ...typography.fontFamily.medium,
    fontSize: 10,
    color: colors.light.textPrimary,
  },
  receiptTotalValue: {
    ...typography.fontFamily.bold,
    fontSize: 12,
    color: colors.light.textSecondary,
  },
  receiptTotalValueBold: {
    ...typography.fontFamily.bold,
    fontSize: 14,
    color: colors.light.primary,
  },
  receiptBottom: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  receiptNote: {
    ...typography.fontFamily.regular,
    fontSize: 8,
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
  receiptSignature: {
    ...typography.fontFamily.medium,
    fontSize: 10,
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.light.primary,
  },
});
