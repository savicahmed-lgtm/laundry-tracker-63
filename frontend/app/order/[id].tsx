import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { api, fileUrl, uploadImage } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/toast";
import { STATUS_FLOW, STATUS_META, formatRp, formatDate, statusIndex, isAdminRole } from "@/src/format";
import { Button, StarRating } from "@/src/components/ui";
import { OrderItemsCard, ItemCheckCard } from "@/src/components/order-items-card";
import MapTracker from "@/src/components/map-tracker";
import { queryClient } from "@/src/query-client";
import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

export default function OrderDetailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, refresh } = useAuth();
  const toast = useToast();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showRewash, setShowRewash] = useState(false);
  const [rewashReason, setRewashReason] = useState("");
  const [rewashPhotos, setRewashPhotos] = useState<string[]>([]);
  const isAdmin = isAdminRole(user?.role);

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

  const confirmReceived = useMutation({
    mutationFn: () => api.confirmReceived(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast("Terima kasih, pesanan ditandai selesai", "success");
    },
    onError: (e: any) => toast(e.message || "Gagal konfirmasi", "error"),
  });

  const sendRewash = useMutation({
    mutationFn: () => api.rewash(id!, { reason: rewashReason.trim(), photos: rewashPhotos }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setShowRewash(false);
      setRewashReason("");
      setRewashPhotos([]);
      toast("Permintaan cuci ulang dikirim", "success");
    },
    onError: (e: any) => toast(e.message || "Gagal mengirim permintaan", "error"),
  });

  const pickComplaintPhoto = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast("Izin diperlukan untuk menambah foto", "error");
      return;
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    setUploading(true);
    try {
      const name = asset.fileName || `komplain-${Date.now()}.jpg`;
      const path = await uploadImage(asset.uri, name, asset.mimeType || "image/jpeg");
      setRewashPhotos((p) => [...p, path]);
      toast("Foto ditambahkan", "success");
    } catch (e: any) {
      toast(e.message || "Gagal mengunggah foto", "error");
    } finally {
      setUploading(false);
    }
  };

  const pickAndUpload = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        toast("Izin ditolak. Buka Pengaturan untuk mengaktifkan.", "error");
        Linking.openSettings();
      } else {
        toast("Izin diperlukan untuk menambah foto", "error");
      }
      return;
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    setUploading(true);
    try {
      const name = asset.fileName || `laundry-${Date.now()}.jpg`;
      const path = await uploadImage(asset.uri, name, asset.mimeType || "image/jpeg");
      await api.addPhotos(id!, [path]);
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast("Foto berhasil ditambahkan", "success");
    } catch (e: any) {
      toast(e.message || "Gagal mengunggah foto", "error");
    } finally {
      setUploading(false);
    }
  };

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
              <Text style={styles.orderId}>{order.code}</Text>
              <Text style={styles.orderService}>
                {order.service === "pickup" ? "Jemput & Antar" : "Antar ke Cabang"}
              </Text>
            </View>
            <Text style={styles.total}>{formatRp(order.total)}</Text>
          </View>

          <View style={styles.qrCard} testID="order-qr">
            <View style={styles.qrBox}>
              <QRCode value={order.code} size={132} backgroundColor="#FFFFFF" color="#111827" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.qrTitle}>QR Pesanan</Text>
              <Text style={styles.qrDesc}>Tunjukkan QR ini ke petugas untuk verifikasi tiap tahap proses.</Text>
              <Text style={styles.qrCode}>{order.code}</Text>
            </View>
          </View>

          {order.estimated_ready_at && order.status !== "selesai" ? (
            <View style={styles.estimateBox} testID="estimate-ready">
              <Ionicons name="time-outline" size={20} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.estimateLabel}>Estimasi selesai</Text>
                <Text style={styles.estimateValue}>{formatDate(order.estimated_ready_at)}</Text>
              </View>
            </View>
          ) : null}

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
          <View style={{ marginTop: spacing.lg }}>
            <OrderItemsCard order={order} testID="order-items" />
          </View>
          <View style={{ marginTop: spacing.md }}>
            <ItemCheckCard order={order} testID="order-item-check" />
          </View>

          {/* Photos */}
          {(isAdmin || order.photos?.length > 0) ? (
            <View style={styles.photoSection}>
              <View style={styles.photoHeader}>
                <Text style={styles.sectionTitle}>Foto Cucian</Text>
                {isAdmin ? (
                  <View style={styles.photoActions}>
                    <Pressable onPress={() => pickAndUpload(true)} style={styles.photoBtn} testID="photo-camera" disabled={uploading}>
                      <Ionicons name="camera" size={18} color={colors.brandPrimary} />
                    </Pressable>
                    <Pressable onPress={() => pickAndUpload(false)} style={styles.photoBtn} testID="photo-gallery" disabled={uploading}>
                      <Ionicons name="image" size={18} color={colors.brandPrimary} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
              {uploading ? (
                <View style={styles.photoLoading}><ActivityIndicator color={colors.brandPrimary} /><Text style={styles.photoLoadingText}>Mengunggah...</Text></View>
              ) : null}
              {order.photos?.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                  {order.photos.map((p: string, i: number) => <PhotoThumb key={p + i} path={p} />)}
                </ScrollView>
              ) : (
                <Text style={styles.photoEmpty}>
                  {isAdmin ? "Tambahkan foto cucian agar pelanggan tenang" : "Belum ada foto"}
                </Text>
              )}
            </View>
          ) : null}

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
          {/* Customer: konfirmasi pesanan diterima */}
          {!isAdmin && order.status === "siap" ? (
            <View style={styles.actionBox}>
              <Text style={styles.sectionTitle}>Pesanan Siap</Text>
              <Text style={styles.actionHint}>
                {order.service === "branch"
                  ? "Silakan ambil di cabang. Konfirmasi bila sudah diterima (otomatis selesai dalam 24 jam)."
                  : "Kurir akan mengantar pesanan Anda. Konfirmasi bila sudah diterima."}
              </Text>
              <Button
                title="Konfirmasi Pesanan Diterima"
                icon="checkmark-done-outline"
                onPress={() => confirmReceived.mutate()}
                loading={confirmReceived.isPending}
                testID="confirm-received"
                style={{ marginTop: spacing.sm }}
              />
            </View>
          ) : null}

          {/* Riwayat komplain / cuci ulang */}
          {order.complaints?.length > 0 ? (
            <View style={styles.actionBox}>
              <Text style={styles.sectionTitle}>Riwayat Komplain / Cuci Ulang</Text>
              {order.complaints.map((c: any) => (
                <View key={c.id} style={styles.complaintItem}>
                  <View style={styles.complaintHead}>
                    <Ionicons name="alert-circle" size={16} color={colors.error} />
                    <Text style={styles.complaintReason}>{c.reason}</Text>
                  </View>
                  {c.photos?.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginTop: spacing.xs }}>
                      {c.photos.map((p: string, i: number) => <PhotoThumb key={p + i} path={p} />)}
                    </ScrollView>
                  ) : null}
                  <Text style={styles.complaintDate}>{formatDate(c.created_at)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Customer: ajukan cuci ulang */}
          {!isAdmin && (order.status === "siap" || order.status === "selesai") ? (
            showRewash ? (
              <View style={styles.actionBox}>
                <Text style={styles.sectionTitle}>Ajukan Cuci Ulang</Text>
                <TextInput
                  style={styles.commentInput}
                  value={rewashReason}
                  onChangeText={setRewashReason}
                  placeholder="Jelaskan keluhan (mis. masih ada noda di kerah)"
                  placeholderTextColor={colors.muted}
                  multiline
                  testID="rewash-reason"
                />
                <Text style={styles.actionHint}>Foto bukti (opsional)</Text>
                <View style={styles.rewashPhotoRow}>
                  {rewashPhotos.map((p, i) => <PhotoThumb key={p + i} path={p} />)}
                  <Pressable style={styles.addPhoto} onPress={() => pickComplaintPhoto(true)} disabled={uploading} testID="rewash-camera">
                    <Ionicons name="camera" size={22} color={colors.brandPrimary} />
                  </Pressable>
                  <Pressable style={styles.addPhoto} onPress={() => pickComplaintPhoto(false)} disabled={uploading} testID="rewash-gallery">
                    <Ionicons name="image" size={22} color={colors.brandPrimary} />
                  </Pressable>
                </View>
                {uploading ? <ActivityIndicator color={colors.brandPrimary} /> : null}
                <View style={styles.rewashBtns}>
                  <Pressable style={styles.cancelBtn} onPress={() => setShowRewash(false)} testID="rewash-cancel">
                    <Text style={styles.cancelText}>Batal</Text>
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Kirim"
                      onPress={() => {
                        if (!rewashReason.trim()) { toast("Isi keluhan Anda", "error"); return; }
                        sendRewash.mutate();
                      }}
                      loading={sendRewash.isPending}
                      testID="rewash-submit"
                    />
                  </View>
                </View>
              </View>
            ) : (
              <Pressable style={styles.rewashTrigger} onPress={() => setShowRewash(true)} testID="rewash-open">
                <Ionicons name="refresh-circle-outline" size={20} color={colors.error} />
                <Text style={styles.rewashTriggerText}>Ada masalah? Ajukan Cuci Ulang</Text>
              </Pressable>
            )
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

function PhotoThumb({ path }: { path: string }) {
  const styles = useStyles();
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fileUrl(path).then((u) => alive && setUri(u));
    return () => { alive = false; };
  }, [path]);
  return (
    <View style={styles.thumb} testID="laundry-photo">
      {uri ? <Image source={{ uri }} style={styles.thumbImg} contentFit="cover" /> : null}
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
  estimateBox: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  estimateLabel: { fontFamily: font.regular, fontSize: 12, color: colors.onBrandTertiary },
  estimateValue: { fontFamily: font.semibold, fontSize: 15, color: colors.onBrandTertiary, marginTop: 2 },
  photoSection: { marginTop: spacing.md },
  photoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  photoActions: { flexDirection: "row", gap: spacing.sm },
  photoBtn: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  photoLoading: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.sm },
  photoLoadingText: { fontFamily: font.regular, fontSize: 13, color: colors.muted },
  photoEmpty: { fontFamily: font.regular, fontSize: 13, color: colors.muted, marginTop: spacing.xs },
  thumb: { width: 100, height: 100, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surfaceTertiary },
  thumbImg: { width: "100%", height: "100%" },
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
  qrCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg },
  qrBox: { padding: spacing.sm, backgroundColor: "#FFFFFF", borderRadius: radius.sm },
  qrTitle: { fontFamily: font.bold, fontSize: 15, color: colors.onSurface },
  qrDesc: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  qrCode: { fontFamily: font.bold, fontSize: 14, color: colors.brandPrimary, marginTop: spacing.xs, letterSpacing: 1 },
  actionBox: { marginTop: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  actionHint: { fontFamily: font.regular, fontSize: 13, color: colors.muted },
  complaintItem: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.xs },
  complaintHead: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  complaintReason: { flex: 1, fontFamily: font.medium, fontSize: 14, color: colors.onSurface },
  complaintDate: { fontFamily: font.regular, fontSize: 11, color: colors.muted, marginTop: 2 },
  rewashPhotoRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  addPhoto: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  rewashBtns: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
  cancelBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  cancelText: { fontFamily: font.semibold, fontSize: 14, color: colors.onSurfaceTertiary },
  rewashTrigger: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.error },
  rewashTriggerText: { fontFamily: font.semibold, fontSize: 14, color: colors.error },
}));
