import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const TOKEN_KEY = "loundry_token";

export async function getToken(): Promise<string | null> {
  return storage.secureGet<string>(TOKEN_KEY, "");
}

export async function setToken(token: string | null) {
  if (token) await storage.secureSet(TOKEN_KEY, token);
  else await storage.secureRemove(TOKEN_KEY);
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data?.detail || `Terjadi kesalahan (${res.status})`);
  }
  return data as T;
}

export const api = {
  register: (body: { phone: string; password: string; name: string; address: string }) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { phone: string; password: string }) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request("/auth/me"),
  updateMe: (body: { name?: string; address?: string }) =>
    request("/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
  catalog: () => request("/catalog"),
  createOrder: (body: any) => request("/orders", { method: "POST", body: JSON.stringify(body) }),
  orders: () => request("/orders"),
  order: (id: string) => request(`/orders/${id}`),
  pay: (id: string) => request(`/orders/${id}/pay`, { method: "POST" }),
  setStatus: (id: string, statusValue: string) =>
    request(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: statusValue }) }),
  courier: (id: string) => request(`/orders/${id}/courier`),
  feedback: (id: string, body: { rating: number; comment: string }) =>
    request(`/orders/${id}/feedback`, { method: "POST", body: JSON.stringify(body) }),
};

export { request };
