import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { usesNativeTabs } from "@/src/navigation";
import { STATUS_META, formatRp } from "@/src/format";
import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";
import { queryClient } from "@/src/query-client";

export default function HomeScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, refresh } = useAuth();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const catalogQ = useQuery({ queryKey: ["catalog"], queryFn: api.catalog });
  const ordersQ = useQuery({ queryKey: ["orders"], queryFn: api.orders });
  const promosQ = useQuery({ queryKey: ["promos"], queryFn: api.promos });

  useFocusEffect(
    useCallback(() => {
      refresh();
      ordersQ.refetch();
    }, []),
  );

  const points = user?.points ?? 0;
  const toFree = points >= 25 ? 0 : 25 - (points % 25);
  const freeKg = Math.floor(points / 25);
  const items = catalogQ.data?.items ?? [];
  const active = (ordersQ.data ?? []).find((o: any) => o.status !== "selesai");
  const promos = promosQ.data ?? [];

  const onRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    refresh();
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomChrome + spacing["2xl"], paddingTop: insets.top + spacing.md }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={ordersQ.isFetching} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.hi}>Halo,</Text>
            <Text style={styles.name}>{user?.name || "Pelanggan"} 👋</Text>
          </View>
          <View style={styles.avatar}>
            <Ionicons name="water" size={22} color={colors.onBrandPrimary} />
          </View>
        </View>

        {/* Points card */}
        <Pressable onPress={() => router.push("/points-history")} testID="home-points-card">
        <LinearGradient colors={[colors.brandPrimary, colors.brandSecondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pointsCard}>
          <View style={styles.pointsRow}>
            <View>
              <Text style={styles.pointsLabel}>Poin Loyalti</Text>
              <Text style={styles.pointsValue} testID="home-points">{points} poin</Text>
            </View>
            <View style={styles.pointsBadge}>
              <Ionicons name="gift" size={16} color={colors.onBrandPrimary} />
              <Text style={styles.pointsBadgeText}>{freeKg} kg gratis</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${points >= 25 ? 100 : ((points % 25) / 25) * 100}%` }]} />
          </View>
          <View style={styles.pointsFooter}>
            <Text style={styles.pointsHint}>
              {toFree === 0 ? "Anda punya kupon 1 kg gratis!" : `${toFree} poin lagi untuk 1 kg gratis`}
            </Text>
            <View style={styles.pointsHistoryLink}>
              <Text style={styles.pointsHistoryText}>Riwayat</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.onBrandPrimary} />
            </View>
          </View>
        </LinearGradient>
        </Pressable>

        {/* Promo banners */}
        {promos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.promoRow}
            style={{ marginTop: spacing.lg }}
          >
            {promos.map((p: any) => (
              <View key={p.id} style={styles.promoCard} testID={`promo-${p.id}`}>
                <Image source={{ uri: p.image }} style={styles.promoImg} contentFit="cover" />
                <LinearGradient colors={["rgba(6,95,70,0.15)", "rgba(17,24,39,0.85)"]} style={styles.promoScrim} />
                {p.badge ? (
                  <View style={styles.promoBadge}>
                    <Text style={styles.promoBadgeText}>{p.badge}</Text>
                  </View>
                ) : null}
                <View style={styles.promoText}>
                  <Text style={styles.promoTitle} numberOfLines={2}>{p.title}</Text>
                  <Text style={styles.promoSub} numberOfLines={1}>{p.subtitle}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {/* Active order */}
        {active ? (
          <Pressable style={styles.activeCard} onPress={() => router.push(`/order/${active.id}`)} testID="home-active-order">
            <View style={styles.activeIcon}>
              <Ionicons name={STATUS_META[active.status as keyof typeof STATUS_META].icon as any} size={22} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeStatus}>{STATUS_META[active.status as keyof typeof STATUS_META].label}</Text>
              <Text style={styles.activeSub}>
                {active.items.reduce((s: number, i: any) => s + i.qty, 0)} item · {formatRp(active.total)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Jenis Cucian</Text>
          <Pressable onPress={() => router.push("/order/new")} testID="home-new-order">
            <Text style={styles.sectionLink}>Pesan +</Text>
          </Pressable>
        </View>

        <View style={styles.grid}>
          {items.map((it: any) => (
            <Pressable
              key={it.key}
              style={styles.gridItem}
              testID={`catalog-${it.key}`}
              onPress={() => router.push({ pathname: "/order/new", params: { item: it.key } })}
            >
              <View style={styles.gridIcon}>
                <Ionicons name={it.icon as any} size={26} color={colors.brandPrimary} />
              </View>
              <Text style={styles.gridName}>{it.name}</Text>
              <Text style={styles.gridPrice}>{formatRp(it.price)}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  hi: { fontFamily: font.regular, fontSize: 14, color: colors.muted },
  name: { fontFamily: font.bold, fontSize: 22, color: colors.onSurface },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  pointsCard: { marginHorizontal: spacing.lg, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md },
  pointsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  pointsLabel: { fontFamily: font.medium, fontSize: 13, color: colors.onBrandPrimary, opacity: 0.9 },
  pointsValue: { fontFamily: font.bold, fontSize: 28, color: colors.onBrandPrimary },
  pointsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  pointsBadgeText: { fontFamily: font.semibold, fontSize: 12, color: colors.onBrandPrimary },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.28)", overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.onBrandPrimary },
  pointsHint: { fontFamily: font.medium, fontSize: 12, color: colors.onBrandPrimary, opacity: 0.95 },
  pointsFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pointsHistoryLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  pointsHistoryText: { fontFamily: font.semibold, fontSize: 12, color: colors.onBrandPrimary },
  promoRow: { paddingHorizontal: spacing.lg, gap: spacing.md },
  promoCard: { width: 280, height: 130, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceTertiary },
  promoImg: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0 },
  promoScrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  promoBadge: { position: "absolute", top: spacing.md, right: spacing.md, backgroundColor: colors.warning, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  promoBadgeText: { fontFamily: font.bold, fontSize: 12, color: colors.onWarning },
  promoText: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.md },
  promoTitle: { fontFamily: font.bold, fontSize: 16, color: "#FFFFFF" },
  promoSub: { fontFamily: font.regular, fontSize: 12, color: "#FFFFFF", opacity: 0.9, marginTop: 2 },
  activeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  activeStatus: { fontFamily: font.semibold, fontSize: 15, color: colors.onSurface },
  activeSub: { fontFamily: font.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontFamily: font.bold, fontSize: 18, color: colors.onSurface },
  sectionLink: { fontFamily: font.semibold, fontSize: 14, color: colors.brandPrimary },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.md, justifyContent: "space-between" },
  gridItem: {
    width: "31%",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gridIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  gridName: { fontFamily: font.semibold, fontSize: 13, color: colors.onSurface, textAlign: "center" },
  gridPrice: { fontFamily: font.regular, fontSize: 11, color: colors.muted },
}));
