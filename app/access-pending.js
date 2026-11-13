import { StyleSheet, Text, View } from "react-native";
import LogoutButton from "../src/components/LogoutButton";
import ScreenFrame from "../src/components/ScreenFrame";
import { colors, spacing } from "../src/theme/tokens";

export default function AccessPendingScreen() {
  return (
    <ScreenFrame>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>Seroo · Akses akun</Text>
        <Text style={styles.title}>Akses outlet belum tersedia</Text>
        <Text style={styles.body}>
          Akun ini belum memiliki membership outlet yang aktif. Hubungi
          administrator untuk meminta akses.
        </Text>
        <LogoutButton />
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
  },
  body: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
});
