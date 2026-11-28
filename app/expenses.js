// ExpensesScreen — pengeluaran: list, create, koreksi, batalkan, audit
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity, Pressable, useWindowDimensions } from 'react-native';
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

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});

const MONTH_KEY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  timeZone: 'Asia/Jakarta',
});

function formatDateTime(value) {
  if (!value) return '-';
  return DATE_TIME_FORMAT.format(new Date(value));
}

function jakartaMonthKey(value) {
  return MONTH_KEY_FORMAT.format(new Date(value));
}

function expenseState(expense) {
  if (expense.status !== 'ACTIVE') return 'Dibatalkan';
  const corrected = (expense.audits ?? []).some(
    (audit) => audit.action === 'CORRECTED',
  );
  return corrected ? 'Dikoreksi' : 'Aktif';
}

const STATE_VARIANT = {
  Aktif: 'success',
  Dikoreksi: 'warning',
  Dibatalkan: 'danger',
};

const PERIOD_OPTIONS = [
  { value: 'SEMUA', label: 'Semua' },
  { value: 'BULAN_INI', label: 'Bulan ini' },
];

const STATUS_OPTIONS = [
  { value: 'SEMUA', label: 'Semua' },
  { value: 'Aktif', label: 'Aktif' },
  { value: 'Dikoreksi', label: 'Dikoreksi' },
  { value: 'Dibatalkan', label: 'Dibatalkan' },
];

