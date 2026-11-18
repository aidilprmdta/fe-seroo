import { Stack } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useSerooFonts } from "../src/theme/fonts";
import { colors } from "../src/theme/tokens";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import AutoLockGate from "../src/auth/AutoLockGate";
import {
  isAllowedRoute,
  resolveLandingRoute,
  ROUTES,
} from "../src/auth/routePolicy";

function GuardedStack() {
  const { status, user, selection } = useAuth();
  const memberships = user?.memberships ?? [];
  const landingRoute = resolveLandingRoute(memberships, selection);
  const authenticated = status === "authenticated";
  const passwordChangeRequired = user?.mustChangePassword === true;

  return (
    <AutoLockGate>
      <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/ganti-password" />

      <Stack.Protected
        guard={status === "anonymous" || status === "error"}
        redirectTo="/"
      >
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/bantuan-reset-password" />
        <Stack.Screen name="auth/cooldown" />
      </Stack.Protected>

      <Stack.Protected
        guard={authenticated}
        redirectTo="/"
      >
        <Stack.Screen name="profile" />
        <Stack.Screen name="help-faq" />
        <Stack.Screen name="notifications" />

        <Stack.Protected
          guard={!passwordChangeRequired}
          redirectTo={ROUTES.profile}
        >
          <Stack.Protected
            guard={isAllowedRoute(ROUTES.selectOutlet, memberships, selection)}
            redirectTo={landingRoute}
          >
            <Stack.Screen name="select-outlet" />
          </Stack.Protected>

          <Stack.Protected
            guard={isAllowedRoute(
              ROUTES.accessPending,
              memberships,
              selection,
            )}
            redirectTo={landingRoute}
          >
            <Stack.Screen name="access-pending" />
          </Stack.Protected>

          <Stack.Protected
            guard={isAllowedRoute(ROUTES.crew, memberships, selection)}
            redirectTo={landingRoute}
          >
            <Stack.Screen name="crew" />
            <Stack.Screen name="crew/pos" />
            <Stack.Screen name="crew/orders" />
          </Stack.Protected>

          <Stack.Protected
            guard={isAllowedRoute(ROUTES.inventory, memberships, selection)}
            redirectTo={landingRoute}
          >
            <Stack.Screen name="inventory" />
            <Stack.Screen name="waste" />
          </Stack.Protected>

          <Stack.Protected
            guard={isAllowedRoute(
              ROUTES.stockRequests,
              memberships,
              selection,
            )}
            redirectTo={landingRoute}
          >
            <Stack.Screen name="stock-requests" />
          </Stack.Protected>

          <Stack.Protected
            guard={isAllowedRoute(
              ROUTES.adminDashboard,
              memberships,
              selection,
            )}
            redirectTo={landingRoute}
          >
            <Stack.Screen name="admin/dashboard" />
            <Stack.Screen name="admin/catalog" />
            <Stack.Screen name="admin/accounts" />
            <Stack.Screen name="admin/audit" />
            <Stack.Screen name="admin/outlets" />
          </Stack.Protected>

          <Stack.Protected
            guard={isAllowedRoute(ROUTES.manager, memberships, selection)}
            redirectTo={landingRoute}
          >
            <Stack.Screen name="manager/dashboard" />
          </Stack.Protected>

          <Stack.Protected
            guard={isAllowedRoute(ROUTES.owner, memberships, selection)}
            redirectTo={landingRoute}
          >
            <Stack.Screen name="owner/dashboard" />
          </Stack.Protected>

          <Stack.Protected
            guard={isAllowedRoute(ROUTES.expenses, memberships, selection)}
            redirectTo={landingRoute}
          >
            <Stack.Screen name="expenses" />
          </Stack.Protected>

          <Stack.Protected
            guard={isAllowedRoute(ROUTES.reports, memberships, selection)}
            redirectTo={landingRoute}
          >
            <Stack.Screen name="reports" />
            <Stack.Screen name="owner/outlet-members" />
          </Stack.Protected>

          <Stack.Protected
            guard={isAllowedRoute(ROUTES.closings, memberships, selection)}
            redirectTo={landingRoute}
          >
            <Stack.Screen name="closings" />
          </Stack.Protected>
        </Stack.Protected>
      </Stack.Protected>
      </Stack>
    </AutoLockGate>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useSerooFonts();

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.light.background }}>
        <ActivityIndicator size="large" color={colors.light.primary} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <GuardedStack />
    </AuthProvider>
  );
}