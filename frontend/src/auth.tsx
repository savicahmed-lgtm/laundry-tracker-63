import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";

import { api, setToken } from "@/src/api";

export type User = {
  id: string;
  phone: string;
  name: string;
  address: string;
  points: number;
  role: "customer" | "admin";
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<User>;
  register: (body: { phone: string; password: string; name: string; address: string }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = async () => {
    try {
      const me = await api.me();
      setUser(me);
    } catch {
      setUser(null);
      await setToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    bootstrap();
  }, []);

  const login = async (phone: string, password: string) => {
    const res = await api.login({ phone, password });
    await setToken(res.access_token);
    setUser(res.user);
    return res.user as User;
  };

  const register = async (body: { phone: string; password: string; name: string; address: string }) => {
    const res = await api.register(body);
    await setToken(res.access_token);
    setUser(res.user);
    return res.user as User;
  };

  const logout = async () => {
    await setToken(null);
    setUser(null);
  };

  const refresh = async () => {
    try {
      const me = await api.me();
      setUser(me);
    } catch {
      /* ignore */
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
