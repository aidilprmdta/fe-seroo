import { router } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ROUTES } from "../auth/routePolicy";
import { useAuth } from "../auth/AuthContext";
import { colors, spacing } from "../theme/tokens";
import LogoutButton from "./LogoutButton";
import Notice from "./Notice";
import PrimaryButton from "./PrimaryButton";
import ProfileButton from "./ProfileButton";
import ScreenFrame from "./ScreenFrame";

export default function RoleShell({
  title,
  role,
  emptyState,
  readOnly = false,
  actions = [],
}) {
  const { user, selection, notice } = useAuth();
  const memberships = user.memberships;
  const selectedOutlet = memberships.find(
    (membership) => membership.outletId === selection.activeOutletId,
  );
  const outletLabel = selectedOutlet?.outletName ?? "Outlet belum dipilih";

  return (
    <ScreenFrame>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Seroo · {role}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>
              {user.name} · {readOnly ? "Akses baca saja" : role}
            </Text>
          </View>
          {memberships.length > 1 ? (
            <PrimaryButton
              label="Pilih outlet"
              secondary
              onPress={() => router.push(ROUTES.selectOutlet)}
            />
          ) : null}
        </View>

        <View style={styles.context}>
          <Text style={styles.contextLabel}>Outlet aktif</Text>
          <Text style={styles.contextTitle}>{outletLabel}</Text>
          {selectedOutlet ? (
            <Text style={styles.contextDetail}>
              {selectedOutlet.outletCode} · {selectedOutlet.role}
            </Text>
          ) : null}
        </View>

        <View style={styles.emptyState}>
          <Text style={styles.status}>Dalam Pengembangan</Text>
          <Text style={styles.emptyTitle}>{title}</Text>
          <Text style={styles.emptyText}>{emptyState}</Text>
        </View>

        {actions.length ? (
          <View style={styles.actions}>
            {actions.map((action) => (
              <PrimaryButton
                key={action.label}
                label={action.label}
                onPress={action.onPress}
                secondary={action.secondary}
              />
            ))}
          </View>
        ) : null}

        <Notice message={notice} type="info" />
        <View style={styles.footer}>
          <ProfileButton />
          <LogoutButton />
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 960,
    alignSelf: "center",
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    minWidth: 220,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  context: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  contextLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  contextTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
  contextDetail: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    minHeight: 220,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  status: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 23,
  },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
