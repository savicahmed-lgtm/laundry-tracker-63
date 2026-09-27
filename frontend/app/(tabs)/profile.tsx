import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/toast";
import { usesNativeTabs } from "@/src/navigation";
import { Button } from "@/src/components/ui";
import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

export default function ProfileScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const [name, setName] = useState(user?.name ?? "");

  const save = useMutation({
    mutationFn: () => api.updateMe({ name: name.trim() }),
    onSuccess: (u) => {
      setUser(u);
      toast("Profil diperbarui", "success");
    },
    onError: (e: any) => toast(e.message || "Gagal menyimpan", "error"),
  });

  const defaultAddr = (user?.addresses ?? []).find((a) => a.is_default);
  const addrCount = (user?.addresses ?? []).length;

  const points = user?.points ?? 0;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: bottomChrome + spacing["2xl"], gap: spacing.lg }} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name || "?").charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.phone}>{user?.phone}</Text>
          <Pressable style={styles.pointsPill} onPress={() => router.push("/points-history")} testID="profile-points-pill">
            <Ionicons name="gift" size={16} color={colors.onBrandTertiary} />
            <Text style={styles.pointsPillText}>{points} poin · {Math.floor(points / 25)} kg gratis</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.onBrandTertiary} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Diri</Text>
          <Text style={styles.label}>Nama</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nama" placeholderTextColor={colors.muted} testID="profile-name-input" />
          <Button title="Simpan Perubahan" onPress={() => save.mutate()} loading={save.isPending} testID="profile-save-button" style={{ marginTop: spacing.md }} />
        </View>

        <Pressable style={styles.section} onPress={() => router.push("/addresses")} testID="profile-addresses">
          <View style={styles.addrRow}>
            <View style={styles.addrIcon}>
              <Ionicons name="location-outline" size={20} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addrTitle}>Alamat Tersimpan</Text>
              <Text style={styles.addrSub} numberOfLines={1}>
                {addrCount > 0 ? `${addrCount} alamat · ${defaultAddr?.detail ?? ""}` : "Belum ada alamat"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </View>
        </Pressable>

        <Pressable style={styles.logout} onPress={async () => { await logout(); router.replace("/login"); }} testID="logout-button">
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Keluar</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  headerCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", gap: spacing.xs, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: font.bold, fontSize: 30, color: colors.onBrandPrimary },
  name: { fontFamily: font.bold, fontSize: 20, color: colors.onSurface, marginTop: spacing.sm },
  phone: { fontFamily: font.regular, fontSize: 14, color: colors.muted },
  pointsPill: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, marginTop: spacing.sm },
  pointsPillText: { fontFamily: font.semibold, fontSize: 13, color: colors.onBrandTertiary },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontFamily: font.bold, fontSize: 17, color: colors.onSurface, marginBottom: spacing.md },
  label: { fontFamily: font.medium, fontSize: 13, color: colors.muted, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 50, fontFamily: font.regular, fontSize: 15, color: colors.onSurface },
  multiline: { minHeight: 80, paddingTop: spacing.md, textAlignVertical: "top" },
  addrRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  addrIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  addrTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.onSurface },
  addrSub: { fontFamily: font.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  logoutText: { fontFamily: font.semibold, fontSize: 15, color: colors.error },
}));
