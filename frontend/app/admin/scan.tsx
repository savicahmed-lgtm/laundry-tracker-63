import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/toast";
import { STATUS_META, adminAction } from "@/src/format";
import { Button } from "@/src/components/ui";
import { queryClient } from "@/src/query-client";
import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

type Result = { code: string; label: string; customer: string } | null;

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
  const [result, setResult] = useState<Result>(null);
  const lockRef = useRef(false);

  const process = async (raw: string) => {
    const code = raw.trim().toUpperCase();
    if (!code || busy) return;
    setBusy(true);
    try {
      const order = await api.scan(code);
      const action = adminAction(role, order);
      if (!action || action.kind !== "status") {
        toast(
          `Pesanan ${order.code} berstatus "${STATUS_META[order.status as keyof typeof STATUS_META]?.label ?? order.status}" — belum bisa diproses di tahap Anda`,
          "error",
        );
        return;
      }
      await api.setStatus(order.id, action.target);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", order.id] });
      setResult({ code: order.code, label: action.label, customer: order.customer_name });
      toast(`${order.code} → ${action.label}`, "success");
      setManual("");
    } catch (e: any) {
      toast(e.message || "Pesanan tidak ditemukan", "error");
    } finally {
      setBusy(false);
      setTimeout(() => (lockRef.current = false), 1500);
    }
  };

  const onBarcode = ({ data }: { data: string }) => {
    if (lockRef.current) return;
    lockRef.current = true;
    process(data);
  };

  const canUseCamera = Platform.OS !== "web" && permission?.granted;

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
            onBarcodeScanned={busy ? undefined : onBarcode}
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
        {result ? (
          <View style={styles.resultCard} testID="scan-result">
            <Ionicons name="checkmark-circle" size={40} color={colors.success} />
            <Text style={styles.resultTitle}>{result.code}</Text>
            <Text style={styles.resultSub}>{result.customer} · ditandai {result.label}</Text>
          </View>
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
  manualRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  manualInput: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 52, fontFamily: font.semibold, fontSize: 16, color: colors.onSurface, borderWidth: 1, borderColor: colors.border },
  manualBtn: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
}));
