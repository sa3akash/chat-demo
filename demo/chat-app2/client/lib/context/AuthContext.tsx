"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

type CurrentUser = { id: string; username: string; email: string };

type AuthContextValue = {
  user: CurrentUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Single source of truth for "who am I / am I logged in". Owns the token in
 * localStorage + resolves the current user once on mount, so every screen
 * below it can just call useAuth() instead of re-reading localStorage or
 * re-fetching /users/me itself.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!stored) {
      setLoading(false);
      return;
    }
    setToken(stored);
    api
      .me()
      .then((u) => setUser(u as CurrentUser))
      .catch(() => {
        localStorage.removeItem("token");
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    localStorage.setItem("token", result.token);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const register = useCallback(async (email: string, username: string, password: string) => {
    const result = await api.register(email, username, password);
    localStorage.setItem("token", result.token);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, token, loading, login, register, logout }), [user, token, loading, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
