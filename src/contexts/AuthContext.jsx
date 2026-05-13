import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useServices } from "./ServicesContext.jsx";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { authService } = useServices();

  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("access_token");
    return token ? { token, profile: null } : null;
  });

  const loadProfile = useCallback(async () => {
    try {
      const profile = await authService.me();
      setUser((prev) => (prev ? { ...prev, profile } : prev));
    } catch {
      // 401 redirects via api.js; other errors are non-fatal here.
    }
  }, [authService]);

  useEffect(() => {
    if (user?.token && !user.profile) {
      loadProfile();
    }
  }, [user?.token, user?.profile, loadProfile]);

  const login = useCallback(async (email, password) => {
    const data = await authService.login(email, password);
    localStorage.setItem("access_token", data.access_token);
    setUser({ token: data.access_token, profile: null });
  }, [authService]);

  const register = useCallback(async (email, username, password) => {
    const data = await authService.register(email, username, password);
    localStorage.setItem("access_token", data.access_token);
    setUser({ token: data.access_token, profile: null });
  }, [authService]);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile: user?.profile ?? null,
      isAuthenticated: Boolean(user),
      isAdmin: Boolean(user?.profile?.is_admin),
      login,
      register,
      logout,
    }),
    [user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
