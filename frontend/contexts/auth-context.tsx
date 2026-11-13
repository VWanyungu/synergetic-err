"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";

export interface LoginResult {
  token: string;
  refreshToken: string;
  userId: string;
  firstName: string;
  email: string;
  role: string[];
}

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  email: string | null;
  userId: string | null;
  login: (result: LoginResult) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** The user id inside a JWT's payload (read for display and ownership checks only; the server verifies the token). */
function userIdFromToken(token: string | null): string | null {
  try {
    const payload = JSON.parse(atob(token!.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as { userId?: string };
    return payload.userId ?? null;
  } catch {
    return null;
  }
}

// shortcut: the backend returns JWTs in the response body, so they live in localStorage (as in
// Gas Connect). Move to an httpOnly cookie when the backend adopts Better Auth.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // localStorage is client-only, so the session is read after mount to keep hydration matching.
    /* eslint-disable react-hooks/set-state-in-effect */
    setEmail(localStorage.getItem("email") && localStorage.getItem("token") ? localStorage.getItem("email") : null);
    // Sessions opened before the id was stored have only the token, so fall back to reading it from there.
    setUserId(localStorage.getItem("userId") ?? userIdFromToken(localStorage.getItem("token")));
    setIsLoading(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const login = useCallback((r: LoginResult) => {
    localStorage.setItem("token", r.token);
    localStorage.setItem("refreshToken", r.refreshToken);
    localStorage.setItem("email", r.email);
    localStorage.setItem("userId", r.userId);
    setEmail(r.email);
    setUserId(r.userId);
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem("token");
    const refreshToken = localStorage.getItem("refreshToken");
    try {
      await api("/logout", { method: "POST", body: { token, refreshToken } });
    } catch {
      // the local session ends either way
    }
    ["token", "refreshToken", "email", "userId"].forEach((k) => localStorage.removeItem(k));
    setEmail(null);
    setUserId(null);
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated: !!email, isLoading, email, userId, login, logout }),
    [email, userId, isLoading, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