function FilterChips({ label, options, value, onChange }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(option.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailRowLabel}>{label}</Text>
      <Text style={styles.detailRowValue}>{value}</Text>
    </View>
  );
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
  const outletLabel =
    user?.memberships?.find((membership) => membership.outletId === outletId)
      ?.outletName || 'Outlet';
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

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
  const [detail, setDetail] = useState(null);
  const [successState, setSuccessState] = useState(null);
  const [period, setPeriod] = useState('SEMUA');
  const [filterCategory, setFilterCategory] = useState('SEMUA');
  const [filterStatus, setFilterStatus] = useState('SEMUA');

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
      setModal('success');
      setSuccessState({
        title: 'Pengeluaran berhasil dicatat',
        message: 'Catatan masuk ke rekap pengeluaran aktif outlet ini.',
      });
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
    if (!editForm.reason.trim()) {
      setError('Alasan koreksi wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      await getApi().editExpense(outletId, target.id, {
        clientTransactionId: uuidv4(),
        amount: String(Number(editForm.amount)),
        expenseDate: toIsoDate(editForm.date),
        description: editForm.description.trim(),
        reason: editForm.reason.trim(),
      });
      setModal('success');
      setSuccessState({
        title: 'Koreksi pengeluaran berhasil',
        message: 'Perubahan nominal dan catatan sudah tercatat di riwayat audit.',
      });
      await loadExpenses();
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
    if (!cancelReason.trim()) {
      setError('Alasan pembatalan wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      await getApi().cancelExpense(outletId, target.id, {
        clientTransactionId: uuidv4(),
        reason: cancelReason.trim(),
      });
      setModal('success');
      setSuccessState({
        title: 'Pengeluaran berhasil dibatalkan',
        message: 'Catatan berstatus dibatalkan dan tidak lagi dihitung pada rekap aktif.',
      });
      await loadExpenses();
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

  const currentMonth = jakartaMonthKey(new Date());
  const periodScoped = useMemo(
    () =>
      expenses.filter(
        (expense) =>
          period !== 'BULAN_INI' ||
          jakartaMonthKey(expense.expenseDate) === currentMonth,
      ),
    [expenses, period, currentMonth],
  );

  const filteredExpenses = useMemo(
    () =>
      periodScoped.filter((expense) => {
        if (
          filterCategory !== 'SEMUA' &&
          expense.category?.id !== filterCategory
        ) {
          return false;
        }
        if (filterStatus !== 'SEMUA' && expenseState(expense) !== filterStatus) {
          return false;
        }
        return true;
      }),
    [periodScoped, filterCategory, filterStatus],
  );

  const summary = useMemo(() => {
    let total = 0;
    let corrected = 0;
    let active = 0;
    let cancelled = 0;
    for (const expense of periodScoped) {
      if (expense.status === 'ACTIVE') {
        total += Number(expense.amount || 0);
        active += 1;
      } else {
        cancelled += 1;
      }
      if (expenseState(expense) === 'Dikoreksi') corrected += 1;
    }
    return { total, corrected, active, cancelled };
  }, [periodScoped]);

  const categoryOptions = useMemo(
    () => [
      { value: 'SEMUA', label: 'Semua' },
      ...categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    ],
    [categories],
  );

  return (
    <AppShell
      navRole={navRole}
      active="biaya"
      title="Pengeluaran outlet"
      subtitle={isOwner ? "Memantau riwayat pengeluaran dan jejak audit outlet." : "Catat tanggal kejadian, kategori, dan nominal. Pengeluaran masuk ke rekap."}
      roleLabel={roleLabel}
      outletLabel={outletLabel}
      scopeLabel={outletLabel}
      contentStyle={styles.container}
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadExpenses} />}
      >
        {error && !modal ? <Notice message={error} type="error" /> : null}

        <View style={styles.summaryGrid}>
          {[
            { label: 'Total periode', value: `Rp ${formatRupiah(summary.total)}` },
            { label: 'Catatan aktif', value: String(summary.active) },
            { label: 'Dikoreksi', value: String(summary.corrected) },
            { label: 'Dibatalkan', value: String(summary.cancelled) },
          ].map((card) => (
            <View key={card.label} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{card.label}</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {card.value}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.filterRow}>
          <FilterChips
            label="Periode"
            options={PERIOD_OPTIONS}
            value={period}
            onChange={setPeriod}
          />
          <FilterChips
            label="Kategori"
            options={categoryOptions}
            value={filterCategory}
            onChange={setFilterCategory}
          />
          <FilterChips
            label="Status"
            options={STATUS_OPTIONS}
            value={filterStatus}
            onChange={setFilterStatus}
          />
        </View>

        <Text style={styles.sectionTitle}>Catatan pengeluaran</Text>
        <Text style={styles.sectionHint}>
          Perubahan nominal dan pembatalan wajib disertai alasan.
        </Text>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.light.primary} />
          </View>
        ) : expenses.length === 0 ? (
          <EmptyState
            title="Belum ada data"
            subtitle="Pengeluaran akan muncul di sini."
          />
        ) : filteredExpenses.length === 0 ? (
          <EmptyState
            title="Tidak ada catatan"
            subtitle="Tidak ada pengeluaran yang cocok dengan filter."
          />
        ) : isTablet ? (
          <Card style={styles.tableCard}>
            <View style={[styles.tr, styles.thead]}>
              <Text style={[styles.th, styles.colDate]}>Tanggal</Text>
              <Text style={[styles.th, styles.colCategory]}>Kategori</Text>
              <Text style={[styles.th, styles.colDescription]}>Keterangan</Text>
              <Text style={[styles.th, styles.colAmount]}>Nominal</Text>
              <Text style={[styles.th, styles.colStatus]}>Status</Text>
              <Text style={[styles.th, styles.colAction]} />
            </View>
            {filteredExpenses.map((expense) => (
              <Pressable
                key={expense.id}
                accessibilityRole="button"
                accessibilityLabel={`Buka detail pengeluaran ${expense.description || expense.id}`}
                onPress={() => setDetail(expense)}
                style={({ pressed }) => [styles.tr, pressed && styles.rowPressed]}
              >
                <Text style={[styles.td, styles.colDate]}>
                  {(expense.expenseDate || '').slice(0, 10)}
                </Text>
                <Text
                  style={[styles.td, styles.colCategory]}
                  numberOfLines={1}
                >
                  {expense.category?.name || '-'}
                </Text>
                <Text
                  style={[styles.td, styles.colDescription]}
                  numberOfLines={1}
                >
                  {expense.description || 'Tanpa keterangan'}
                </Text>
                <Text style={[styles.td, styles.colAmount]}>
                  Rp {formatRupiah(expense.amount)}
                </Text>
                <View style={styles.colStatus}>
                  <Badge
                    label={expenseState(expense)}
                    variant={STATE_VARIANT[expenseState(expense)]}
                  />
                </View>
                <View style={styles.colAction}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => openAudit(expense)}
                    hitSlop={8}
                  >
                    <Text style={styles.auditLink}>Audit</Text>
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </Card>
        ) : (
          filteredExpenses.map((expense) => (
            <Card key={expense.id} style={styles.expenseCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.expenseTitle}>{expense.description || 'Tanpa keterangan'}</Text>
                <Badge
                  label={expenseState(expense)}
                  variant={STATE_VARIANT[expenseState(expense)]}
                />
              </View>
              <Text style={styles.expenseMeta}>
                Rp {formatRupiah(expense.amount)} · {expense.category?.name || '-'} · {(expense.expenseDate || '').slice(0, 10)}
              </Text>
              <View style={styles.rowActions}>
                <TouchableOpacity style={styles.action} onPress={() => setDetail(expense)}>
                  <Text style={styles.actionText}>Detail</Text>
                </TouchableOpacity>
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

        {canManageExpenses ? (
          <BaseButton
            label="Tambah pengeluaran"
            size="lg"
            fullWidth
            onPress={() => {
              setError(null);
              setModal('create');
            }}
          />
        ) : null}
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
        visible={modal === 'success'}
        onClose={() => {
          setModal(null);
          setSuccessState(null);
        }}
        title={successState?.title || 'Berhasil'}
        footer={
          <BaseButton
            label="Tutup"
            variant="secondary"
            size="lg"
            fullWidth
            onPress={() => {
              setModal(null);
              setSuccessState(null);
            }}
          />
        }
      >
        <View style={styles.modalContent}>
          <Text style={styles.successText}>
            {successState?.message || 'Tindakan berhasil disimpan.'}
          </Text>
        </View>
      </Modal>

      <Modal
        visible={modal === 'create'}
        onClose={() => setModal(null)}
        title="Catat Pengeluaran"
        subtitle="Catatan pengeluaran outlet dan jejak koreksinya."
        footer={
          <BaseButton
            label="Simpan Pengeluaran"
            onPress={handleCreate}
            loading={submitting}
            fullWidth
            size="lg"
          />
        }
      >
        <View style={styles.modalContent}>
          {error ? <Notice message={error} type="error" /> : null}
          <Text style={styles.label}>Kategori</Text>
          <View style={styles.chipRow}>
            {Array.isArray(categories) && categories.length > 0 ? (
              categories.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.chip, categoryId === item.id && styles.chipActive]}
                  onPress={() => setCategoryId(item.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      categoryId === item.id && styles.chipTextActive,
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyCategoriesText}>
                Tidak ada kategori tersedia
              </Text>
            )}
          </View>
          <Input
            label="Jumlah (Rp)"
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            keyboardType="numeric"
          />
          <Input
            label="Tanggal"
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            keyboardType="numeric"
          />
          <Input
            label="Deskripsi"
            value={description}
            onChangeText={setDescription}
            placeholder="Keterangan pengeluaran"
          />
        </View>
      </Modal>

      <Modal
        visible={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Detail pengeluaran"
        subtitle="Rincian catatan biaya outlet."
        footer={
          <View style={styles.modalFooter}>
            {canManageExpenses && detail?.status === 'ACTIVE' ? (
              <>
                <BaseButton
                  label="Koreksi catatan"
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onPress={() => {
                    const current = detail;
                    setDetail(null);
                    openEdit(current);
                  }}
                />
                <BaseButton
                  label="Batalkan pengeluaran"
                  variant="danger"
                  size="lg"
                  fullWidth
                  onPress={() => {
                    const current = detail;
                    setDetail(null);
                    openCancel(current);
                  }}
                />
                <Text style={styles.modalHint}>
                  Koreksi dan pembatalan wajib disertai alasan.
                </Text>
              </>
            ) : (
              <BaseButton
                label="Tutup"
                variant="secondary"
                size="lg"
                fullWidth
                onPress={() => setDetail(null)}
              />
            )}
          </View>
        }
      >
        {detail ? (
          <View style={styles.detailContent}>
            <View style={styles.rowBetween}>
              <Badge
                label={detail.status === 'ACTIVE' ? 'Aktif' : 'Dibatalkan'}
                variant={detail.status === 'ACTIVE' ? 'success' : 'danger'}
              />
              <Text style={styles.modalText}>{formatDateTime(detail.createdAt)}</Text>
            </View>
            <Text style={styles.detailId}>ID: {detail.id}</Text>

            <Text style={styles.detailLabel}>Nominal pengeluaran</Text>
            <Text style={styles.detailAmount}>Rp {formatRupiah(detail.amount)}</Text>

            <Text style={styles.detailSection}>Informasi pengeluaran</Text>
            <DetailRow label="Kategori" value={detail.category?.name || '-'} />
            <DetailRow label="Keterangan" value={detail.description || '-'} />
            <DetailRow label="Dicatat oleh" value={detail.createdBy?.name || '-'} />
            <DetailRow
              label="Tanggal pengeluaran"
              value={formatDateTime(detail.expenseDate)}
            />

            <Text style={styles.detailSection}>Riwayat perubahan</Text>
            {(detail.audits ?? []).length === 0 ? (
              <Text style={styles.modalText}>
                Belum ada koreksi atau pembatalan.
              </Text>
            ) : (
              detail.audits.map((row) => (
                <View key={row.id} style={styles.auditRow}>
                  <Text style={styles.auditAction}>
                    {row.action === 'CORRECTED'
                      ? 'Koreksi'
                      : row.action === 'CANCELLED'
                        ? 'Pembatalan'
                        : row.action}
                  </Text>
                  <Text style={styles.modalText}>
                    {row.actor?.name || '-'} · {formatDateTime(row.createdAt)}
                  </Text>
                  {row.reason ? (
                    <Text style={styles.modalText}>Alasan: {row.reason}</Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        ) : null}
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
  sectionHint: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryCard: {
    flexGrow: 1,
    flexBasis: '47%',
    padding: spacing.md,
    gap: 2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surface,
  },
  summaryLabel: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
  },
  summaryValue: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.base,
    color: colors.light.textSecondary,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  filterGroup: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 180,
    gap: spacing.xs,
  },
  filterLabel: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tableCard: { padding: 0, overflow: 'hidden' },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.divider,
  },
  thead: {
    backgroundColor: colors.light.surfaceSecondary,
  },
  th: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
  },
  td: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
  },
  colDate: { flex: 0.9 },
  colCategory: { flex: 1 },
  colDescription: { flex: 1.6 },
  colAmount: { flex: 1, textAlign: 'right' },
  colStatus: { width: 96 },
  colAction: { width: 48, alignItems: 'flex-end' },
  auditLink: {
    ...typography.fontFamily.semibold,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xs,
    color: colors.light.primary,
  },
  rowPressed: { opacity: 0.72 },
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
  modalFooter: { gap: spacing.sm },
  successText: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
    lineHeight: 20,
  },
  modalHint: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
  detailContent: { padding: spacing.md, gap: spacing.sm },
  detailId: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
  },
  detailLabel: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xs,
    color: colors.light.textSecondary,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },
  detailAmount: {
    ...typography.fontFamily.bold,
    ...typography.weights.bold,
    fontSize: typography.sizes.xxl,
    color: colors.light.textPrimary,
  },
  detailSection: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
    marginTop: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.divider,
  },
  detailRowLabel: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  detailRowValue: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
});
