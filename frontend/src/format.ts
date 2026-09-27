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
