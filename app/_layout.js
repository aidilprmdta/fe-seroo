import { Stack } from "expo-router";
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

      <Stack.Protected
        guard={status === "anonymous" || status === "error"}
        redirectTo="/"
      >
        <Stack.Screen name="auth/login" />
      </Stack.Protected>

      <Stack.Protected
        guard={authenticated}
        redirectTo="/"
      >
        <Stack.Screen name="profile" />

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
              ROUTES.adminCatalog,
              memberships,
              selection,
            )}
            redirectTo={landingRoute}
          >
            <Stack.Screen name="admin/catalog" />
            <Stack.Screen name="admin/accounts" />
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
  return (
    <AuthProvider>
      <GuardedStack />
    </AuthProvider>
  );
}