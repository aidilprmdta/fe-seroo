import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/tokens";

export default function SessionLoading() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.light.primary} size="large" />
      <Text style={styles.label}>Memulihkan sesi...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.light.background,
    padding: 24,
  },
  label: {
    color: colors.light.textSecondary,
    fontSize: 16,
  },
});
