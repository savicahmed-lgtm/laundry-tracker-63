import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/toast";
import { STATUS_FLOW, STATUS_META, formatRp, statusIndex } from "@/src/format";
import { Button, StarRating } from "@/src/components/ui";
import MapTracker from "@/src/components/map-tracker";
import { queryClient } from "@/src/query-client";
import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

export default function OrderDetailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useAuth();
  const toast = useToast();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const orderQ = useQuery({
    queryKey: ["order", id],
    queryFn: () => api.order(id!),
    refetchInterval: 4000,
  });
  const order = orderQ.data;

  const courierQ = useQuery({
    queryKey: ["courier", id],
    queryFn: () => api.courier(id!),
    enabled: !!order && (order.status === "siap" || order.status === "selesai"),
    refetchInterval: order?.status === "siap" ? 2000 : false,
  });

  const pay = useMutation({
    mutationFn: () => api.pay(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      refresh();
      toast("Pembayaran berhasil, status Lunas", "success");
    },
    onError: (e: any) => toast(e.message || "Gagal membayar", "error"),
  });

  const sendFeedback = useMutation({
    mutationFn: () => api.feedback(id!, { rating, comment: comment.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast("Terima kasih atas ulasan Anda", "success");
    },
    onError: (e: any) => toast(e.message || "Gagal mengirim ulasan", "error"),
  });

  if (orderQ.isLoading || !order) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  const curIdx = statusIndex(order.status);
  const courier = courierQ.data;
  const branch = order.branch;
  const destination = order.destination;

  return (
    <View style={styles.root}>
      {/* Map */}
      <View style={styles.mapWrap}>
        <MapTracker
          branch={branch}
          destination={destination}
          courier={courier ? { lat: courier.lat, lng: courier.lng } : null}
          service={order.service}
          active={!!courier?.active}
        />
        <Pressable style={[styles.backBtn, { top: insets.top + spacing.sm }]} onPress={() => router.back()} testID="order-back">
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        {order.status === "siap" && order.service === "pickup" && courier ? (
          <View style={[styles.etaBadge, { top: insets.top + spacing.sm }]}>
            <Ionicons name="bicycle" size={16} color={colors.onBrandPrimary} />
            <Text style={styles.etaText}>Kurir · {courier.eta_min} mnt</Text>
          </View>
        ) : null}
      </View>

      {/* Sheet */}
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false}>
          <View style={styles.sheetHead}>
            <View>
              <Text style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
              <Text style={styles.orderService}>
                {order.service === "pickup" ? "Jemput & Antar" : "Antar ke Cabang"}
              </Text>
            </View>
            <Text style={styles.total}>{formatRp(order.total)}</Text>
          </View>

          {/* Timeline */}
          <View style={styles.timeline}>
            {STATUS_FLOW.map((s, i) => {
              const meta = STATUS_META[s];
              const done = i <= curIdx;
              const current = i === curIdx;
              return (
                <View key={s} style={styles.tlRow} testID={`timeline-${s}`}>
                  <View style={styles.tlLeft}>
                    <View style={[styles.tlDot, done && styles.tlDotDone, current && styles.tlDotCurrent]}>
                      <Ionicons name={meta.icon as any} size={16} color={done ? colors.onBrandPrimary : colors.muted} />
                    </View>
                    {i < STATUS_FLOW.length - 1 ? <View style={[styles.tlLine, i < curIdx && styles.tlLineDone]} /> : null}
                  </View>
                  <View style={styles.tlContent}>
                    <Text style={[styles.tlLabel, current && { color: colors.brandPrimary }]}>{meta.label}</Text>
                    <Text style={styles.tlDesc}>{meta.desc}</Text>
                  </View>
                  {current ? <View style={styles.currentPill}><Text style={styles.currentPillText}>Sekarang</Text></View> : null}
                </View>
              );
            })}
          </View>

          {/* Items */}
          <Text style={styles.sectionTitle}>Rincian ({order.items.reduce((s: number, i: any) => s + i.qty, 0)} item)</Text>
          <View style={styles.itemsCard}>
            {order.items.map((it: any) => (
              <View key={it.key} style={styles.itemLine}>
                <Text style={styles.itemName}>{it.name} × {it.qty}</Text>
                <Text style={styles.itemPrice}>{formatRp(it.price * it.qty)}</Text>
              </View>
            ))}
            {order.discount > 0 ? (
              <View style={styles.itemLine}>
                <Text style={[styles.itemName, { color: colors.brandPrimary }]}>Diskon poin</Text>
                <Text style={[styles.itemPrice, { color: colors.brandPrimary }]}>- {formatRp(order.discount)}</Text>
              </View>
            ) : null}
            <View style={[styles.itemLine, styles.totalLine]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatRp(order.total)}</Text>
            </View>
          </View>

          {/* Payment */}
          {order.status === "diterima" ? (
            <View style={styles.payBox}>
              <View style={styles.payInfo}>
                <Ionicons name="wallet-outline" size={20} color={colors.warning} />
                <Text style={styles.payText}>Menunggu pembayaran</Text>
              </View>
              <Button title={`Bayar ${formatRp(order.total)}`} icon="card-outline" onPress={() => pay.mutate()} loading={pay.isPending} testID="pay-button" />
            </View>
          ) : null}

          {/* Feedback */}
          {order.status === "selesai" ? (
            order.rating ? (
              <View style={styles.feedbackDone}>
                <Text style={styles.sectionTitle}>Ulasan Anda</Text>
                <StarRating value={order.rating} readOnly size={24} />
                {order.comment ? <Text style={styles.feedbackComment}>"{order.comment}"</Text> : null}
              </View>
            ) : (
              <View style={styles.feedbackBox}>
                <Text style={styles.sectionTitle}>Beri Rating</Text>
                <View style={{ alignItems: "center", marginVertical: spacing.sm }}>
                  <StarRating value={rating} onChange={setRating} size={38} />
                </View>
                <TextInput
                  style={styles.commentInput}
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Tulis komentar (opsional)"
                  placeholderTextColor={colors.muted}
                  multiline
                  testID="feedback-comment"
                />
                <Button
                  title="Kirim Ulasan"
                  onPress={() => { if (rating === 0) { toast("Pilih rating bintang", "error"); return; } sendFeedback.mutate(); }}
                  loading={sendFeedback.isPending}
                  testID="feedback-submit"
                  style={{ marginTop: spacing.md }}
                />
              </View>
            )
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  mapWrap: { height: "42%" },
  backBtn: { position: "absolute", left: spacing.lg, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  etaBadge: { position: "absolute", right: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  etaText: { fontFamily: font.semibold, fontSize: 13, color: colors.onBrandPrimary },
  sheet: { flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, marginTop: -20 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: "center", marginTop: spacing.sm },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  orderId: { fontFamily: font.bold, fontSize: 18, color: colors.onSurface },
  orderService: { fontFamily: font.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  total: { fontFamily: font.bold, fontSize: 20, color: colors.brandPrimary },
  timeline: { marginBottom: spacing.lg },
  tlRow: { flexDirection: "row", alignItems: "flex-start" },
  tlLeft: { alignItems: "center", width: 40 },
  tlDot: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  tlDotDone: { backgroundColor: colors.brandSecondary },
  tlDotCurrent: { backgroundColor: colors.brandPrimary },
  tlLine: { width: 2, height: 26, backgroundColor: colors.border },
  tlLineDone: { backgroundColor: colors.brandSecondary },
  tlContent: { flex: 1, paddingTop: 4, paddingBottom: spacing.md, marginLeft: spacing.sm },
  tlLabel: { fontFamily: font.semibold, fontSize: 15, color: colors.onSurface },
  tlDesc: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  currentPill: { backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, marginTop: 6 },
  currentPillText: { fontFamily: font.semibold, fontSize: 11, color: colors.onBrandTertiary },
  sectionTitle: { fontFamily: font.bold, fontSize: 16, color: colors.onSurface, marginBottom: spacing.sm, marginTop: spacing.sm },
  itemsCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  itemLine: { flexDirection: "row", justifyContent: "space-between" },
  itemName: { fontFamily: font.regular, fontSize: 14, color: colors.onSurfaceSecondary },
  itemPrice: { fontFamily: font.medium, fontSize: 14, color: colors.onSurface },
  totalLine: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs },
  totalLabel: { fontFamily: font.bold, fontSize: 15, color: colors.onSurface },
  totalValue: { fontFamily: font.bold, fontSize: 16, color: colors.brandPrimary },
  payBox: { marginTop: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  payInfo: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  payText: { fontFamily: font.medium, fontSize: 14, color: colors.onSurface },
  feedbackBox: { marginTop: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg },
  feedbackDone: { marginTop: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  feedbackComment: { fontFamily: font.regular, fontSize: 14, color: colors.onSurfaceSecondary, fontStyle: "italic" },
  commentInput: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, minHeight: 70, fontFamily: font.regular, fontSize: 15, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, textAlignVertical: "top" },
}));
