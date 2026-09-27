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
  scan: (code: string) => request("/orders/scan", { method: "POST", body: JSON.stringify({ code }) }),
  setItems: (id: string, body: { items: { key: string; qty: number }[]; weight_kg: number }) =>
    request(`/orders/${id}/items`, { method: "PATCH", body: JSON.stringify(body) }),
  pay: (id: string, usePoints = false) =>
    request(`/orders/${id}/pay`, { method: "POST", body: JSON.stringify({ use_points: usePoints }) }),
  setStatus: (id: string, statusValue: string) =>
    request(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: statusValue }) }),
  confirmReceived: (id: string) =>
    request(`/orders/${id}/confirm-received`, { method: "POST" }),
  rewash: (id: string, body: { reason: string; photos: string[] }) =>
    request(`/orders/${id}/rewash`, { method: "POST", body: JSON.stringify(body) }),
  courier: (id: string) => request(`/orders/${id}/courier`),
  feedback: (id: string, body: { rating: number; comment: string }) =>
    request(`/orders/${id}/feedback`, { method: "POST", body: JSON.stringify(body) }),
  addPhotos: (id: string, paths: string[]) =>
    request(`/orders/${id}/photos`, { method: "POST", body: JSON.stringify({ paths }) }),
  promos: () => request("/promos"),
  pointsHistory: () => request("/points/history"),
  notifications: () => request("/notifications"),
  readAllNotifications: () => request("/notifications/read-all", { method: "POST" }),
  readNotification: (nid: string) => request(`/notifications/${nid}/read`, { method: "POST" }),
  addresses: () => request("/addresses"),
  addAddress: (body: { label: string; detail: string; is_default?: boolean }) =>
    request("/addresses", { method: "POST", body: JSON.stringify(body) }),
  updateAddress: (aid: string, body: { label?: string; detail?: string; is_default?: boolean }) =>
    request(`/addresses/${aid}`, { method: "PATCH", body: JSON.stringify(body) }),
  setDefaultAddress: (aid: string) => request(`/addresses/${aid}/default`, { method: "POST" }),
  deleteAddress: (aid: string) => request(`/addresses/${aid}`, { method: "DELETE" }),
  adminReport: () => request("/admin/report"),
};

// Build an authenticated image URL (token in query so <Image> works on web too).
export async function fileUrl(path: string): Promise<string> {
  const token = await getToken();
  return `${BASE}/api/files/${path}?token=${token ?? ""}`;
}

// Upload a picked image (branches body shape for web vs native).
export async function uploadImage(uri: string, name: string, type: string): Promise<string> {
  const token = await getToken();
  const form = new FormData();
  if (typeof document !== "undefined") {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, name);
  } else {
    form.append("file", { uri, name, type } as any);
  }
  const res = await fetch(`${BASE}/api/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data?.detail || "Gagal mengunggah");
  return data.path as string;
}

export { request };
