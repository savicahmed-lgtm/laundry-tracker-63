import { Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { formatRp } from "@/src/format";
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
