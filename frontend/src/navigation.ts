import { Platform } from "react-native";

// iOS 26+ gets real Liquid Glass NativeTabs; everything else uses the classic JS tab bar.
export const usesNativeTabs =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;

export function isAdminRole(role?: string): boolean {
  return !!role && role.startsWith("admin");
}
