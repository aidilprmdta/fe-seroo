// SelectOutletScreen — choose outlet from list
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';
import { resolveLandingRoute } from '../src/auth/routePolicy';
import { OutletsApi } from '../src/api/api';
import { createApiClient } from '../src/api/api';
import ListItem from '../src/components/ListItem';
import EmptyState from '../src/components/EmptyState';
import ScreenFrame from '../src/components/ScreenFrame';
import { colors, spacing, typography, radii } from '../src/theme/tokens';

export default function SelectOutletScreen() {
  const router = useRouter();
  const { user, selection, selectOutlet, status } = useAuth();
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadOutlets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const api = new OutletsApi(client);
      const data = await api.listOutlets();
      setOutlets(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Gagal memuat outlet');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOutlets();
  }, [loadOutlets]);

  const handleSelect = useCallback((outlet) => {
    selectOutlet(outlet.id);
    router.replace(
      resolveLandingRoute(user?.memberships, { activeOutletId: outlet.id }),
    );
  }, [selectOutlet, router, user?.memberships]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOutlets();
  }, [loadOutlets]);

  if (status === 'loading') {
    return (
      <ScreenFrame>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.light.primary} />
          <Text style={styles.text}>Memuat outlet…</Text>
        </View>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {error ? (
          <EmptyState
            title="Tidak dapat memuat outlet"
            subtitle={error}
            action={
              <View style={styles.action}>
                <Text style={styles.retry} onPress={loadOutlets}>Coba lagi</Text>
              </View>
            }
          />
        ) : outlets.length === 0 ? (
          <EmptyState
            icon={<Text style={styles.icon}>🏢</Text>}
            title="Tidak ada outlet"
            subtitle="Belum ada outlet yang terdaftar untuk akun ini."
            action={
              <View style={styles.action}>
                <Text style={styles.retry} onPress={loadOutlets}>Coba lagi</Text>
              </View>
            }
          />
        ) : (
          <>
            <Text style={styles.header}>Outlet</Text>
            {outlets.map(outlet => (
              <ListItem
                key={outlet.id}
                title={outlet.name}
                subtitle={`Kode: ${outlet.code}`}
                leading={
                  <View style={styles.radio}>
                    {selection.activeOutletId === outlet.id ? (
                      <Text style={styles.radioChecked}>●</Text>
                    ) : (
                      <Text style={styles.radioUnchecked}>○</Text>
                    )}
                  </View>
                }
                onPress={() => handleSelect(outlet)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.xl,
    color: colors.light.textPrimary,
    marginBottom: spacing.md,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioChecked: {
    color: colors.light.primary,
    fontSize: 14,
  },
  radioUnchecked: {
    color: colors.light.textSecondary,
    fontSize: 12,
  },
  action: {
    marginTop: spacing.md,
  },
  retry: {
    ...typography.fontFamily.medium,
    ...typography.weights.semibold,
    fontSize: typography.sizes.base,
    color: colors.light.primary,
  },
});
