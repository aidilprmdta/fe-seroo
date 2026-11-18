import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { shouldAutoLock } from "./autoLockPolicy";
import { colors, spacing } from "../theme/tokens";

export default function AutoLockGate({ children }) {
  const { status, locked, lockForInactivity, logout } = useAuth();
  const lastActivityRef = useRef(Date.now());
  const backgroundAtRef = useRef(null);
  const [now, setNow] = useState(Date.now());

  const markActivity = useCallback(() => {
    if (status !== "authenticated" || locked) return;
    lastActivityRef.current = Date.now();
    setNow(lastActivityRef.current);
  }, [locked, status]);

  useEffect(() => {
    if (status !== "authenticated" || locked) return undefined;
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (shouldAutoLock(lastActivityRef.current, current)) {
        lockForInactivity();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockForInactivity, locked, status]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") {
        backgroundAtRef.current = Date.now();
        return;
      }
      if (nextState === "active" && backgroundAtRef.current) {
        const current = Date.now();
        setNow(current);
        if (shouldAutoLock(backgroundAtRef.current, current)) {
          lockForInactivity();
        } else {
          markActivity();
        }
        backgroundAtRef.current = null;
      }
    });
    return () => subscription.remove();
  }, [lockForInactivity, markActivity]);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  return (
    <View style={styles.root} onTouchStart={markActivity}>
      {children}
      {status === "authenticated" && locked ? (
        <View style={styles.overlay} accessibilityViewIsModal>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>Seroo · Keamanan</Text>
            <Text style={styles.title}>Layar dikunci</Text>
            <Text style={styles.body}>
              Layar dikunci setelah tidak ada aktivitas selama 10 menit. Login ulang diperlukan untuk melanjutkan.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Login ulang"
              onPress={handleLogout}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Login ulang</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.96)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.md,
  },
  eyebrow: { color: colors.light.textSecondary, fontSize: 13, fontWeight: "700" },
  title: { color: colors.light.textPrimary, fontSize: 28, fontWeight: "800" },
  body: { color: colors.light.textSecondary, fontSize: 15, lineHeight: 22 },
  button: {
    minHeight: 52,
    borderRadius: 10,
    backgroundColor: colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonText: { color: colors.light.onPrimary ?? "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
