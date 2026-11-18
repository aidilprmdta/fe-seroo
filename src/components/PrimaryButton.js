import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/tokens";

export default function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  secondary = false,
  accessibilityLabel,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.secondary : styles.primary,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <Text
            style={[
              styles.label,
              secondary ? styles.secondaryLabel : styles.primaryLabel,
            ]}
          >
            Memproses...
          </Text>
        ) : (
          <Text
            style={[
              styles.label,
              secondary ? styles.secondaryLabel : styles.primaryLabel,
            ]}
          >
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primary: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  secondary: {
    backgroundColor: colors.light.surface,
    borderColor: colors.light.border,
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  primaryLabel: {
    color: colors.light.onPrimary,
  },
  secondaryLabel: {
    color: colors.light.textPrimary,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.82,
  },
});
