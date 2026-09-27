import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { useAuth } from "@/src/auth";
import { useToast } from "@/src/toast";
import { Button } from "@/src/components/ui";
import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

export default function RegisterScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name.trim() || !phone.trim() || password.length < 4) {
      toast("Lengkapi nama, HP, dan password (min 4 karakter)", "error");
      return;
    }
    setLoading(true);
    try {
      await register({ name: name.trim(), phone: phone.trim(), address: address.trim(), password });
      toast("Akun berhasil dibuat", "success");
      router.replace("/(tabs)");
    } catch (e: any) {
      toast(e.message || "Gagal mendaftar", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="register-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Daftar Akun</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>Buat akun untuk mulai memesan laundry</Text>

        <Field icon="person-outline" placeholder="Nama lengkap" value={name} onChangeText={setName} testID="reg-name-input" />
        <Field icon="call-outline" placeholder="Nomor HP" value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="reg-phone-input" />
        <Field icon="location-outline" placeholder="Alamat" value={address} onChangeText={setAddress} testID="reg-address-input" />
        <Field icon="lock-closed-outline" placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry testID="reg-password-input" />

        <Button title="Daftar" onPress={submit} loading={loading} testID="register-submit-button" style={{ marginTop: spacing.md }} />

        <Pressable onPress={() => router.back()} style={styles.footer} testID="go-login-link">
          <Text style={styles.footerText}>Sudah punya akun? </Text>
          <Text style={styles.footerLink}>Masuk</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

function Field(props: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { icon, ...rest } = props;
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={20} color={colors.muted} />
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        {...rest}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: { fontFamily: font.semibold, fontSize: 18, color: colors.onSurface },
  content: { padding: spacing.xl, gap: spacing.md },
  subtitle: { fontFamily: font.regular, fontSize: 14, color: colors.muted, marginBottom: spacing.xs },
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
}));
