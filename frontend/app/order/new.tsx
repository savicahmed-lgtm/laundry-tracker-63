import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/toast";
import { formatRp } from "@/src/format";
import { Button, Stepper } from "@/src/components/ui";
import { queryClient } from "@/src/query-client";
import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

export default function NewOrderScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const toast = useToast();
  const params = useLocalSearchParams<{ item?: string }>();

  const catalogQ = useQuery({ queryKey: ["catalog"], queryFn: api.catalog });
  const items = catalogQ.data?.items ?? [];
  const freeKgValue = catalogQ.data?.free_kg_value ?? 7000;

  const [qty, setQty] = useState<Record<string, number>>(() => (params.item ? { [params.item]: 1 } : {}));
  const [service, setService] = useState<"pickup" | "branch">("pickup");
  const [address, setAddress] = useState(user?.address ?? "");
  const [note, setNote] = useState("");
  const [usePoints, setUsePoints] = useState(false);

  const canRedeem = (user?.points ?? 0) >= 25;

  const { subtotal, weight, count } = useMemo(() => {
    let s = 0, w = 0, c = 0;
    for (const it of items) {
      const q = qty[it.key] ?? 0;
      s += it.price * q;
      w += it.weight_kg * q;
      c += q;
    }
    return { subtotal: s, weight: w, count: c };
  }, [items, qty]);

  const discount = usePoints && canRedeem ? freeKgValue : 0;
  const total = Math.max(subtotal - discount, 0);
  const pointsEarned = Math.max(Math.round(weight), count > 0 ? 1 : 0);

  const create = useMutation({
    mutationFn: () =>
      api.createOrder({
        items: Object.entries(qty).filter(([, q]) => q > 0).map(([key, q]) => ({ key, qty: q })),
        service,
        address: service === "pickup" ? address.trim() : "",
        note: note.trim(),
        use_points: usePoints && canRedeem,
      }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast("Pesanan dibuat, lanjut pembayaran", "success");
      router.replace(`/order/${order.id}`);
    },
    onError: (e: any) => toast(e.message || "Gagal membuat pesanan", "error"),
  });

  const submit = () => {
    if (count === 0) { toast("Pilih minimal 1 item", "error"); return; }
    if (service === "pickup" && !address.trim()) { toast("Isi alamat penjemputan", "error"); return; }
    create.mutate();
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="new-order-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Pesan Laundry</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.content} bottomOffset={20} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Pilih Item & Jumlah</Text>
        {items.map((it: any) => (
          <View key={it.key} style={styles.itemRow} testID={`item-row-${it.key}`}>
            <View style={styles.itemIcon}>
              <Ionicons name={it.icon as any} size={22} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{it.name}</Text>
              <Text style={styles.itemPrice}>{formatRp(it.price)} · {it.weight_kg} kg</Text>
            </View>
            <Stepper value={qty[it.key] ?? 0} onChange={(v) => setQty((p) => ({ ...p, [it.key]: v }))} testID={`stepper-${it.key}`} />
          </View>
        ))}

        <Text style={styles.sectionTitle}>Opsi Layanan</Text>
        <View style={styles.serviceRow}>
          <ServiceCard active={service === "pickup"} onPress={() => setService("pickup")} icon="bicycle-outline" title="Jemput & Antar" sub="Kurir menjemput" testID="service-pickup" />
          <ServiceCard active={service === "branch"} onPress={() => setService("branch")} icon="storefront-outline" title="Ke Cabang" sub="Antar sendiri" testID="service-branch" />
        </View>

        {service === "pickup" ? (
          <View>
            <Text style={styles.label}>Alamat Penjemputan</Text>
            <TextInput style={[styles.input, styles.multiline]} value={address} onChangeText={setAddress} placeholder="Alamat lengkap" placeholderTextColor={colors.muted} multiline testID="new-order-address" />
          </View>
        ) : null}

        <Text style={styles.label}>Catatan (opsional)</Text>
        <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="mis. jangan pakai pewangi" placeholderTextColor={colors.muted} testID="new-order-note" />

        {canRedeem ? (
          <Pressable style={styles.redeem} onPress={() => setUsePoints((v) => !v)} testID="use-points-toggle">
            <View style={styles.redeemLeft}>
              <Ionicons name="gift" size={20} color={colors.brandPrimary} />
              <View>
                <Text style={styles.redeemTitle}>Tukar 25 poin</Text>
                <Text style={styles.redeemSub}>Gratis 1 kg ({formatRp(freeKgValue)})</Text>
              </View>
            </View>
            <View style={[styles.toggle, usePoints && styles.toggleOn]}>
              <View style={[styles.knob, usePoints && styles.knobOn]} />
            </View>
          </Pressable>
        ) : null}

        <View style={styles.summary}>
          <SummaryRow label="Subtotal" value={formatRp(subtotal)} />
          {discount > 0 ? <SummaryRow label="Diskon poin" value={`- ${formatRp(discount)}`} highlight /> : null}
          <SummaryRow label={`Estimasi berat`} value={`${weight.toFixed(1)} kg`} />
          <SummaryRow label="Poin didapat" value={`+${pointsEarned}`} highlight />
        </View>
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerLabel}>Total</Text>
          <Text style={styles.footerTotal}>{formatRp(total)}</Text>
        </View>
        <Button title="Lanjut Bayar" icon="arrow-forward" onPress={submit} loading={create.isPending} testID="new-order-submit" style={{ flex: 1.4 }} />
      </View>
    </View>
  );
}

