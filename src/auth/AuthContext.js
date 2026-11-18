import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { createAuthClient } from "./sessionClient";
import { setAuthTokenProvider } from "../api/api";
import {
  getInitialOutletContext,
  getSelectedMembership,
} from "./routePolicy";
import { markSessionOutboxesForReview } from "./sessionCleanup";

const AuthContext = createContext(null);

const ANONYMOUS_STATE = {
  status: "anonymous",
  user: null,
  session: null,
  selection: null,
  error: null,
  notice: null,
};

function stateForProfile(profile) {
  return {
    status: "authenticated",
    user: profile.user,
    session: profile.session,
    selection: getInitialOutletContext(profile.user.memberships),
    error: null,
    notice: null,
  };
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    ...ANONYMOUS_STATE,
    status: "loading",
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const clientRef = useRef(null);

  if (!clientRef.current) {
    clientRef.current = createAuthClient({
      apiBaseUrl: process.env.EXPO_PUBLIC_API_URL,
      secureStorage: SecureStore,
      allowInsecureHttp: typeof __DEV__ !== "undefined" && __DEV__,
      onSessionExpired: () => {
        setState({
          ...ANONYMOUS_STATE,
          notice: "Sesi tidak berlaku. Silakan login kembali.",
        });
      },
    });
  }

  const client = clientRef.current;

  useEffect(() => {
    setAuthTokenProvider(() => client.getAccessToken());
    return () => setAuthTokenProvider(null);
  }, [client]);

  useEffect(() => {
    let active = true;
    client
      .restoreSession()
      .then((profile) => {
        if (active) {
          setState(profile ? stateForProfile(profile) : ANONYMOUS_STATE);
        }
      })
      .catch((error) => {
        if (active) {
          setState({
            ...ANONYMOUS_STATE,
            status: "error",
            error: error.message,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [client]);

  const login = useCallback(
    async (credentials) => {
      const profile = await client.login(credentials);
      setState(stateForProfile(profile));
      return profile;
    },
    [client],
  );

  const apiRequest = useCallback(
    (path, options) => client.request(path, options),
    [client],
  );

  const retryRestore = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading", error: null }));
    try {
      const profile = await client.restoreSession();
      setState(profile ? stateForProfile(profile) : ANONYMOUS_STATE);
    } catch (error) {
      setState({
        ...ANONYMOUS_STATE,
        status: "error",
        error: error.message,
      });
    }
  }, [client]);

  const logout = useCallback(async () => {
    const ownerUserId = stateRef.current.user?.id;
    await markSessionOutboxesForReview(ownerUserId);
    try {
      const result = await client.logout();
      setState({
        ...ANONYMOUS_STATE,
        notice: result.notice,
      });
      return result;
    } catch (error) {
      setState({
        ...ANONYMOUS_STATE,
        notice: error.message,
      });
      return { serverConfirmed: false, notice: error.message };
    }
  }, [client]);

  const changePassword = useCallback(
    async (credentials) => {
      const result = await client.changePassword(credentials);
      setState((current) =>
        current.status === "authenticated"
          ? {
              ...current,
              user: { ...current.user, mustChangePassword: false },
            }
          : current,
      );
      return result;
    },
    [client],
  );

  const selectOutlet = useCallback((outletId) => {
    const current = stateRef.current;
    const membership = getSelectedMembership(
      current.user?.memberships,
      outletId,
    );
    if (!membership) {
      throw new Error("Outlet tidak termasuk dalam membership akun ini.");
    }
    setState((value) => ({
      ...value,
      selection: {
        activeOutletId: membership.outletId,
        activeRole: membership.role,
      },
    }));
  }, []);

  const dismissNotice = useCallback(() => {
    setState((current) => ({ ...current, notice: null }));
  }, []);

  const lockForInactivity = useCallback(() => {
    setState((current) =>
      current.status === "authenticated"
        ? { ...current, locked: true, notice: "Layar dikunci karena tidak ada aktivitas." }
        : current,
    );
  }, []);

  const unlockWithLogin = useCallback(() => {
    setState((current) =>
      current.status === "authenticated" ? { ...current, locked: false } : current,
    );
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      login,
      logout,
      changePassword,
      retryRestore,
      selectOutlet,
      dismissNotice,
      lockForInactivity,
      unlockWithLogin,
      apiRequest,
    }),
    [
      state,
      login,
      logout,
      changePassword,
      retryRestore,
      selectOutlet,
      dismissNotice,
      lockForInactivity,
      unlockWithLogin,
      apiRequest,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth harus digunakan di dalam AuthProvider.");
  }
  return context;
}
