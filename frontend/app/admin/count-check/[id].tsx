import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api";
import { useToast } from "@/src/toast";
import { formatDate } from "@/src/format";
import { Button } from "@/src/components/ui";
import { queryClient } from "@/src/query-client";
import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

/**
 * Verifikasi jumlah per jenis pakaian SAAT KELUAR.
 * Petugas menghitung ulang cucian fisik; hasil dibandingkan dengan catatan
 * saat masuk. Jika sesuai -> pesanan ditandai "Siap". Jika selisih ->
 * rincian selisih ditampilkan dan tercatat (pelanggan mendapat notifikasi).
 */
export default function CountCheckScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();

  const orderQ = useQuery({ queryKey: ["order", id], queryFn: () => api.order(id!) });
  const order = orderQ.data;

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  // Prefill jumlah aktual = jumlah saat masuk.
  useEffect(() => {
    if (order?.items?.length && Object.keys(counts).length === 0) {
      setCounts(Object.fromEntries(order.items.map((i: any) => [i.key, i.qty])));
    }
  }, [order]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = (key: string, delta: number) =>
    setCounts((p) => ({ ...p, [key]: Math.max(0, (p[key] ?? 0) + delta) }));

  const advance = async (silent = false) => {
    await api.setStatus(id!, "siap");
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["order", id] });
    if (!silent) toast("Jumlah sesuai — pesanan ditandai Siap", "success");
    router.back();
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const items = Object.entries(counts).map(([key, qty]) => ({ key, qty }));
      const res = await api.countCheck(id!, { items, stage: "keluar" });
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      if (res.match) {
        await advance();
      } else {
        setResult(res);
        toast("Ada selisih jumlah — periksa rincian di bawah", "error");
      }
    } catch (e: any) {
      toast(e.message || "Gagal verifikasi", "error");
    } finally {
      setBusy(false);
    }
  };

  const forceAdvance = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.setStatus(id!, "siap");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast("Pesanan ditandai Siap (dengan selisih tercatat)", "success");
      router.back();
    } catch (e: any) {
      toast(e.message || "Gagal menandai siap", "error");
    } finally {
      setBusy(false);
    }
  };

  if (orderQ.isLoading || !order) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  const diffKeys = new Set((result?.diffs ?? []).map((d: any) => d.key));
  const totalIn = order.items.reduce((s: number, i: any) => s + i.qty, 0);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="count-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Verifikasi Jumlah Keluar</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 140 }} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Text style={styles.custName}>{order.customer_name}</Text>
          <Text style={styles.infoLine}>{order.code} · {order.customer_phone}</Text>
          <View style={styles.intakeRow}>
            <Ionicons name="log-in-outline" size={14} color={colors.brandPrimary} />
            <Text style={styles.intakeText}>
              Masuk: {totalIn} item{order.items_set_at ? ` · ${formatDate(order.items_set_at)}` : ""}
              {order.items_set_by ? ` oleh ${order.items_set_by}` : ""}
              {order.weight_kg ? ` · ${order.weight_kg} kg` : ""}
            </Text>
          </View>
        </View>

        <Text style={styles.hint}>
          Hitung ulang cucian fisik per jenis, lalu sesuaikan jumlah aktual keluar. Sistem membandingkan dengan catatan saat masuk.
        </Text>

        {order.items.map((it: any) => (
          <View key={it.key} style={[styles.itemRow, diffKeys.has(it.key) && styles.itemRowDiff]} testID={`count-row-${it.key}`}>
            <View style={styles.itemIcon}>
              <Ionicons name={(it.icon || "cube-outline") as any} size={20} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{it.name}</Text>
              <Text style={styles.itemMeta}>Masuk: ×{it.qty}</Text>
            </View>
            <View style={styles.stepper}>
              <Pressable onPress={() => step(it.key, -1)} style={styles.stepBtn} testID={`count-minus-${it.key}`}>
                <Ionicons name="remove" size={18} color={colors.onSurface} />
              </Pressable>
              <Text style={styles.qtyText}>{counts[it.key] ?? it.qty}</Text>
              <Pressable onPress={() => step(it.key, 1)} style={styles.stepBtn} testID={`count-plus-${it.key}`}>
                <Ionicons name="add" size={18} color={colors.onSurface} />
              </Pressable>
            </View>
          </View>
        ))}

        {result && !result.match ? (
          <View style={styles.diffCard} testID="count-diff">
            <View style={styles.diffHead}>
              <Ionicons name="warning" size={18} color={colors.error} />
              <Text style={styles.diffTitle}>Selisih terdeteksi</Text>
            </View>
            {result.diffs.map((d: any) => (
              <View key={d.key} style={styles.diffRow}>
                <Text style={styles.diffName}>{d.name}</Text>
                <Text style={styles.diffText}>
                  masuk {d.expected} · keluar {d.actual} ({d.diff > 0 ? `+${d.diff}` : d.diff})
                </Text>
              </View>
            ))}
            <Text style={styles.diffNote}>Selisih sudah tercatat & pelanggan diberi notifikasi. Hitung ulang, atau lanjutkan bila memang ada kendala.</Text>
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <Button title="Hitung Ulang" variant="outline" icon="refresh" onPress={() => setResult(null)} testID="count-retry" />
              <Button title="Tetap Tandai Siap (dengan selisih)" variant="secondary" icon="alert-circle-outline" onPress={forceAdvance} loading={busy} testID="count-force" />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title="Verifikasi & Tandai Siap"
          icon="clipboard-outline"
          onPress={submit}
          loading={busy}
          testID="count-submit"
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontFamily: font.bold, fontSize: 17, color: colors.onSurface },
  infoCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  custName: { fontFamily: font.bold, fontSize: 16, color: colors.onSurface },
  infoLine: { fontFamily: font.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  intakeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.sm, padding: spacing.sm },
  intakeText: { flex: 1, fontFamily: font.medium, fontSize: 12, color: colors.onBrandTertiary },
  hint: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginBottom: spacing.md },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  itemRowDiff: { borderColor: colors.error, backgroundColor: "#FEF2F2" },
  itemIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  itemName: { fontFamily: font.semibold, fontSize: 15, color: colors.onSurface },
  itemMeta: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  qtyText: { fontFamily: font.bold, fontSize: 16, color: colors.onSurface, minWidth: 24, textAlign: "center" },
  diffCard: { backgroundColor: "#FEF2F2", borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.error, marginTop: spacing.md },
  diffHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  diffTitle: { fontFamily: font.bold, fontSize: 15, color: colors.error },
  diffRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#FECACA" },
  diffName: { fontFamily: font.semibold, fontSize: 14, color: colors.onSurface },
  diffText: { fontFamily: font.medium, fontSize: 13, color: colors.error },
  diffNote: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: spacing.sm },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg },
}));
