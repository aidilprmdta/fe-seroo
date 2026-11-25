// ExpensesScreen — pengeluaran: list, create, koreksi, batalkan, audit
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useAuth } from '../src/auth/AuthContext';
import { createExpensesApi } from '../src/api/expenses';
import { createApiRequestWrapper } from '../src/api/api';
import { colors, spacing, typography, radii } from '../src/theme/tokens';
import Card from '../src/components/Card';
import ListItem from '../src/components/ListItem';
import Input from '../src/components/Input';
import BaseButton from '../src/components/BaseButton';
import Badge from '../src/components/Badge';
import EmptyState from '../src/components/EmptyState';
import ScreenFrame from '../src/components/ScreenFrame';
import AppShell from '../src/components/AppShell';
import Notice from '../src/components/Notice';
import Modal from '../src/components/Modal';

function uuidv4() {
  const bytes = Crypto.getRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function formatRupiah(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString('id-ID') : '0';
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function toIsoDate(dateKey) {
  return new Date(`${dateKey}T00:00:00+07:00`).toISOString();
}

export default function ExpensesScreen() {
  const { user, selection, apiRequest } = useAuth();
  const outletId = selection.activeOutletId;
  const activeRole = user?.memberships?.find((m) => m.outletId === outletId)?.role || selection.activeRole;
  const isOwner = activeRole === 'OWNER_MITRA' || activeRole === 'OWNER';
  const canManageExpenses = activeRole === 'MANAGER';
  const navRole = isOwner ? 'ownerMitra' : 'manager';
  const roleLabel = activeRole || 'MANAGER';

  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayKey());
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [target, setTarget] = useState(null);
  const [editForm, setEditForm] = useState({ amount: '', date: '', description: '', reason: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [auditRows, setAuditRows] = useState([]);

  const getApi = useCallback(() => {
    return createExpensesApi({ request: createApiRequestWrapper(apiRequest) });
  }, [apiRequest]);

  const loadExpenses = useCallback(async () => {
    try {
      const data = await getApi().getExpenses(outletId, { pageSize: 100 });
      setExpenses(data?.data?.expenses || []);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Riwayat pengeluaran gagal dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [outletId, getApi]);

  const loadCategories = useCallback(async () => {
    try {
      const data = await getApi().getExpenseCategories();
      const list = Array.isArray(data?.data?.categories)
        ? data.data.categories
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];
      setCategories(list);
      setCategoryId((current) => current || list[0]?.id || '');
    } catch (err) {
      setError(err?.message || 'Kategori gagal dimuat.');
    }
  }, [getApi]);

  useEffect(() => {
    loadExpenses();
    loadCategories();
  }, [loadExpenses, loadCategories]);

  const handleCreate = useCallback(async () => {
    setError(null);
    if (!categoryId || !(Number(amount) > 0) || !date) {
      setError('Kategori, nominal, dan tanggal wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      await getApi().createExpense(outletId, {
        clientTransactionId: uuidv4(),
        categoryId,
        amount: String(Number(amount)),
        expenseDate: toIsoDate(date),
        description: description.trim() || undefined,
      });
      setAmount('');
      setDescription('');
      setDate(todayKey());
      await loadExpenses();
      Alert.alert('Berhasil', 'Pengeluaran berhasil dicatat.');
    } catch (err) {
      setError(err?.message || 'Pengeluaran gagal disimpan.');
    } finally {
      setSubmitting(false);
    }
  }, [categoryId, amount, date, description, outletId, getApi, loadExpenses]);

  const openEdit = useCallback((expense) => {
    setTarget(expense);
    setEditForm({
      amount: String(expense.amount),
      date: (expense.expenseDate || '').slice(0, 10),
      description: expense.description || '',
      reason: '',
    });
    setError(null);
    setModal('edit');
  }, []);

  const handleEdit = useCallback(async () => {
    setError(null);
    if (!(Number(editForm.amount) > 0) || !editForm.date) {
      setError('Nominal dan tanggal wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      await getApi().editExpense(outletId, target.id, {
        clientTransactionId: uuidv4(),
        amount: String(Number(editForm.amount)),
        expenseDate: toIsoDate(editForm.date),
        description: editForm.description.trim(),
        reason: editForm.reason.trim() || 'Koreksi dari aplikasi mobile',
      });
      setModal(null);
      await loadExpenses();
      Alert.alert('Berhasil', 'Pengeluaran berhasil dikoreksi.');
    } catch (err) {
      setError(err?.message || 'Koreksi gagal.');
    } finally {
      setSubmitting(false);
    }
  }, [editForm, target, outletId, getApi, loadExpenses]);

  const openCancel = useCallback((expense) => {
    setTarget(expense);
    setCancelReason('');
    setError(null);
    setModal('cancel');
  }, []);

  const handleCancel = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      await getApi().cancelExpense(outletId, target.id, {
        clientTransactionId: uuidv4(),
        reason: cancelReason.trim() || 'Dibatalkan dari aplikasi mobile',
      });
      setModal(null);
      await loadExpenses();
      Alert.alert('Berhasil', 'Pengeluaran dibatalkan.');
    } catch (err) {
      setError(err?.message || 'Pembatalan gagal.');
    } finally {
      setSubmitting(false);
    }
  }, [target, cancelReason, outletId, getApi, loadExpenses]);

  const openAudit = useCallback(async (expense) => {
    setTarget(expense);
    setAuditRows([]);
    setError(null);
    setModal('audit');
    try {
      const data = await getApi().getExpenseAudit(outletId, expense.id);
      setAuditRows(data?.data?.audits || []);
    } catch (err) {
      setError(err?.message || 'Audit gagal dimuat.');
    }
  }, [outletId, getApi]);

  return (
    <AppShell
      navRole={navRole}
      active="biaya"
      title="Pengeluaran outlet"
      subtitle={isOwner ? "Memantau riwayat pengeluaran dan jejak audit outlet." : "Catat tanggal kejadian, kategori, dan nominal. Pengeluaran masuk ke rekap."}
      roleLabel={roleLabel}
      outletLabel={outletId || 'Outlet'}
      scopeLabel={outletId || 'Outlet'}
      contentStyle={styles.container}
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadExpenses} />}
      >
        {error && !modal && <Notice message={error} type="error" />}

        {canManageExpenses && (
          <Card style={styles.formCard}>
            <Text style={styles.sectionTitle}>Catat Pengeluaran</Text>
            <Text style={styles.label}>Kategori</Text>
            <View style={styles.chipRow}>
              {Array.isArray(categories) && categories.length > 0 ? (
                categories.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.chip, categoryId === item.id && styles.chipActive]}
                    onPress={() => setCategoryId(item.id)}
                  >
                    <Text style={[styles.chipText, categoryId === item.id && styles.chipTextActive]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.emptyCategoriesText}>Tidak ada kategori tersedia</Text>
              )}
            </View>
            <Input label="Jumlah (Rp)" value={amount} onChangeText={setAmount} placeholder="0" keyboardType="numeric" />
            <Input label="Tanggal" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" keyboardType="numeric" />
            <Input label="Deskripsi" value={description} onChangeText={setDescription} placeholder="Keterangan pengeluaran" />
            <BaseButton label="Simpan Pengeluaran" onPress={handleCreate} loading={submitting} fullWidth size="lg" />
          </Card>
        )}

        <Text style={styles.sectionTitle}>Riwayat Pengeluaran</Text>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.light.primary} />
          </View>
        ) : expenses.length === 0 ? (
          <EmptyState icon={<Text style={styles.icon}>💰</Text>} title="Belum ada data" subtitle="Pengeluaran akan muncul di sini." />
        ) : (
          expenses.map((expense) => (
            <Card key={expense.id} style={styles.expenseCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.expenseTitle}>{expense.description || 'Tanpa keterangan'}</Text>
                <Badge
                  label={expense.status === 'ACTIVE' ? '✓ Aktif' : '✗ Batal'}
                  variant={expense.status === 'ACTIVE' ? 'success' : 'danger'}
                />
              </View>
              <Text style={styles.expenseMeta}>
                Rp {formatRupiah(expense.amount)} · {expense.category?.name || '-'} · {(expense.expenseDate || '').slice(0, 10)}
              </Text>
              <View style={styles.rowActions}>
                {canManageExpenses && expense.status === 'ACTIVE' && (
                  <TouchableOpacity style={styles.action} onPress={() => openEdit(expense)}>
                    <Text style={styles.actionText}>Koreksi</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.action} onPress={() => openAudit(expense)}>
                  <Text style={styles.actionText}>Audit</Text>
                </TouchableOpacity>
                {canManageExpenses && expense.status === 'ACTIVE' && (
                  <TouchableOpacity style={[styles.action, styles.actionDanger]} onPress={() => openCancel(expense)}>
                    <Text style={[styles.actionText, styles.actionDangerText]}>Batal</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <Modal
        visible={modal === 'edit'}
        onClose={() => setModal(null)}
        title="Koreksi Pengeluaran"
        subtitle="Perubahan akan tercatat di audit log."
        footer={<BaseButton label="Simpan Koreksi" onPress={handleEdit} loading={submitting} fullWidth size="lg" />}
      >
        <View style={styles.modalContent}>
          {error && <Notice message={error} type="error" />}
          <Input label="Nominal" value={editForm.amount} onChangeText={(v) => setEditForm({ ...editForm, amount: v })} keyboardType="numeric" />
          <Input label="Tanggal" value={editForm.date} onChangeText={(v) => setEditForm({ ...editForm, date: v })} keyboardType="numeric" />
          <Input label="Deskripsi" value={editForm.description} onChangeText={(v) => setEditForm({ ...editForm, description: v })} />
          <Input label="Alasan koreksi" value={editForm.reason} onChangeText={(v) => setEditForm({ ...editForm, reason: v })} />
        </View>
      </Modal>

      <Modal
        visible={modal === 'cancel'}
        onClose={() => setModal(null)}
        title="Batalkan Pengeluaran"
        subtitle="Pengeluaran akan berstatus CANCELLED."
        footer={<BaseButton label="Batalkan Pengeluaran" onPress={handleCancel} loading={submitting} fullWidth size="lg" variant="danger" />}
      >
        <View style={styles.modalContent}>
          {error && <Notice message={error} type="error" />}
          <Input label="Alasan" value={cancelReason} onChangeText={setCancelReason} placeholder="Contoh: input ganda" />
        </View>
      </Modal>

      <Modal
        visible={modal === 'audit'}
        onClose={() => setModal(null)}
        title="Audit Pengeluaran"
        subtitle="Riwayat perubahan pengeluaran."
        footer={<BaseButton label="Tutup" onPress={() => setModal(null)} fullWidth size="lg" variant="secondary" />}
      >
        <View style={styles.modalContent}>
          {error && <Notice message={error} type="error" />}
          {auditRows.length === 0 ? (
            <Text style={styles.modalText}>Belum ada riwayat audit.</Text>
          ) : (
            auditRows.map((row) => (
              <View key={row.id} style={styles.auditRow}>
                <Text style={styles.auditAction}>{row.action || row.activity || '-'}</Text>
                <Text style={styles.modalText}>{row.createdAt || ''}</Text>
              </View>
            ))
          )}
        </View>
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
    fontSize: typography.sizes.xxl,
    color: colors.light.textPrimary,
  },
  subtitle: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.base,
    color: colors.light.textSecondary,
  },
  formCard: { gap: spacing.md },
  sectionTitle: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    marginTop: spacing.lg,
  },
  label: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surface,
  },
  chipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  chipText: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  chipTextActive: { color: colors.light.onPrimary },
  loading: { padding: spacing.xl, alignItems: 'center' },
  icon: { fontSize: 40 },
  expenseCard: { gap: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expenseTitle: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
    flex: 1,
  },
  expenseMeta: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.light.surfaceSecondary,
    alignItems: 'center',
  },
  actionDanger: { backgroundColor: colors.light.dangerSurface },
  actionText: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.primary,
  },
  actionDangerText: { color: colors.light.danger },
  modalContent: { padding: spacing.md, gap: spacing.md },
  modalText: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  auditRow: {
    padding: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.light.surfaceSecondary,
    gap: spacing.xs,
  },
  auditAction: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
  },
  emptyCategoriesText: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    fontStyle: 'italic',
    paddingVertical: spacing.xs,
  },
});
