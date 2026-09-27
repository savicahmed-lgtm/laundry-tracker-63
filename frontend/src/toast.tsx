import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

type ToastKind = "success" | "error" | "info";
type ToastState = { message: string; kind: ToastKind } | null;

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastState>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, kind: ToastKind = "info") => {
      setToast({ message, kind });
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
          setToast(null),
        );
      }, 2600);
    },
    [opacity],
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const bg =
    toast?.kind === "success" ? colors.success : toast?.kind === "error" ? colors.error : colors.surfaceInverse;
  const icon =
    toast?.kind === "success" ? "checkmark-circle" : toast?.kind === "error" ? "alert-circle" : "information-circle";

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.wrap, { top: insets.top + spacing.md, opacity }]}
        >
          <View style={[styles.toast, { backgroundColor: bg }]} testID="app-toast">
            <Ionicons name={icon as any} size={20} color={colors.onSurfaceInverse} />
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    alignItems: "center",
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    maxWidth: "100%",
    ...StyleSheet.flatten({
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    }),
  },
  text: { color: colors.onSurfaceInverse, fontFamily: font.medium, fontSize: 14, flexShrink: 1 },
}));