function ServiceCard({ active, onPress, icon, title, sub, testID }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable style={[styles.serviceCard, active && styles.serviceCardActive]} onPress={onPress} testID={testID}>
      <Ionicons name={icon} size={24} color={active ? colors.brandPrimary : colors.muted} />
      <Text style={[styles.serviceTitle, active && { color: colors.brandPrimary }]}>{title}</Text>
      <Text style={styles.serviceSub}>{sub}</Text>
    </Pressable>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, highlight && { color: colors.brandPrimary }]}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerTitle: { fontFamily: font.semibold, fontSize: 18, color: colors.onSurface },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  sectionTitle: { fontFamily: font.bold, fontSize: 17, color: colors.onSurface, marginTop: spacing.sm },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  itemIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  itemName: { fontFamily: font.semibold, fontSize: 15, color: colors.onSurface },
  itemPrice: { fontFamily: font.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  serviceRow: { flexDirection: "row", gap: spacing.md },
  serviceCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, alignItems: "center", gap: 4, borderWidth: 1.5, borderColor: colors.border },
  serviceCardActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  serviceTitle: { fontFamily: font.semibold, fontSize: 14, color: colors.onSurface, marginTop: spacing.xs },
  serviceSub: { fontFamily: font.regular, fontSize: 12, color: colors.muted },
  label: { fontFamily: font.medium, fontSize: 13, color: colors.muted, marginTop: spacing.sm, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 50, fontFamily: font.regular, fontSize: 15, color: colors.onSurface, borderWidth: 1, borderColor: colors.border },
  multiline: { minHeight: 72, paddingTop: spacing.md, textAlignVertical: "top" },
  redeem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  redeemLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  redeemTitle: { fontFamily: font.semibold, fontSize: 14, color: colors.onSurface },
  redeemSub: { fontFamily: font.regular, fontSize: 12, color: colors.muted },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.border, padding: 3, justifyContent: "center" },
  toggleOn: { backgroundColor: colors.brandPrimary },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface },
  knobOn: { alignSelf: "flex-end" },
  summary: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm, marginTop: spacing.sm },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontFamily: font.regular, fontSize: 14, color: colors.muted },
  summaryValue: { fontFamily: font.semibold, fontSize: 14, color: colors.onSurface },
  footer: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  footerLabel: { fontFamily: font.regular, fontSize: 12, color: colors.muted },
  footerTotal: { fontFamily: font.bold, fontSize: 20, color: colors.onSurface },
}));
