// OutletMembersScreen — kelola anggota outlet (Owner Mitra / Admin Pusat)
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { createOutletAccessApi } from '../../src/api/outlets';
import { createApiClient } from '../../src/api/api';
import Input from '../../src/components/Input';
import BaseButton from '../../src/components/BaseButton';
import Notice from '../../src/components/Notice';
import Badge from '../../src/components/Badge';
import EmptyState from '../../src/components/EmptyState';
import ScreenFrame from '../../src/components/ScreenFrame';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';

const ROLE_OPTIONS = ['CREW', 'MANAGER'];

export default function OutletMembersScreen() {
  const { selection } = useAuth();
  const outletId = selection?.activeOutletId;
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('CREW');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadMembers = useCallback(async () => {
    try {
      const client = createApiClient();
      const api = createOutletAccessApi({ request: client });
      const response = await api.getMembers(outletId);
      setMembers(response?.data?.members || []);
    } catch (err) {
      setError(err?.message || 'Daftar anggota gagal dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [outletId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleAssign = useCallback(async () => {
    setError(null);
    if (!email.trim()) {
      setError('Masukkan email pengguna.');
      return;
    }
    setSubmitting(true);
    try {
      const client = createApiClient();
      const api = createOutletAccessApi({ request: client });
      await api.assignMember(outletId, { email: email.trim().toLowerCase(), role });
      setEmail('');
      Alert.alert('Berhasil', 'Anggota outlet berhasil ditambahkan.');
      loadMembers();
    } catch (err) {
      setError(err?.message || 'Gagal menambahkan anggota.');
    } finally {
      setSubmitting(false);
    }
  }, [email, role, outletId, loadMembers]);

  const handleRemove = useCallback((member) => {
    Alert.alert(
      'Cabut akses',
      `Hapus akses ${member.name} dari outlet ini?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Cabut',
          style: 'destructive',
          onPress: async () => {
            try {
              const client = createApiClient();
              const api = createOutletAccessApi({ request: client });
              await api.removeMember(outletId, member.userId);
              loadMembers();
            } catch (err) {
              setError(err?.message || 'Gagal mencabut akses.');
            }
          },
        },
      ],
    );
  }, [outletId, loadMembers]);

  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadMembers} />}
      >
        <Text style={styles.title}>Kelola Anggota Outlet</Text>
        <Text style={styles.subtitle}>Outlet: {outletId}</Text>

        {error && <Notice message={error} type="error" />}

        <View style={styles.form}>
          <Input
            label="Email pengguna"
            value={email}
            onChangeText={setEmail}
            placeholder="nama@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View style={styles.roleRow}>
            {ROLE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.roleChip, role === option && styles.roleChipActive]}
                onPress={() => setRole(option)}
              >
                <Text style={[styles.roleText, role === option && styles.roleTextActive]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <BaseButton
            label="Tambahkan Anggota"
            onPress={handleAssign}
            loading={submitting}
            fullWidth
            size="lg"
          />
        </View>

        <Text style={styles.sectionTitle}>Anggota Saat Ini</Text>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.light.primary} />
          </View>
        ) : members.length === 0 ? (
          <EmptyState
            icon={<Text style={styles.icon}>👥</Text>}
            title="Belum ada anggota"
            subtitle="Tambahkan staf melalui form di atas."
          />
        ) : (
          members.map((member) => (
            <View key={member.membershipId} style={styles.memberRow}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberEmail}>{member.email}</Text>
                <Badge label={member.role} />
              </View>
              <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(member)}>
                <Text style={styles.removeText}>Cabut</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
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
  form: { gap: spacing.md, marginTop: spacing.sm },
  roleRow: { flexDirection: 'row', gap: spacing.sm },
  roleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.surface,
  },
  roleChipActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  roleText: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  roleTextActive: { color: colors.light.onPrimary },
  sectionTitle: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
    marginTop: spacing.lg,
  },
  loading: { padding: spacing.xl, alignItems: 'center' },
  icon: { fontSize: 40 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.light.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  memberInfo: { gap: spacing.xs, flex: 1 },
  memberName: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.textPrimary,
  },
  memberEmail: {
    ...typography.fontFamily.regular,
    fontSize: typography.sizes.sm,
    color: colors.light.textSecondary,
  },
  removeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.light.dangerSurface,
  },
  removeText: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.sm,
    color: colors.light.danger,
  },
});
