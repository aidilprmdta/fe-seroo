import { Redirect } from "expo-router";
import { useAuth } from "../src/auth/AuthContext";
import { resolveLandingRoute, ROUTES } from "../src/auth/routePolicy";
import SessionLoading from "../src/components/SessionLoading";

export default function IndexScreen() {
  const { status, user, selection } = useAuth();
  if (status === "loading") {
    return <SessionLoading />;
  }
  if (status !== "authenticated") {
    return <Redirect href={ROUTES.login} />;
  }
  if (user?.mustChangePassword === true) {
    return <Redirect href={ROUTES.changePassword} />;
  }
  return <Redirect href={resolveLandingRoute(user.memberships, selection)} />;
}

