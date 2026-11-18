// HelpFaqScreen — Bantuan & FAQ untuk crew/staf
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '../src/auth/AuthContext';
import Card from '../src/components/Card';
import ScreenFrame from '../src/components/ScreenFrame';
import { colors, spacing, typography, radii } from '../src/theme/tokens';

const FAQ = [
  {
    q: 'Bagaimana cara mencatat pesanan?',
    a: 'Buka menu Pencatatan Pesanan, pilih topping bila perlu, lalu ketuk varian minuman. Isi nominal bayar dan tekan Selesaikan Pesanan.',
  },
  {
    q: 'Apa bedanya CASH, QRIS, dan SPLIT?',
    a: 'CASH dibayar tunai. QRIS menunggu verifikasi kasir. SPLIT menggabungkan sebagian CASH dan sebagian QRIS.',
  },
  {
    q: 'Bagaimana jika harga berubah?',
    a: 'Muat ulang katalog sebelum mengirim pesanan. Sistem akan menolak order bila harga tidak sesuai.',
  },
  {
    q: 'Siapa yang bisa mereset password?',
    a: 'Hanya Owner Pusat. Hubungi melalui kanal internal resmi Seroo dan sertakan username serta outlet terdaftar.',
  },
  {
    q: 'Apakah ada pendaftaran akun mandiri?',
    a: 'Tidak. Akun dibuat oleh pengelola dan akses mengikuti role serta outlet yang ditugaskan.',
  },
];

export default function HelpFaqScreen() {
  const { user } = useAuth();

  return (
    <ScreenFrame>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Bantuan & FAQ</Text>
        <Text style={styles.subtitle}>
          Halo, {user?.name || 'staf'}. Berikut panduan singkat penggunaan sistem.
        </Text>

        {FAQ.map((item) => (
          <Card key={item.q} style={styles.card}>
            <Text style={styles.question}>{item.q}</Text>
            <Text style={styles.answer}>{item.a}</Text>
          </Card>
        ))}

        <View style={styles.contact}>
          <Text style={styles.contactTitle}>Butuh bantuan langsung?</Text>
          <Text style={styles.contactText}>
            Hubungi Owner Pusat melalui kanal internal resmi Seroo. Jangan pernah
            mengirim password lama atau kode OTP kepada siapa pun.
          </Text>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  title: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xxl,
    color: colors.light.textPrimary,
  },
  subtitle: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.base,
    color: colors.light.textSecondary,
  },
  card: { gap: spacing.sm },
  question: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
  },
  answer: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  contact: {
    backgroundColor: colors.light.accent,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  contactTitle: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.primary,
  },
  contactText: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
  },
});
