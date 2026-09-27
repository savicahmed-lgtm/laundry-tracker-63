import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api";
import { useToast } from "@/src/toast";
import { formatRp } from "@/src/format";
import { Button } from "@/src/components/ui";
import { queryClient } from "@/src/query-client";
import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

export default function ItemInputScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();

  const orderQ = useQuery({ queryKey: ["order", id], queryFn: () => api.order(id!) });
  const catalogQ = useQuery({ queryKey: ["catalog"], queryFn: api.catalog });

  const [qty, setQty] = useState<Record<string, number>>({});
  const [weight, setWeight] = useState("");

  const order = orderQ.data;
  const catalog = catalogQ.data;
  const kgRate = catalog && order ? (catalog.kg_rates?.[order.treatment] ?? 0) : 0;

  const estimate = useMemo(() => {
    if (!catalog) return { satuan: 0, kiloan: 0, total: 0 };
    let satuan = 0;
    for (const it of catalog.items) {
      if (it.pricing === "satuan") satuan += (it.price || 0) * (qty[it.key] || 0);
    }
    const w = parseFloat(weight.replace(",", ".")) || 0;
    const kiloan = Math.round(w * kgRate);
    return { satuan, kiloan, total: satuan + kiloan };
  }, [catalog, qty, weight, kgRate]);

  const save = useMutation({
    mutationFn: () => {
      const items = Object.entries(qty)
        .filter(([, q]) => q > 0)
        .map(([key, q]) => ({ key, qty: q }));
      const w = parseFloat(weight.replace(",", ".")) || 0;
      return api.setItems(id!, { items, weight_kg: w });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast("Item & berat tersimpan", "success");
      router.back();
    },
    onError: (e: any) => toast(e.message || "Gagal menyimpan", "error"),
  });

  if (orderQ.isLoading || catalogQ.isLoading || !order || !catalog) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  if (order.status !== "diterima") {
    return (
      <View style={styles.loading}>
        <Ionicons name="lock-closed-outline" size={48} color={colors.borderStrong} />
        <Text style={styles.lockText}>Item hanya bisa diinput sebelum pembayaran.</Text>
        <Button title="Kembali" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  const setItemQty = (key: string, delta: number) =>
    setQty((p) => ({ ...p, [key]: Math.max(0, (p[key] || 0) + delta) }));

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="items-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Input Item & Timbang</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 140 }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <Text style={styles.custName}>{order.customer_name}</Text>
          <Text style={styles.infoLine}>{order.code} · {order.customer_phone}</Text>
          <Text style={styles.infoLine}>
            {order.service === "pickup" ? "Jemput & Antar" : "Antar ke Cabang"} · {order.treatment_label}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Berat Cucian (kiloan)</Text>
        <View style={styles.weightRow}>
          <TextInput
            style={styles.weightInput}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder="0.0"
            placeholderTextColor={colors.muted}
            testID="weight-input"
          />
          <Text style={styles.weightUnit}>kg × {formatRp(kgRate)}/kg</Text>
        </View>

        <Text style={styles.sectionTitle}>Daftar Item</Text>
        {catalog.items.map((it: any) => (
          <View key={it.key} style={styles.itemRow}>
            <View style={styles.itemIcon}>
              <Ionicons name={it.icon as any} size={20} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{it.name}</Text>
              <Text style={styles.itemMeta}>
                {it.pricing === "satuan" ? `Satuan · ${formatRp(it.price)}` : "Kiloan"}
              </Text>
            </View>
            <View style={styles.stepper}>
              <Pressable onPress={() => setItemQty(it.key, -1)} style={styles.stepBtn} testID={`minus-${it.key}`}>
                <Ionicons name="remove" size={18} color={colors.onSurface} />
              </Pressable>
              <Text style={styles.qtyText}>{qty[it.key] || 0}</Text>
              <Pressable onPress={() => setItemQty(it.key, 1)} style={styles.stepBtn} testID={`plus-${it.key}`}>
                <Ionicons name="add" size={18} color={colors.onSurface} />
              </Pressable>
            </View>
          </View>
        ))}
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.footerRow}>
          <Text style={styles.footerLabel}>Estimasi total</Text>
          <Text style={styles.footerTotal}>{formatRp(estimate.total)}</Text>
        </View>
        <Button
          title="Simpan"
          icon="save-outline"
          onPress={() => {
            if (estimate.total <= 0) {
              toast("Isi berat atau tambah item satuan", "error");
              return;
            }
            save.mutate();
          }}
          loading={save.isPending}
          testID="save-items"
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, gap: spacing.sm, padding: spacing.xl },
  lockText: { fontFamily: font.medium, fontSize: 15, color: colors.muted, textAlign: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontFamily: font.bold, fontSize: 17, color: colors.onSurface },
  infoCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  custName: { fontFamily: font.bold, fontSize: 16, color: colors.onSurface },
  infoLine: { fontFamily: font.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  sectionTitle: { fontFamily: font.bold, fontSize: 15, color: colors.onSurface, marginTop: spacing.md, marginBottom: spacing.sm },
  weightRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  weightInput: { width: 90, fontFamily: font.bold, fontSize: 20, color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlign: "center" },
  weightUnit: { fontFamily: font.medium, fontSize: 14, color: colors.muted },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  itemIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  itemName: { fontFamily: font.semibold, fontSize: 15, color: colors.onSurface },
  itemMeta: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  qtyText: { fontFamily: font.bold, fontSize: 16, color: colors.onSurface, minWidth: 24, textAlign: "center" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg, gap: spacing.md },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerLabel: { fontFamily: font.medium, fontSize: 14, color: colors.muted },
  footerTotal: { fontFamily: font.bold, fontSize: 20, color: colors.brandPrimary },
}));
