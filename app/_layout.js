import { Stack } from "expo-router";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
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

  return (
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
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <GuardedStack />
    </AuthProvider>
  );
}