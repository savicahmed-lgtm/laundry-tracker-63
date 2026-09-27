import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/toast";
import { STATUS_META, formatRp, statusIndex, adminAction, SCAN_ROLES } from "@/src/format";
import { queryClient } from "@/src/query-client";
import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

const FILTERS = [
  { key: "aktif", label: "Aktif" },
  { key: "semua", label: "Semua" },
  { key: "selesai", label: "Selesai" },
];

export default function AdminScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState("aktif");
  const [search, setSearch] = useState("");
  const role = user?.role ?? "";
  const isScanRole = SCAN_ROLES.includes(role);
  const isSuper = role === "admin" || role === "admin_cabang";

  const ordersQ = useQuery({ queryKey: ["orders"], queryFn: api.orders, refetchInterval: 5000 });

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.setStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast("Status diperbarui", "success");
    },
    onError: (e: any) => toast(e.message || "Gagal memperbarui", "error"),
  });

  const all = ordersQ.data ?? [];
  const q = search.trim().toLowerCase();
  const data = all.filter((o: any) => {
    const statusOk =
      filter === "semua" ? true : filter === "selesai" ? o.status === "selesai" : o.status !== "selesai";
    const searchOk =
      !q ||
      (o.customer_name || "").toLowerCase().includes(q) ||
      (o.customer_phone || "").toLowerCase().includes(q) ||
      (o.code || "").toLowerCase().includes(q);
    return statusOk && searchOk;
  });

  const activeCount = all.filter((o: any) => o.status !== "selesai").length;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hi}>{user?.role_label ?? "Dashboard Admin"}</Text>
          <Text style={styles.name}>{user?.name}</Text>
        </View>
        <View style={styles.headerActions}>
          {isSuper ? (
            <Pressable onPress={() => router.push("/admin/report")} hitSlop={10} testID="admin-report-btn" style={styles.headerBtn}>
              <Ionicons name="bar-chart-outline" size={22} color={colors.brandPrimary} />
            </Pressable>
          ) : null}
          <Pressable onPress={async () => { await logout(); router.replace("/login"); }} hitSlop={10} testID="admin-logout" style={styles.headerBtn}>
            <Ionicons name="log-out-outline" size={24} color={colors.error} />
          </Pressable>
        </View>
      </View>

      {isScanRole ? (
        <Pressable style={styles.scanCta} onPress={() => router.push("/admin/scan")} testID="admin-scan-cta">
          <Ionicons name="qr-code-outline" size={22} color={colors.onBrandPrimary} />
          <Text style={styles.scanCtaText}>Scan QR Pesanan</Text>
        </Pressable>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{activeCount}</Text>
          <Text style={styles.statLabel}>Pesanan Aktif</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{all.length}</Text>
          <Text style={styles.statLabel}>Total Pesanan</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Cari nama / No HP / kode"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          testID="admin-search"
        />
        {search ? (
          <Pressable onPress={() => setSearch("")} hitSlop={8} testID="admin-search-clear">
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chipRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {FILTERS.map((f) => (
            <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, filter === f.key && styles.chipActive]} testID={`admin-filter-${f.key}`}>
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {ordersQ.isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.brandPrimary} /></View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="checkmark-done-circle-outline" size={56} color={colors.borderStrong} />
          <Text style={styles.emptyText}>Tidak ada pesanan</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.md }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status as keyof typeof STATUS_META];
            const action = adminAction(role, item);
            const waitingPay = item.status === "diterima";
            return (
              <View style={styles.card} testID={`admin-order-${item.id}`}>
                <Pressable style={styles.cardTop} onPress={() => router.push(`/order/${item.id}`)}>
                  <View style={styles.cardIcon}>
                    <Ionicons name="person" size={18} color={colors.brandPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.custName}>{item.customer_name}</Text>
                    <Text style={styles.custPhone}>{item.code} · {item.customer_phone}</Text>
                  </View>
                  <View style={styles.badge}><Text style={styles.badgeText}>{meta.label}</Text></View>
                </Pressable>

                {item.rewash_active ? (
                  <View style={styles.rewashBadge}>
                    <Ionicons name="refresh-circle" size={16} color={colors.error} />
                    <Text style={styles.rewashText}>Cuci ulang (komplain pelanggan)</Text>
                  </View>
                ) : null}

                <View style={styles.progressBar}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <View key={i} style={[styles.seg, { backgroundColor: i <= statusIndex(item.status) ? colors.brandPrimary : colors.border }]} />
                  ))}
                </View>

                <View style={styles.cardMeta}>
                  <Text style={styles.metaText}>
                    {item.items.reduce((s: number, i: any) => s + i.qty, 0)} item · {item.service === "pickup" ? "Jemput & Antar" : "Ke Cabang"}
                  </Text>
                  <Text style={styles.metaTotal}>{formatRp(item.total)}</Text>
                </View>

                <Text style={styles.itemSummary} numberOfLines={1} testID={`items-summary-${item.id}`}>
                  {item.items?.length
                    ? item.items.map((i: any) => `${i.name} ×${i.qty}`).join(" · ")
                    : "Item belum diinput"}
                  {item.weight_kg ? ` · ${item.weight_kg} kg` : ""}
                </Text>

                {item.status === "selesai" ? (
                  item.rating ? (
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={14} color={colors.warning} />
                      <Text style={styles.ratingText}>{item.rating}/5 {item.comment ? `· "${item.comment}"` : ""}</Text>
                    </View>
                  ) : (
                    <Text style={styles.noRating}>Selesai · belum ada ulasan</Text>
                  )
                ) : action?.kind === "input" ? (
                  <Pressable
                    style={styles.advanceBtn}
                    onPress={() => router.push(`/admin/items/${item.id}`)}
                    testID={`input-${item.id}`}
                  >
                    <Ionicons name="create-outline" size={18} color={colors.onBrandPrimary} />
                    <Text style={styles.advanceText}>Input Item & Timbang</Text>
                  </Pressable>
                ) : action?.kind === "status" && action.scan ? (
                  <Pressable
                    style={styles.advanceBtn}
                    onPress={() => router.push("/admin/scan")}
                    testID={`scan-${item.id}`}
                  >
                    <Ionicons name="qr-code-outline" size={18} color={colors.onBrandPrimary} />
                    <Text style={styles.advanceText}>Scan untuk {action.label}</Text>
                  </Pressable>
                ) : action?.kind === "status" ? (
                  <Pressable
                    style={styles.advanceBtn}
                    onPress={() => advance.mutate({ id: item.id, status: action.target })}
                    testID={`advance-${item.id}`}
                  >
                    <Ionicons name="arrow-forward-circle" size={18} color={colors.onBrandPrimary} />
                    <Text style={styles.advanceText}>Tandai: {action.label}</Text>
                  </Pressable>
                ) : waitingPay ? (
                  <View style={styles.waitPay}>
                    <Ionicons name="time-outline" size={16} color={colors.warning} />
                    <Text style={styles.waitPayText}>Menunggu pembayaran pelanggan</Text>
                  </View>
                ) : (
                  <View style={styles.waitPay}>
                    <Ionicons name="hourglass-outline" size={16} color={colors.muted} />
                    <Text style={styles.waitPayText}>Sedang di tahap lain</Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, minHeight: 46 },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 14, color: colors.onSurface },
  scanCta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: radius.md, paddingVertical: spacing.md },
  scanCtaText: { fontFamily: font.bold, fontSize: 15, color: colors.onBrandPrimary },
  rewashBadge: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: "#FEE2E2", borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  rewashText: { fontFamily: font.semibold, fontSize: 12, color: colors.error },
  hi: { fontFamily: font.regular, fontSize: 13, color: colors.muted },
  name: { fontFamily: font.bold, fontSize: 20, color: colors.onSurface },
  statsRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  statValue: { fontFamily: font.bold, fontSize: 26, color: colors.brandPrimary },
  statLabel: { fontFamily: font.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  chipRowWrap: { height: 56, justifyContent: "center" },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  chip: { height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { fontFamily: font.medium, fontSize: 13, color: colors.onSurfaceTertiary },
  chipTextActive: { color: colors.onBrandPrimary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  emptyText: { fontFamily: font.medium, fontSize: 15, color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cardIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  custName: { fontFamily: font.semibold, fontSize: 15, color: colors.onSurface },
  custPhone: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  badge: { backgroundColor: colors.surfaceTertiary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  badgeText: { fontFamily: font.semibold, fontSize: 11, color: colors.onSurfaceTertiary },
  progressBar: { flexDirection: "row", gap: 4 },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  cardMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemSummary: { fontFamily: font.regular, fontSize: 12, color: colors.onSurfaceSecondary, marginTop: -spacing.sm },
  metaText: { fontFamily: font.regular, fontSize: 13, color: colors.muted },
  metaTotal: { fontFamily: font.bold, fontSize: 15, color: colors.onSurface },
  advanceBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, borderRadius: radius.md, paddingVertical: spacing.md },
  advanceText: { fontFamily: font.semibold, fontSize: 14, color: colors.onBrandPrimary },
  waitPay: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  waitPayText: { fontFamily: font.medium, fontSize: 13, color: colors.onSurfaceSecondary },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  ratingText: { fontFamily: font.medium, fontSize: 13, color: colors.onSurfaceSecondary, flex: 1 },
  noRating: { fontFamily: font.regular, fontSize: 13, color: colors.muted },
}));
