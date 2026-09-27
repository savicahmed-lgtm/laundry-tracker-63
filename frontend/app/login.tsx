import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { useAuth } from "@/src/auth";
import { useToast } from "@/src/toast";
import { Button } from "@/src/components/ui";
import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

const HERO =
  "https://images.unsplash.com/photo-1699797467199-6bdf301649e8?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function LoginScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!phone.trim() || !password) {
      toast("Isi nomor HP dan password", "error");
      return;
    }
    setLoading(true);
    try {
      const u = await login(phone.trim(), password);
      toast(`Selamat datang, ${u.name}`, "success");
      router.replace(u.role === "admin" ? "/admin" : "/(tabs)");
    } catch (e: any) {
      toast(e.message || "Gagal masuk", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Image source={{ uri: HERO }} style={styles.heroImg} contentFit="cover" />
        <LinearGradient
          colors={["rgba(5,150,105,0.35)", "rgba(17,24,39,0.85)"]}
          style={styles.scrim}
        />
        <View style={[styles.heroContent, { paddingTop: insets.top + spacing.xl }]}>
          <View style={styles.logo}>
            <Ionicons name="water" size={30} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.brand}>Loundry Suci</Text>
          <Text style={styles.tagline}>Cucian bersih, wangi & terlacak</Text>
        </View>
      </View>

      <KeyboardAwareScrollView
        style={styles.form}
        contentContainerStyle={styles.formContent}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Masuk</Text>
        <Text style={styles.subtitle}>Gunakan nomor HP terdaftar Anda</Text>

        <View style={styles.field}>
          <Ionicons name="call-outline" size={20} color={colors.muted} />
          <TextInput
            testID="login-phone-input"
            style={styles.input}
            placeholder="Nomor HP (mis. 0812xxxx)"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            autoCapitalize="none"
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        <View style={styles.field}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.muted} />
          <TextInput
            testID="login-password-input"
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.muted}
            secureTextEntry={secure}
            value={password}
            onChangeText={setPassword}
          />
          <Pressable onPress={() => setSecure((s) => !s)} hitSlop={8}>
            <Ionicons name={secure ? "eye-outline" : "eye-off-outline"} size={20} color={colors.muted} />
          </Pressable>
        </View>

        <Button title="Masuk" onPress={submit} loading={loading} testID="login-submit-button" style={{ marginTop: spacing.sm }} />

        <Pressable onPress={() => router.push("/register")} style={styles.footer} testID="go-register-link">
          <Text style={styles.footerText}>Belum punya akun? </Text>
          <Text style={styles.footerLink}>Daftar</Text>
        </Pressable>

        <View style={styles.demo}>
          <Text style={styles.demoText}>Demo pelanggan: 081211112222 / password123</Text>
          <Text style={styles.demoText}>Demo admin: 081200000000 / admin123</Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 260 },
  heroImg: { ...({ position: "absolute" } as any), top: 0, left: 0, right: 0, bottom: 0 },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  heroContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xs },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  brand: { color: colors.onBrandPrimary, fontFamily: font.bold, fontSize: 28 },
  tagline: { color: colors.onBrandPrimary, fontFamily: font.regular, fontSize: 14, opacity: 0.9 },
  form: { flex: 1, marginTop: -24 },
  formContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    minHeight: 400,
  },
  title: { fontFamily: font.bold, fontSize: 24, color: colors.onSurface },
  subtitle: { fontFamily: font.regular, fontSize: 14, color: colors.muted, marginBottom: spacing.sm },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 54,
  },
  input: { flex: 1, fontFamily: font.regular, fontSize: 16, color: colors.onSurface },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.md },
  footerText: { fontFamily: font.regular, color: colors.muted, fontSize: 14 },
  footerLink: { fontFamily: font.semibold, color: colors.brandPrimary, fontSize: 14 },
  demo: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    gap: 2,
  },
  demoText: { fontFamily: font.regular, fontSize: 12, color: colors.muted, textAlign: "center" },
}));
