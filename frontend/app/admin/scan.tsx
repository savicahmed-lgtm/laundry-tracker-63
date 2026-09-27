import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/toast";
import { STATUS_META, adminAction } from "@/src/format";
import { Button } from "@/src/components/ui";
import { OrderItemsCard } from "@/src/components/order-items-card";
import { queryClient } from "@/src/query-client";
import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

export default function ScanScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const toast = useToast();
  const role = user?.role ?? "";

  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [doneLabel, setDoneLabel] = useState<string | null>(null);
  const lockRef = useRef(false);

  // Cari pesanan lalu tampilkan rincian item untuk dicocokkan — status TIDAK langsung diubah.
  const process = async (raw: string) => {
    const code = raw.trim().toUpperCase();
    if (!code || busy) return;
    setBusy(true);
    try {
      const found = await api.scan(code);
      setOrder(found);
      setDoneLabel(null);
      setManual("");
    } catch (e: any) {
      toast(e.message || "Pesanan tidak ditemukan", "error");
    } finally {
      setBusy(false);
      setTimeout(() => (lockRef.current = false), 1500);
    }
  };

  // Dipanggil setelah petugas mencocokkan rincian item dengan cucian fisik.
  const confirm = async () => {
    if (!order) return;
    const action = adminAction(role, order);
    if (!action || action.kind !== "status") return;
    setBusy(true);
    try {
      await api.setStatus(order.id, action.target);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", order.id] });
      setDoneLabel(action.label);
      toast(`${order.code} → ${action.label}`, "success");
    } catch (e: any) {
      toast(e.message || "Gagal memperbarui status", "error");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setOrder(null);
    setDoneLabel(null);
    setManual("");
    lockRef.current = false;
  };

  const onBarcode = ({ data }: { data: string }) => {
    if (lockRef.current) return;
    lockRef.current = true;
    process(data);
  };

  const canUseCamera = Platform.OS !== "web" && permission?.granted;
  const action = order ? adminAction(role, order) : null;
  const statusMeta = order ? STATUS_META[order.status as keyof typeof STATUS_META] : null;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="scan-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Scan QR Pesanan</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.cameraWrap}>
        {canUseCamera ? (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={busy || order ? undefined : onBarcode}
          />
        ) : (
          <View style={styles.cameraFallback}>
            <Ionicons name="qr-code-outline" size={64} color={colors.borderStrong} />
            <Text style={styles.fallbackText}>
              {Platform.OS === "web"
                ? "Kamera scan hanya tersedia di aplikasi HP. Gunakan input kode manual di bawah."
                : "Butuh izin kamera untuk memindai QR pesanan."}
            </Text>
            {Platform.OS !== "web" && !permission?.granted ? (
              <Button title="Izinkan Kamera" onPress={requestPermission} style={{ marginTop: spacing.md }} />
            ) : null}
          </View>
        )}
        {canUseCamera ? <View style={styles.frame} pointerEvents="none" /> : null}
      </View>

      <View style={styles.panel}>
        {order && doneLabel ? (
          <View style={styles.resultCard} testID="scan-result">
            <Ionicons name="checkmark-circle" size={40} color={colors.success} />
            <Text style={styles.resultTitle}>{order.code}</Text>
            <Text style={styles.resultSub}>{order.customer_name} · ditandai {doneLabel}</Text>
            <Button
              title="Scan Berikutnya"
              variant="outline"
              icon="qr-code-outline"
              onPress={reset}
              testID="scan-next"
              style={{ marginTop: spacing.sm, alignSelf: "stretch" }}
            />
          </View>
        ) : order ? (
          <ScrollView style={styles.verifyScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.verifyCard} testID="scan-verify">
              <View style={styles.verifyHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.verifyCode}>{order.code}</Text>
                  <Text style={styles.verifySub}>{order.customer_name} · {order.customer_phone}</Text>
                </View>
                {statusMeta ? (
                  <View style={styles.statusChip}>
                    <Text style={styles.statusChipText}>{statusMeta.label}</Text>
                  </View>
                ) : null}
              </View>

              <OrderItemsCard order={order} testID="scan-items" />

              <Text style={styles.matchHint}>Cocokkan rincian item di atas dengan cucian fisik sebelum menandai tahap selesai.</Text>

              {action?.kind === "status" ? (
                <>
                  <Button
                    title={`Cocok & Tandai ${action.label}`}
                    icon="checkmark-done"
                    onPress={confirm}
                    loading={busy}
                    testID="scan-confirm"
                  />
                  <Button title="Batal" variant="outline" onPress={reset} testID="scan-cancel" />
                </>
              ) : (
                <>
                  <View style={styles.warnBox}>
                    <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
                    <Text style={styles.warnText}>
                      Pesanan berstatus &quot;{statusMeta?.label ?? order.status}&quot; — belum bisa diproses di tahap Anda. Rincian item tetap ditampilkan untuk pencocokan.
                    </Text>
                  </View>
                  <Button title="Tutup" variant="outline" onPress={reset} testID="scan-close" />
                </>
              )}
            </View>
          </ScrollView>
        ) : (
          <Text style={styles.hint}>Arahkan kamera ke QR pesanan, atau masukkan kode manual.</Text>
        )}

        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            value={manual}
            onChangeText={setManual}
            placeholder="Kode mis. SUCI-ABC123"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            testID="scan-manual-input"
          />
          <Pressable
            style={styles.manualBtn}
            onPress={() => process(manual)}
            disabled={busy}
            testID="scan-manual-submit"
          >
            {busy ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Ionicons name="arrow-forward" size={22} color={colors.onBrandPrimary} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontFamily: font.bold, fontSize: 17, color: colors.onSurface },
  cameraWrap: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  cameraFallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm, backgroundColor: colors.surfaceSecondary },
  fallbackText: { fontFamily: font.regular, fontSize: 14, color: colors.muted, textAlign: "center" },
  frame: { position: "absolute", width: 220, height: 220, borderWidth: 3, borderColor: colors.brandPrimary, borderRadius: radius.lg },
  panel: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  hint: { fontFamily: font.regular, fontSize: 14, color: colors.muted, textAlign: "center" },
  resultCard: { alignItems: "center", gap: spacing.xs, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.lg },
  resultTitle: { fontFamily: font.bold, fontSize: 18, color: colors.onBrandTertiary },
  resultSub: { fontFamily: font.medium, fontSize: 13, color: colors.onBrandTertiary },
  verifyScroll: { maxHeight: 440, flexGrow: 0 },
  verifyCard: { gap: spacing.md },
  verifyHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  verifyCode: { fontFamily: font.bold, fontSize: 18, color: colors.onSurface },
  verifySub: { fontFamily: font.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  statusChip: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  statusChipText: { fontFamily: font.semibold, fontSize: 11, color: colors.onSurfaceTertiary },
  matchHint: { fontFamily: font.regular, fontSize: 12, color: colors.muted, textAlign: "center" },
  warnBox: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  warnText: { flex: 1, fontFamily: font.medium, fontSize: 13, color: colors.onSurfaceSecondary },
  manualRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  manualInput: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 52, fontFamily: font.semibold, fontSize: 16, color: colors.onSurface, borderWidth: 1, borderColor: colors.border },
  manualBtn: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
}));
