import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { shouldAutoLock, AUTO_LOCK_TIMEOUT_MS } from "./autoLockPolicy";
import { colors, spacing } from "../theme/tokens";

if (__DEV__) {
  console.log("[auto-lock] gate loaded (session guard v5)");
}

export default function AutoLockGate({ children }) {
  const {
    status,
    locked,
    authenticatedAt,
    lockForInactivity,
    unlockWithLogin,
    logout,
  } = useAuth();
  const lastActivityRef = useRef(Date.now());
  const backgroundAtRef = useRef(null);
  const sessionStartedAtRef = useRef(0);

  // Sesi baru belum mungkin idle 10 menit. Lock yang datang lebih awal dari itu
  // pasti berasal dari timestamp lama/event telat, jadi jangan ditampilkan.
  const lockAllowed =
    Number.isFinite(authenticatedAt) &&
    Date.now() - authenticatedAt >= AUTO_LOCK_TIMEOUT_MS;

  const markActivity = useCallback(() => {
    if (status !== "authenticated" || locked) return;
    lastActivityRef.current = Date.now();
  }, [locked, status]);

  useEffect(() => {
    if (status !== "authenticated" || locked) return undefined;
    // Sesi baru (restore/login/unlock) harus mulai dari jam idle nol; ref bisa
    // masih menyimpan waktu mount lama setelah Fast Refresh dan langsung mengunci.
    const startedAt = Date.now();
    lastActivityRef.current = startedAt;
    sessionStartedAtRef.current = startedAt;
    backgroundAtRef.current = null;
    const interval = setInterval(() => {
      const current = Date.now();
      if (shouldAutoLock(lastActivityRef.current, current)) {
        if (__DEV__) {
          console.log("[auto-lock] lock via idle", {
            idleMs: current - lastActivityRef.current,
          });
        }
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
        // Abaikan waktu background dari sebelum sesi ini login, supaya event
        // AppState yang telat tidak langsung mengunci sesi yang baru dibuka.
        const idleSince = Math.max(
          backgroundAtRef.current,
          sessionStartedAtRef.current,
        );
        if (shouldAutoLock(idleSince, current)) {
          if (__DEV__) {
            console.log("[auto-lock] lock via resume", {
              idleMs: current - idleSince,
            });
          }
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

  useEffect(() => {
    if (status !== "authenticated" || !locked || lockAllowed) return;
    if (__DEV__) {
      console.log("[auto-lock] early lock cleared", {
        sessionAgeMs: Date.now() - authenticatedAt,
      });
    }
    unlockWithLogin();
  }, [authenticatedAt, lockAllowed, locked, status, unlockWithLogin]);

  // onTouchStart hanya terpanggil bila View ini yang jadi responder, sehingga
  // ketukan pada Pressable/tombol anak tidak pernah mereset idle. Capture selalu
  // dipanggil untuk setiap sentuhan dan tidak merebut gesture anak.
  if (status === "authenticated" && locked && lockAllowed) {
    return (
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
    );
  }

  return (
    <View
      style={styles.root}
      onStartShouldSetResponderCapture={() => {
        markActivity();
        return false;
      }}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    backgroundColor: colors.surface ?? "#FFFFFF",
    padding: spacing.xl,
    gap: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
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
