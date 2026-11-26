// AdminOutletsScreen — Admin Pusat: buat & kelola outlet
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { createAdminApi } from '../../src/api/admin';
import { createApiClient, createApiRequestWrapper } from '../../src/api/api';
import { useAuth } from '../../src/auth/AuthContext';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useResponsive } from '../../src/theme/responsive';
import Card from '../../src/components/Card';
import Input from '../../src/components/Input';
import BaseButton from '../../src/components/BaseButton';
import Badge from '../../src/components/Badge';
import EmptyState from '../../src/components/EmptyState';
import AppShell from '../../src/components/AppShell';
import Notice from '../../src/components/Notice';
import Modal from '../../src/components/Modal';

const EMPTY_FORM = { code: '', name: '', address: '' };

export default function AdminOutletsScreen() {
  const r = useResponsive();
  const { apiRequest } = useAuth();
  const [outlets, setOutlets] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const loadOutlets = useCallback(async () => {
    try {
      const api = createAdminApi({ request: createApiRequestWrapper(apiRequest) });
      const data = await api.listOutlets();
      setOutlets(data?.data?.outlets || []);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Gagal memuat outlet.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOutlets();
  }, [loadOutlets]);

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setError('Kode dan nama outlet wajib diisi.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const api = createAdminApi({ request: createApiRequestWrapper(apiRequest) });
      await api.createOutlet({
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        address: form.address.trim() || null,
      });
      setModalVisible(false);
      setForm(EMPTY_FORM);
      await loadOutlets();
    } catch (err) {
      setError(err?.message || 'Gagal menambah outlet.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (outlet) => {
    try {
      const api = createAdminApi({ request: createApiRequestWrapper(apiRequest) });
      await api.updateOutlet(outlet.id, { isActive: !outlet.isActive });
      await loadOutlets();
    } catch (err) {
      setError(err?.message || 'Gagal mengubah status outlet.');
    }
  };

  return (
    <AppShell
      navRole="ownerPusat"
      active="outlet"
      title="Manajemen outlet"
      subtitle="Tambah dan kelola outlet jaringan Seroo."
      roleLabel="OWNER PUSAT"
      outletLabel="AKSES GLOBAL"
      scopeLabel="AKSES GLOBAL"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadOutlets} />}
      contentStyle={[styles.container, { padding: r.padding, gap: r.gap }]}
    >
      <>
        {error && <Notice message={error} type="error" />}

        <BaseButton label="Tambah Outlet" onPress={() => { setForm(EMPTY_FORM); setError(null); setModalVisible(true); }} fullWidth size="lg" />

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.light.primary} />
          </View>
        ) : outlets.length === 0 ? (
          <EmptyState icon={<Text style={styles.icon}>🏪</Text>} title="Belum ada outlet" subtitle="Tambahkan outlet pertama lewat tombol di atas." />
        ) : (
          outlets.map((outlet) => (
            <Card key={outlet.id} style={styles.outletCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.outletName}>{outlet.name}</Text>
                <Badge
                  label={outlet.isActive ? 'Aktif' : 'Nonaktif'}
                  variant={outlet.isActive ? 'success' : 'danger'}
                />
              </View>
              <Text style={styles.outletCode}>Kode: {outlet.code}</Text>
              {outlet.address ? <Text style={styles.outletAddress}>{outlet.address}</Text> : null}
              <TouchableOpacity onPress={() => handleToggle(outlet)} style={styles.toggle}>
                <Text style={styles.toggleText}>
                  {outlet.isActive ? 'Nonaktifkan outlet' : 'Aktifkan kembali'}
                </Text>
              </TouchableOpacity>
            </Card>
          ))
        )}
      </>

      <Modal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Tambah Outlet"
        subtitle="Kode outlet harus unik, contoh: RUMBI-01"
        footer={
          <BaseButton
            label={saving ? 'Menyimpan…' : 'Simpan Outlet'}
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            fullWidth
            size="lg"
          />
        }
      >
        <Input label="Kode outlet" value={form.code} onChangeText={(v) => setForm({ ...form, code: v })} placeholder="RUMBI-01" />
        <Input label="Nama outlet" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Outlet Jalan Sekolah" />
        <Input label="Alamat (opsional)" value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} placeholder="Jalan Sekolah, Rumbai, Pekanbaru" />
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  header: { gap: spacing.sm },
  title: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    color: colors.light.textPrimary,
  },
  subtitle: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.base,
    color: colors.light.textSecondary,
  },
  loading: { padding: spacing.xl, alignItems: 'center' },
  icon: { fontSize: 40 },
  outletCard: { gap: spacing.xs },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  outletName: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.lg,
    color: colors.light.textPrimary,
    flex: 1,
  },
  outletCode: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  outletAddress: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  toggle: { paddingVertical: spacing.sm, borderRadius: radii.sm, alignItems: 'flex-start' },
  toggleText: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.primary,
  },
});
