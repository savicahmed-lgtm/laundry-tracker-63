import { Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { formatRp, formatDate } from "@/src/format";
import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

/**
 * Kartu rincian item pesanan.
 * Dipakai di detail pesanan (pelanggan & admin) dan di layar verifikasi scan,
 * agar petugas di setiap tahap proses (cuci / setrika / antar / serah-terima)
 * dapat mencocokkan cucian fisik dengan data pesanan.
 */
export function OrderItemsCard({ order, testID }: { order: any; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();

  const items: any[] = order?.items ?? [];
  const totalQty = items.reduce((s: number, i: any) => s + (i.qty || 0), 0);
  const weight = order?.weight_kg || 0;
  const kgRate = order?.kg_rate || 0;
  const kiloanTotal = Math.round(weight * kgRate);
  const displayTotal = (order?.total ?? 0) > 0 ? order.total : (order?.subtotal ?? 0);
  const empty = items.length === 0 && weight <= 0;

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.head}>
        <Text style={styles.title}>Rincian Item</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{totalQty} item</Text>
        </View>
      </View>

      {/* Info treatment & berat */}
      {order?.treatment_label || weight > 0 ? (
        <View style={styles.chipRow}>
          {order?.treatment_label ? (
            <View style={styles.chip}>
              <Ionicons name="sparkles-outline" size={12} color={colors.brandPrimary} />
              <Text style={styles.chipText}>{order.treatment_label}</Text>
            </View>
          ) : null}
          {weight > 0 ? (
            <View style={styles.chip}>
              <Ionicons name="scale-outline" size={12} color={colors.brandPrimary} />
              <Text style={styles.chipText}>{weight} kg</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {empty ? (
        <View style={styles.emptyBox}>
          <Ionicons name="file-tray-outline" size={22} color={colors.muted} />
          <Text style={styles.emptyText}>Item belum diinput oleh admin cabang</Text>
        </View>
      ) : (
        <>
          {items.map((it: any) => (
            <View key={it.key} style={styles.itemRow} testID={testID ? `${testID}-${it.key}` : undefined}>
              <View style={styles.itemIcon}>
                <Ionicons name={(it.icon || "cube-outline") as any} size={18} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.name}</Text>
                <Text style={styles.itemMeta}>
                  {it.pricing === "satuan" ? `Satuan · ${formatRp(it.price)}/pcs` : "Kiloan · dihitung per kg"}
                </Text>
              </View>
              <View style={styles.qtyBadge}>
                <Text style={styles.qtyText}>×{it.qty}</Text>
              </View>
              {it.pricing === "satuan" ? (
                <Text style={styles.lineTotal}>{formatRp(it.line_total ?? it.price * it.qty)}</Text>
              ) : null}
            </View>
          ))}

          {weight > 0 ? (
            <View style={styles.itemRow}>
              <View style={styles.itemIcon}>
                <Ionicons name="scale-outline" size={18} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>Berat cucian (kiloan)</Text>
                <Text style={styles.itemMeta}>
                  {weight} kg × {formatRp(kgRate)}/kg
                </Text>
              </View>
              <Text style={styles.lineTotal}>{formatRp(kiloanTotal)}</Text>
            </View>
          ) : null}

          {order?.discount > 0 ? (
            <View style={styles.sumRow}>
              <Text style={[styles.sumLabel, { color: colors.brandPrimary }]}>Diskon poin</Text>
              <Text style={[styles.sumValue, { color: colors.brandPrimary }]}>- {formatRp(order.discount)}</Text>
            </View>
          ) : null}

          <View style={[styles.sumRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatRp(displayTotal)}</Text>
          </View>
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  title: { fontFamily: font.bold, fontSize: 15, color: colors.onSurface },
  countBadge: { backgroundColor: colors.brandTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  countText: { fontFamily: font.semibold, fontSize: 12, color: colors.onBrandTertiary },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5 },
  chipText: { fontFamily: font.medium, fontSize: 12, color: colors.onSurfaceSecondary },
  emptyBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  emptyText: { fontFamily: font.medium, fontSize: 13, color: colors.muted },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  itemIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  itemName: { fontFamily: font.semibold, fontSize: 14, color: colors.onSurface },
  itemMeta: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
  qtyBadge: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  qtyText: { fontFamily: font.bold, fontSize: 13, color: colors.onSurface },
  lineTotal: { fontFamily: font.semibold, fontSize: 13, color: colors.onSurface, minWidth: 72, textAlign: "right" },
  sumRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: spacing.sm },
  sumLabel: { fontFamily: font.medium, fontSize: 13 },
  sumValue: { fontFamily: font.semibold, fontSize: 13 },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm },
  totalLabel: { fontFamily: font.bold, fontSize: 15, color: colors.onSurface },
  totalValue: { fontFamily: font.bold, fontSize: 17, color: colors.brandPrimary },
}));

/**
 * Kartu perbandingan jumlah item SAAT MASUK vs SAAT KELUAR.
 * Memastikan jumlah kemeja, celana, dll. sesuai antara catatan masuk
 * (input admin cabang) dan hitungan keluar (verifikasi sebelum "Siap").
 */
export function ItemCheckCard({ order, testID }: { order: any; testID?: string }) {
  const styles = useCheckStyles();
  const { colors } = useTheme();

  const items: any[] = order?.items ?? [];
  if (items.length === 0) return null;

  // Hanya pakai catatan stage "keluar" — record "masuk" adalah snapshot input awal.
  const checks: any[] = order?.item_checks ?? [];
  const keluar = [...checks].reverse().find((c: any) => c.stage === "keluar") ?? null;

  const nameOf: Record<string, string> = {};
  const expected: Record<string, number> = {};
  for (const i of items) {
    nameOf[i.key] = i.name;
    expected[i.key] = i.qty;
  }
  const actual: Record<string, number> = {};
  if (keluar) {
    for (const i of keluar.items ?? []) {
      nameOf[i.key] = i.name;
      actual[i.key] = i.qty;
    }
  }
  const keys = Array.from(new Set([...Object.keys(expected), ...Object.keys(actual)]));
  const totalIn = (Object.values(expected) as number[]).reduce((s, q) => s + q, 0);
  const totalOut = (Object.values(actual) as number[]).reduce((s, q) => s + q, 0);

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.head}>
        <Text style={styles.title}>Verifikasi Masuk & Keluar</Text>
        {keluar ? (
          <View style={[styles.badge, { backgroundColor: keluar.match ? colors.brandTertiary : "#FEE2E2" }]}>
            <Ionicons
              name={keluar.match ? "checkmark-circle" : "warning"}
              size={13}
              color={keluar.match ? colors.success : colors.error}
            />
            <Text style={[styles.badgeText, { color: keluar.match ? colors.success : colors.error }]}>
              {keluar.match ? "Sesuai" : "Selisih"}
            </Text>
          </View>
        ) : (
          <View style={[styles.badge, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="hourglass-outline" size={13} color={colors.muted} />
            <Text style={[styles.badgeText, { color: colors.muted }]}>Menunggu keluar</Text>
          </View>
        )}
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="log-in-outline" size={14} color={colors.brandPrimary} />
        <Text style={styles.metaText}>
          Masuk: {totalIn} item{order?.items_set_at ? ` · ${formatDate(order.items_set_at)}` : ""}
          {order?.items_set_by ? ` oleh ${order.items_set_by}` : ""}
        </Text>
      </View>
      {keluar ? (
        <View style={styles.metaRow}>
          <Ionicons name="log-out-outline" size={14} color={colors.brandPrimary} />
          <Text style={styles.metaText}>
            Keluar: {totalOut} item · {formatDate(keluar.created_at)} oleh {keluar.checked_by}
            {keluar.role_label ? ` (${keluar.role_label})` : ""}
          </Text>
        </View>
      ) : null}

      {keluar ? (
        <>
          <View style={[styles.row, styles.rowHead]}>
            <Text style={[styles.cellName, styles.headText]}>Jenis</Text>
            <Text style={[styles.cellQty, styles.headText]}>Masuk</Text>
            <Text style={[styles.cellQty, styles.headText]}>Keluar</Text>
            <Text style={[styles.cellStatus, styles.headText]}> </Text>
          </View>
          {keys.map((k) => {
            const e = expected[k] ?? 0;
            const a = actual[k] ?? 0;
            const ok = e === a;
            return (
              <View key={k} style={styles.row} testID={testID ? `${testID}-${k}` : undefined}>
                <Text style={styles.cellName}>{nameOf[k] ?? k}</Text>
                <Text style={styles.cellQty}>{e}</Text>
                <Text style={[styles.cellQty, !ok && { color: colors.error, fontFamily: font.bold }]}>{a}</Text>
                <View style={styles.cellStatus}>
                  <Ionicons
                    name={ok ? "checkmark-circle" : "alert-circle"}
                    size={16}
                    color={ok ? colors.success : colors.error}
                  />
                </View>
              </View>
            );
          })}
        </>
      ) : (
        <Text style={styles.hint}>Verifikasi keluar dilakukan admin cabang saat pesanan ditandai siap.</Text>
      )}
    </View>
  );
}

const useCheckStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  title: { fontFamily: font.bold, fontSize: 15, color: colors.onSurface },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  badgeText: { fontFamily: font.semibold, fontSize: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: 4 },
  metaText: { flex: 1, fontFamily: font.regular, fontSize: 12, color: colors.muted },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
  rowHead: { borderTopWidth: 0, marginTop: spacing.xs, paddingVertical: 4 },
  headText: { fontFamily: font.semibold, fontSize: 11, color: colors.muted },
  cellName: { flex: 1, fontFamily: font.medium, fontSize: 13, color: colors.onSurface },
  cellQty: { width: 48, textAlign: "center", fontFamily: font.semibold, fontSize: 13, color: colors.onSurface },
  cellStatus: { width: 24, alignItems: "center" },
  hint: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: spacing.sm },
}));
