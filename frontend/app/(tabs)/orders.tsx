import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api";
import { usesNativeTabs } from "@/src/navigation";
import { STATUS_META, formatRp, formatDate, statusIndex } from "@/src/format";
import { Button } from "@/src/components/ui";
import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

export default function OrdersScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const ordersQ = useQuery({ queryKey: ["orders"], queryFn: api.orders });

  useFocusEffect(useCallback(() => { ordersQ.refetch(); }, []));

  const data = ordersQ.data ?? [];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Pesanan Saya</Text>
      </View>

      {ordersQ.isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.brandPrimary} /></View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="cube-outline" size={56} color={colors.borderStrong} />
          <Text style={styles.emptyTitle}>Belum ada pesanan</Text>
          <Text style={styles.emptySub}>Mulai laundry pertama Anda sekarang</Text>
          <Button title="Buat Pesanan" icon="add" onPress={() => router.push("/order/new")} testID="orders-empty-cta" style={{ marginTop: spacing.md, minWidth: 200 }} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomChrome + spacing["2xl"], gap: spacing.md }}
          showsVerticalScrollIndicator={false}
          refreshing={ordersQ.isFetching}
          onRefresh={() => ordersQ.refetch()}
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status as keyof typeof STATUS_META];
            const done = item.status === "selesai";
            return (
              <Pressable style={styles.card} onPress={() => router.push(`/order/${item.id}`)} testID={`order-row-${item.id}`}>
                <View style={styles.cardTop}>
                  <View style={styles.cardIcon}>
                    <Ionicons name={meta.icon as any} size={20} color={colors.brandPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                    <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: done ? colors.brandTertiary : colors.surfaceTertiary }]}>
                    <Text style={[styles.badgeText, { color: done ? colors.onBrandTertiary : colors.onSurfaceTertiary }]}>{meta.label}</Text>
                  </View>
                </View>

                <View style={styles.progressBar}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <View key={i} style={[styles.progressSeg, { backgroundColor: i <= statusIndex(item.status) ? colors.brandPrimary : colors.border }]} />
                  ))}
                </View>

                <View style={styles.cardBottom}>
                  <View style={styles.metaRow}>
                    <Ionicons name={item.service === "pickup" ? "bicycle-outline" : "storefront-outline"} size={14} color={colors.muted} />
                    <Text style={styles.metaText}>{item.service === "pickup" ? "Jemput & Antar" : "Antar ke Cabang"}</Text>
                  </View>
                  <Text style={styles.total}>{formatRp(item.total)}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  title: { fontFamily: font.bold, fontSize: 24, color: colors.onSurface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.xs },
  emptyTitle: { fontFamily: font.semibold, fontSize: 17, color: colors.onSurface, marginTop: spacing.sm },
  emptySub: { fontFamily: font.regular, fontSize: 14, color: colors.muted, textAlign: "center" },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cardIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  orderId: { fontFamily: font.semibold, fontSize: 14, color: colors.onSurface },
  orderDate: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  badge: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  badgeText: { fontFamily: font.semibold, fontSize: 11 },
  progressBar: { flexDirection: "row", gap: 4 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaText: { fontFamily: font.regular, fontSize: 13, color: colors.muted },
  total: { fontFamily: font.bold, fontSize: 15, color: colors.brandPrimary },
}));
