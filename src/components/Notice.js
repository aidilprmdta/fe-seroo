import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme/tokens";

export default function Notice({ message, type = "error" }) {
  if (!message) {
    return null;
  }

  const isError = type === "error";
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.container, isError ? styles.error : styles.info]}
    >
      <Text style={[styles.text, isError && styles.errorText]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    padding: spacing.md,
  },
  error: {
    backgroundColor: colors.dangerSurface,
  },
  info: {
    backgroundColor: colors.infoSurface,
  },
  text: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: colors.danger,
  },
});
