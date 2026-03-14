import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiGet, apiPost } from "@/constants/api";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: "admin" | "manager" | "viewer";
  mfaEnabled: boolean;
  mustChangePassword: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ requiresMfa: boolean; mfaToken?: string }>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiGet<AuthUser>("/api/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiPost<any>("/api/auth/login", { email, password });
    if (!data.requiresMfa) {
      setUser(data.user);
    }
    return { requiresMfa: data.requiresMfa, mfaToken: data.mfaToken };
  }, []);

  const verifyMfa = useCallback(async (mfaToken: string, code: string) => {
    const data = await apiPost<any>("/api/auth/verify-mfa", { mfaToken, code });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost("/api/auth/logout", {});
    } catch {}
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyMfa, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
