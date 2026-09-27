import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/toast";
import { Button } from "@/src/components/ui";
import { queryClient } from "@/src/query-client";
import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

export default function AddressesScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { refresh } = useAuth();

  const addrQ = useQuery({ queryKey: ["addresses"], queryFn: api.addresses });
  const addresses = addrQ.data?.addresses ?? [];

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [detail, setDetail] = useState("");

  const done = () => {
    queryClient.invalidateQueries({ queryKey: ["addresses"] });
    refresh();
    setShowForm(false);
    setEditId(null);
    setLabel("");
    setDetail("");
  };

  const saveMut = useMutation({
    mutationFn: () =>
      editId
        ? api.updateAddress(editId, { label: label.trim(), detail: detail.trim() })
        : api.addAddress({ label: label.trim(), detail: detail.trim() }),
    onSuccess: () => {
      toast(editId ? "Alamat diperbarui" : "Alamat ditambahkan", "success");
      done();
    },
    onError: (e: any) => toast(e.message || "Gagal menyimpan", "error"),
  });

  const setDefaultMut = useMutation({
    mutationFn: (aid: string) => api.setDefaultAddress(aid),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["addresses"] }); refresh(); toast("Alamat utama diperbarui", "success"); },
    onError: (e: any) => toast(e.message || "Gagal", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (aid: string) => api.deleteAddress(aid),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["addresses"] }); refresh(); toast("Alamat dihapus", "success"); },
    onError: (e: any) => toast(e.message || "Gagal", "error"),
  });

  const openEdit = (a: any) => {
    setEditId(a.id);
    setLabel(a.label);
    setDetail(a.detail);
    setShowForm(true);
  };

  const openNew = () => {
    setEditId(null);
    setLabel("");
    setDetail("");
    setShowForm(true);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="addresses-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Alamat Tersimpan</Text>
        <View style={{ width: 26 }} />
      </View>

      {addrQ.isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.brandPrimary} /></View>
      ) : (
        <KeyboardAwareScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.md }}
          bottomOffset={20}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {addresses.length === 0 && !showForm ? (
            <View style={styles.empty}>
              <Ionicons name="location-outline" size={48} color={colors.borderStrong} />
              <Text style={styles.emptyText}>Belum ada alamat tersimpan</Text>
            </View>
          ) : null}

          {addresses.map((a: any) => (
            <View key={a.id} style={styles.card} testID={`address-${a.id}`}>
              <View style={styles.cardTop}>
                <View style={styles.labelWrap}>
                  <Ionicons name="location" size={16} color={colors.brandPrimary} />
                  <Text style={styles.label}>{a.label}</Text>
                  {a.is_default ? <View style={styles.defaultPill}><Text style={styles.defaultText}>Utama</Text></View> : null}
                </View>
                <View style={styles.actions}>
                  <Pressable onPress={() => openEdit(a)} hitSlop={8} testID={`edit-${a.id}`}>
                    <Ionicons name="create-outline" size={20} color={colors.muted} />
                  </Pressable>
                  <Pressable onPress={() => deleteMut.mutate(a.id)} hitSlop={8} testID={`delete-${a.id}`}>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.detail}>{a.detail}</Text>
              {!a.is_default ? (
                <Pressable style={styles.setDefault} onPress={() => setDefaultMut.mutate(a.id)} testID={`default-${a.id}`}>
                  <Ionicons name="star-outline" size={15} color={colors.brandPrimary} />
                  <Text style={styles.setDefaultText}>Jadikan utama</Text>
                </Pressable>
              ) : null}
            </View>
          ))}

          {showForm ? (
            <View style={styles.form}>
              <Text style={styles.formTitle}>{editId ? "Edit Alamat" : "Alamat Baru"}</Text>
              <Text style={styles.fieldLabel}>Label (mis. Rumah, Kantor)</Text>
              <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Rumah" placeholderTextColor={colors.muted} testID="address-label-input" />
              <Text style={styles.fieldLabel}>Alamat lengkap</Text>
              <TextInput style={[styles.input, styles.multiline]} value={detail} onChangeText={setDetail} placeholder="Jl. ..." placeholderTextColor={colors.muted} multiline testID="address-detail-input" />
              <View style={styles.formBtns}>
                <Pressable style={styles.cancelBtn} onPress={done} testID="address-cancel"><Text style={styles.cancelText}>Batal</Text></Pressable>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Simpan"
                    onPress={() => {
                      if (!label.trim() || !detail.trim()) { toast("Isi label & alamat", "error"); return; }
                      saveMut.mutate();
                    }}
                    loading={saveMut.isPending}
                    testID="address-save"
                  />
                </View>
              </View>
            </View>
          ) : (
            <Pressable style={styles.addBtn} onPress={openNew} testID="address-add">
              <Ionicons name="add-circle-outline" size={22} color={colors.brandPrimary} />
              <Text style={styles.addText}>Tambah Alamat</Text>
            </Pressable>
          )}
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontFamily: font.bold, fontSize: 17, color: colors.onSurface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing["2xl"] },
  emptyText: { fontFamily: font.medium, fontSize: 15, color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  labelWrap: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flex: 1 },
  label: { fontFamily: font.bold, fontSize: 15, color: colors.onSurface },
  defaultPill: { backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  defaultText: { fontFamily: font.semibold, fontSize: 10, color: colors.onBrandTertiary },
  actions: { flexDirection: "row", gap: spacing.md },
  detail: { fontFamily: font.regular, fontSize: 14, color: colors.onSurfaceSecondary },
  setDefault: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start", marginTop: spacing.xs },
  setDefaultText: { fontFamily: font.semibold, fontSize: 13, color: colors.brandPrimary },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.brandPrimary, borderStyle: "dashed" },
  addText: { fontFamily: font.semibold, fontSize: 15, color: colors.brandPrimary },
  form: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.xs },
  formTitle: { fontFamily: font.bold, fontSize: 16, color: colors.onSurface, marginBottom: spacing.xs },
  fieldLabel: { fontFamily: font.medium, fontSize: 13, color: colors.muted, marginTop: spacing.sm },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 50, fontFamily: font.regular, fontSize: 15, color: colors.onSurface, marginTop: spacing.xs },
  multiline: { minHeight: 76, paddingTop: spacing.md, textAlignVertical: "top" },
  formBtns: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md },
  cancelBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  cancelText: { fontFamily: font.semibold, fontSize: 14, color: colors.onSurfaceTertiary },
}));
