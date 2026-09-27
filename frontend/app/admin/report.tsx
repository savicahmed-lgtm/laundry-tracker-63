import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api";
import { STATUS_META, STATUS_FLOW, formatRp } from "@/src/format";
import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

export default function ReportScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const reportQ = useQuery({ queryKey: ["admin-report"], queryFn: api.adminReport, refetchInterval: 10000 });
  const r = reportQ.data;

  const maxStatus = r ? Math.max(1, ...STATUS_FLOW.map((s) => r.by_status?.[s] ?? 0)) : 1;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="report-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Laporan</Text>
        <View style={{ width: 26 }} />
      </View>

      {reportQ.isLoading || !r ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.brandPrimary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.md }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={reportQ.isFetching} onRefresh={() => reportQ.refetch()} tintColor={colors.brandPrimary} />}
        >
          <View style={styles.revenueCard}>
            <Text style={styles.revenueLabel}>Total Pendapatan (lunas)</Text>
            <Text style={styles.revenueValue}>{formatRp(r.revenue)}</Text>
            <View style={styles.revenueFooter}>
              <Ionicons name="today-outline" size={15} color={colors.onBrandPrimary} />
              <Text style={styles.revenueToday}>Hari ini: {formatRp(r.today_revenue)} · {r.today_orders} pesanan</Text>
            </View>
          </View>

          <View style={styles.grid}>
            <StatCard icon="albums-outline" label="Total Pesanan" value={`${r.total}`} />
            <StatCard icon="hourglass-outline" label="Aktif" value={`${r.active}`} />
            <StatCard icon="checkmark-done-outline" label="Selesai" value={`${r.completed}`} />
            <StatCard icon="star" label="Rating Rata²" value={r.rating_count > 0 ? `${r.avg_rating} (${r.rating_count})` : "-"} />
          </View>

          <View style={styles.breakdown}>
            <Text style={styles.breakdownTitle}>Pesanan per Status</Text>
            {STATUS_FLOW.map((s) => {
              const n = r.by_status?.[s] ?? 0;
              return (
                <View key={s} style={styles.barRow}>
                  <Text style={styles.barLabel}>{STATUS_META[s as keyof typeof STATUS_META].label}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${(n / maxStatus) * 100}%` }]} />
                  </View>
                  <Text style={styles.barValue}>{n}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon as any} size={22} color={colors.brandPrimary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontFamily: font.bold, fontSize: 17, color: colors.onSurface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  revenueCard: { backgroundColor: colors.brandPrimary, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.xs },
  revenueLabel: { fontFamily: font.medium, fontSize: 13, color: colors.onBrandPrimary, opacity: 0.9 },
  revenueValue: { fontFamily: font.bold, fontSize: 30, color: colors.onBrandPrimary },
  revenueFooter: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  revenueToday: { fontFamily: font.medium, fontSize: 12, color: colors.onBrandPrimary, opacity: 0.95 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "space-between" },
  statCard: { width: "47.5%", backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: 4 },
  statValue: { fontFamily: font.bold, fontSize: 22, color: colors.onSurface, marginTop: spacing.xs },
  statLabel: { fontFamily: font.regular, fontSize: 12, color: colors.muted },
  breakdown: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  breakdownTitle: { fontFamily: font.bold, fontSize: 16, color: colors.onSurface, marginBottom: spacing.xs },
  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  barLabel: { fontFamily: font.medium, fontSize: 12, color: colors.onSurfaceSecondary, width: 96 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  barFill: { height: 10, borderRadius: 5, backgroundColor: colors.brandSecondary },
  barValue: { fontFamily: font.bold, fontSize: 13, color: colors.onSurface, width: 24, textAlign: "right" },
}));
