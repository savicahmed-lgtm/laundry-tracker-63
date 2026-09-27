import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api";
import { formatDate } from "@/src/format";
import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

export default function PointsHistoryScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const q = useQuery({ queryKey: ["points-history"], queryFn: api.pointsHistory });
  useFocusEffect(useCallback(() => { q.refetch(); }, []));

  const txns = q.data?.transactions ?? [];
  const balance = q.data?.balance ?? 0;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="points-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Riwayat Poin</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total Poin</Text>
        <Text style={styles.balanceValue} testID="points-balance">{balance} poin</Text>
        <Text style={styles.balanceHint}>{Math.floor(balance / 25)} kupon (1 kg gratis) tersedia</Text>
      </View>

      {q.isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.brandPrimary} /></View>
      ) : txns.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="sparkles-outline" size={52} color={colors.borderStrong} />
          <Text style={styles.emptyText}>Belum ada riwayat poin</Text>
          <Text style={styles.emptySub}>Poin bertambah setiap Anda membayar pesanan</Text>
        </View>
      ) : (
        <FlatList
          data={txns}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const earn = item.type === "earn";
            return (
              <View style={styles.row} testID={`txn-${item.id}`}>
                <View style={[styles.icon, { backgroundColor: earn ? colors.brandTertiary : colors.surfaceTertiary }]}>
                  <Ionicons name={earn ? "add-circle" : "gift"} size={20} color={earn ? colors.brandPrimary : colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reason}>{item.reason}</Text>
                  <Text style={styles.date}>{formatDate(item.created_at)}</Text>
                </View>
                <Text style={[styles.delta, { color: earn ? colors.success : colors.warning }]}>
                  {item.delta > 0 ? "+" : ""}{item.delta}
                </Text>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerTitle: { fontFamily: font.semibold, fontSize: 18, color: colors.onSurface },
  balanceCard: { margin: spacing.lg, backgroundColor: colors.brandPrimary, borderRadius: radius.lg, padding: spacing.xl, gap: 4 },
  balanceLabel: { fontFamily: font.medium, fontSize: 13, color: colors.onBrandPrimary, opacity: 0.9 },
  balanceValue: { fontFamily: font.bold, fontSize: 30, color: colors.onBrandPrimary },
  balanceHint: { fontFamily: font.regular, fontSize: 12, color: colors.onBrandPrimary, opacity: 0.9 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xs, padding: spacing.xl },
  emptyText: { fontFamily: font.semibold, fontSize: 16, color: colors.onSurface, marginTop: spacing.sm },
  emptySub: { fontFamily: font.regular, fontSize: 13, color: colors.muted, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  reason: { fontFamily: font.medium, fontSize: 14, color: colors.onSurface },
  date: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  delta: { fontFamily: font.bold, fontSize: 18 },
}));
