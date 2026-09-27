export const STATUS_FLOW = ["diterima", "lunas", "dicuci", "disetrika", "siap", "selesai"] as const;
export type OrderStatus = (typeof STATUS_FLOW)[number];

export const STATUS_META: Record<
  OrderStatus,
  { label: string; icon: string; desc: string }
> = {
  diterima: { label: "Diterima", icon: "receipt-outline", desc: "Pesanan diterima" },
  lunas: { label: "Lunas", icon: "cash-outline", desc: "Pembayaran lunas" },
  dicuci: { label: "Dicuci", icon: "water-outline", desc: "Sedang dicuci" },
  disetrika: { label: "Disetrika", icon: "flame-outline", desc: "Sedang disetrika" },
  siap: { label: "Siap diambil/diantar", icon: "checkmark-done-outline", desc: "Siap diambil/diantar" },
  selesai: { label: "Selesai", icon: "sparkles-outline", desc: "Pesanan selesai" },
};

export function statusIndex(s: string): number {
  return STATUS_FLOW.indexOf(s as OrderStatus);
}

export function nextStatus(s: string): OrderStatus | null {
  const i = statusIndex(s);
  if (i < 0 || i >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[i + 1];
}

export function formatRp(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const ROLE_CAN_SET: Record<string, string[]> = {
  admin: ["dicuci", "disetrika", "siap", "selesai"],
  admin_cuci: ["dicuci"],
  admin_setrika: ["disetrika"],
  admin_cabang: ["siap", "selesai"],
  admin_antar: ["selesai"],
};

export type AdminAction =
  | { kind: "input" }
  | { kind: "status"; target: OrderStatus; label: string; scan: boolean }
  | null;

// What the given admin role can do on this order right now.
export function adminAction(role: string, order: any): AdminAction {
  if (!order) return null;
  if ((role === "admin" || role === "admin_cabang") && order.status === "diterima") {
    return { kind: "input" };
  }
  const target = nextStatus(order.status);
  if (!target) return null;
  const allowed = ROLE_CAN_SET[role] ?? [];
  if (!allowed.includes(target)) return null;
  // selesai routing: pickup delivered by admin_antar; branch pickup closed by admin_cabang.
  if (target === "selesai") {
    if (role === "admin_antar" && order.service !== "pickup") return null;
    if (role === "admin_cabang" && order.service === "pickup") return null;
  }
  const scanRoles = ["admin_cuci", "admin_setrika", "admin_antar"];
  const label = STATUS_META[target].label;
  return { kind: "status", target, label, scan: scanRoles.includes(role) };
}
