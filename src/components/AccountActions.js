// AccountActions — akses cepat Profil & Keluar dari dashboard
import React from 'react';
import { View, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../auth/AuthContext';
import { ROUTES } from '../auth/routePolicy';
import BaseButton from './BaseButton';
import { spacing } from '../theme/tokens';

export default function AccountActions() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const canSwitchOutlet = (user?.memberships || []).length > 1;

  const handleLogout = () => {
    Alert.alert('Keluar dari Seroo?', 'Anda akan diminta login kembali.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <View style={styles.row}>
      {canSwitchOutlet && (
        <View style={styles.button}>
          <BaseButton
            label="Ganti Outlet"
            onPress={() => router.push(ROUTES.selectOutlet)}
            size="md"
            variant="outline"
            fullWidth
          />
        </View>
      )}
      <View style={styles.button}>
        <BaseButton
          label="Notifikasi"
          onPress={() => router.push(ROUTES.notifications)}
          size="md"
          variant="outline"
          fullWidth
        />
      </View>
      <View style={styles.button}>
        <BaseButton
          label="Profil"
          onPress={() => router.push(ROUTES.profile)}
          size="md"
          variant="secondary"
          fullWidth
        />
      </View>
      <View style={styles.button}>
        <BaseButton
          label="Keluar"
          onPress={handleLogout}
          size="md"
          variant="danger"
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  button: { flex: 1, minWidth: 120 },
});
