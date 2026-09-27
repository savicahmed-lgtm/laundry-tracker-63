import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
  icon,
  testID,
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "outline";
  icon?: string;
  testID?: string;
  style?: ViewStyle;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const bgStyle =
    variant === "primary" ? styles.primary : variant === "secondary" ? styles.secondary : styles.outline;
  const txtStyle =
    variant === "primary" ? styles.primaryText : variant === "secondary" ? styles.secondaryText : styles.outlineText;
  const spinner = variant === "outline" ? colors.brandPrimary : colors.onBrandPrimary;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [styles.base, bgStyle, isDisabled && styles.disabled, pressed && styles.pressed, style]}
    >
      {loading ? (
        <ActivityIndicator color={spinner} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon as any} size={18} color={variant === "outline" ? colors.brandPrimary : colors.onBrandPrimary} /> : null}
          <Text style={txtStyle}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Card({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) {
  const styles = useStyles();
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  testID,
}: {
  value: number;
  onChange: (v: number) => void;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.stepper} testID={testID}>
      <Pressable
        testID={testID ? `${testID}-minus` : undefined}
        onPress={() => onChange(Math.max(0, value - 1))}
        style={styles.stepBtn}
        hitSlop={6}
      >
        <Ionicons name="remove" size={18} color={value === 0 ? colors.muted : colors.brandPrimary} />
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        testID={testID ? `${testID}-plus` : undefined}
        onPress={() => onChange(value + 1)}
        style={styles.stepBtn}
        hitSlop={6}
      >
        <Ionicons name="add" size={18} color={colors.brandPrimary} />
      </Pressable>
    </View>
  );
}

export function StarRating({
  value,
  onChange,
  size = 32,
  readOnly,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: spacing.xs }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          testID={`star-${n}`}
          disabled={readOnly}
          onPress={() => onChange?.(n)}
          hitSlop={4}
        >
          <Ionicons
            name={n <= value ? "star" : "star-outline"}
            size={size}
            color={n <= value ? colors.warning : colors.borderStrong}
          />
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  primary: { backgroundColor: colors.brandPrimary },
  secondary: { backgroundColor: colors.brandTertiary },
  outline: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.brandPrimary },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  primaryText: { color: colors.onBrandPrimary, fontFamily: font.semibold, fontSize: 16 },
  secondaryText: { color: colors.onBrandTertiary, fontFamily: font.semibold, fontSize: 16 },
  outlineText: { color: colors.brandPrimary, fontFamily: font.semibold, fontSize: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.pill,
  },
  stepBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  stepValue: { minWidth: 24, textAlign: "center", fontFamily: font.semibold, fontSize: 16, color: colors.onSurface },
}));
