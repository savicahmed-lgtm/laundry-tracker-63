// Design tokens for Loundry Suci — green-forward "iOS-Native Clean" theme.
// Keys match the "color" block of /app/design_guidelines.json.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#111827",
  surfaceSecondary: "#F4F7F5",
  onSurfaceSecondary: "#1F2937",
  surfaceTertiary: "#EAEFEA",
  onSurfaceTertiary: "#374151",
  surfaceInverse: "#111827",
  onSurfaceInverse: "#FFFFFF",
  muted: "#6B7280",

  brand: "#059669",
  onBrand: "#FFFFFF",
  brandPrimary: "#059669",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#10B981",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#D1FAE5",
  onBrandTertiary: "#065F46",

  success: "#16A34A",
  onSuccess: "#FFFFFF",
  warning: "#F59E0B",
  onWarning: "#FFFFFF",
  error: "#EF4444",
  onError: "#FFFFFF",
  info: "#3B82F6",
  onInfo: "#FFFFFF",

  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  divider: "#F3F4F6",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

// Spacing & radius tokens from design_guidelines.json
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 } as const;
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 } as const;

// Plus Jakarta Sans weights (registered in app/_layout.tsx via expo-font)
export const font = {
  regular: "PJS-400",
  medium: "PJS-500",
  semibold: "PJS-600",
  bold: "PJS-700",
} as const;
