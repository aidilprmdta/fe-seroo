import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../src/auth/AuthContext";
import { resolveLandingRoute } from "../src/auth/routePolicy";
import LogoutButton from "../src/components/LogoutButton";
import PrimaryButton from "../src/components/PrimaryButton";
import ScreenFrame from "../src/components/ScreenFrame";
import { colors, spacing } from "../src/theme/tokens";

const ROLE_LABELS = {
  CREW: "Crew",
  MANAGER: "Manager",
  OWNER: "Owner",
};

export default function SelectOutletScreen() {
  const { user, selection, selectOutlet } = useAuth();
  const [pendingRoute, setPendingRoute] = useState(null);
  const memberships = user.memberships;

  useEffect(() => {
    if (
      pendingRoute &&
      selection?.activeOutletId === pendingRoute.activeOutletId &&
      selection?.activeRole === pendingRoute.activeRole
    ) {
      router.replace(pendingRoute.route);
      setPendingRoute(null);
    }
  }, [pendingRoute, selection]);

  function handleSelectOutlet(membership) {
    const selection = {
      activeOutletId: membership.outletId,
      activeRole: membership.role,
    };
    selectOutlet(membership.outletId);
    setPendingRoute({
      ...selection,
      route: resolveLandingRoute(memberships, selection),
    });
  }

  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Seroo · Konteks akses</Text>
          <Text style={styles.title}>Pilih outlet</Text>
          <Text style={styles.subtitle}>
            Pilih outlet sesuai membership dan role yang diberikan.
          </Text>
        </View>

        <View style={styles.list}>
          {memberships.map((membership) => (
            <PrimaryButton
              key={membership.outletId}
              label={`${membership.outletName} · ${membership.outletCode} · ${ROLE_LABELS[membership.role]}`}
              secondary
              disabled={Boolean(pendingRoute)}
              loading={Boolean(pendingRoute)}
              onPress={() => handleSelectOutlet(membership)}
              accessibilityLabel={`Pilih ${membership.outletName}, ${ROLE_LABELS[membership.role]}`}
            />
          ))}
        </View>

        <LogoutButton />
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 23,
  },
  list: {
    gap: spacing.sm,
  },
});
