import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api";
import { useToast } from "@/src/toast";
import { formatDate } from "@/src/format";
import { queryClient } from "@/src/query-client";
import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

const TYPE_ICON: Record<string, string> = {
  order: "receipt-outline",
  payment: "card-outline",
  status: "sync-outline",
};

export default function NotificationsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const notifQ = useQuery({ queryKey: ["notifications"], queryFn: api.notifications });
  const items = notifQ.data?.items ?? [];
  const unread = notifQ.data?.unread ?? 0;

  const readAll = useMutation({
    mutationFn: () => api.readAllNotifications(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast("Semua ditandai dibaca", "success");
    },
  });

  const openItem = async (n: any) => {
    if (!n.read) {
      try {
        await api.readNotification(n.id);
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      } catch {
        /* ignore */
      }
    }
    if (n.order_id) router.push(`/order/${n.order_id}`);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="notif-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifikasi</Text>
        {unread > 0 ? (
          <Pressable onPress={() => readAll.mutate()} hitSlop={8} testID="notif-read-all">
            <Text style={styles.readAll}>Tandai dibaca</Text>
          </Pressable>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {notifQ.isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.brandPrimary} /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={56} color={colors.borderStrong} />
          <Text style={styles.emptyText}>Belum ada notifikasi</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={notifQ.isFetching} onRefresh={() => notifQ.refetch()} tintColor={colors.brandPrimary} />}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, !item.read && styles.cardUnread]}
              onPress={() => openItem(item)}
              testID={`notif-${item.id}`}
            >
              <View style={[styles.iconWrap, !item.read && styles.iconWrapUnread]}>
                <Ionicons
                  name={(TYPE_ICON[item.type] || "notifications-outline") as any}
                  size={20}
                  color={item.read ? colors.muted : colors.brandPrimary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.time}>{formatDate(item.created_at)}</Text>
              </View>
              {!item.read ? <View style={styles.dot} /> : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontFamily: font.bold, fontSize: 17, color: colors.onSurface },
  readAll: { fontFamily: font.semibold, fontSize: 13, color: colors.brandPrimary, width: 80, textAlign: "right" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  emptyText: { fontFamily: font.medium, fontSize: 15, color: colors.muted },
  card: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  cardUnread: { backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  iconWrapUnread: { backgroundColor: colors.surface },
  title: { fontFamily: font.semibold, fontSize: 15, color: colors.onSurface },
  body: { fontFamily: font.regular, fontSize: 13, color: colors.onSurfaceSecondary, marginTop: 2 },
  time: { fontFamily: font.regular, fontSize: 11, color: colors.muted, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandPrimary, marginTop: 6 },
}));
