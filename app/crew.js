import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { ROUTES } from "../src/auth/routePolicy";
import { useAuth } from "../src/auth/AuthContext";
import LogoutButton from "../src/components/LogoutButton";
import Notice from "../src/components/Notice";
import PrimaryButton from "../src/components/PrimaryButton";
import ProfileButton from "../src/components/ProfileButton";
import ScreenFrame from "../src/components/ScreenFrame";
import { colors, spacing } from "../src/theme/tokens";

const modules = [
  { name: "POS", route: ROUTES.crewPos },
  { name: "Riwayat Transaksi", route: ROUTES.crewOrders },
  { name: "Stok", route: ROUTES.inventory },
  { name: "Permintaan stok", route: ROUTES.stockRequests },
  { name: "Waste", route: ROUTES.waste },
];

export default function CrewScreen() {
  const { user, selection, notice } = useAuth();
  const { width } = useWindowDimensions();
  const membership = user.memberships.find(
    (item) => item.outletId === selection.activeOutletId,
  );

  return (
    <ScreenFrame>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.layout, width >= 800 && styles.wideLayout]}>
          <View style={styles.sidebar}>
            <Text style={styles.eyebrow}>Seroo · Crew</Text>
            <Text style={styles.title}>Operasional outlet</Text>
            <View style={styles.outlet}>
              <Text style={styles.outletLabel}>Outlet aktif</Text>
              <Text style={styles.outletName}>
                {membership?.outletName ?? "Outlet tidak tersedia"}
              </Text>
              <Text style={styles.outletCode}>
                {membership?.outletCode} · {membership?.role}
              </Text>
            </View>

            <View style={styles.moduleList}>
              <Text style={styles.sectionTitle}>Navigasi operasional</Text>
              {modules.map((module) => (
                <Pressable
                  key={module.name}
                  accessibilityRole={module.route ? "button" : undefined}
                  disabled={!module.route}
                  onPress={() => module.route && router.push(module.route)}
                  style={[
                    styles.moduleRow,
                    module.name === "POS" && styles.currentModule,
                    !module.route && styles.disabledModule,
                  ]}
                >
                  <Text style={styles.moduleName}>{module.name}</Text>
                  {!module.route ? (
                    <Text style={styles.moduleStatus}>Dalam Pengembangan</Text>
                  ) : null}
                </Pressable>
              ))}
            </View>

            {user.memberships.length > 1 ? (
              <PrimaryButton
                label="Ganti outlet"
                secondary
                onPress={() => router.push(ROUTES.selectOutlet)}
              />
            ) : null}
            <ProfileButton />
            <Notice message={notice} type="info" />
            <LogoutButton />
          </View>

          <View style={styles.main}>
            <Text style={styles.posEyebrow}>Modul utama Crew</Text>
            <Text style={styles.posTitle}>POS</Text>
            <Text style={styles.body}>
              Buka katalog outlet, susun keranjang, lalu kirim transaksi untuk
              dikalkulasi dan dikonfirmasi oleh server.
            </Text>
            <PrimaryButton
              label="Buka POS"
              onPress={() => router.push(ROUTES.crewPos)}
            />
          </View>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  layout: {
    flex: 1,
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    gap: spacing.lg,
  },
  wideLayout: {
    flexDirection: "row",
  },
  sidebar: {
    flex: 1,
    minWidth: 260,
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  main: {
    flex: 2,
    minHeight: 360,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    justifyContent: "center",
    gap: spacing.md,
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
    fontSize: 24,
    fontWeight: "800",
  },
  outlet: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  outletLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  outletName: {
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: "700",
  },
  outletCode: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  moduleList: {
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  moduleRow: {
    minHeight: 48,
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  currentModule: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  moduleName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  moduleStatus: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  disabledModule: {
    opacity: 0.7,
  },
  posEyebrow: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  posTitle: {
    color: colors.textPrimary,
    fontSize: 36,
    fontWeight: "800",
  },
  body: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 23,
  },
});
