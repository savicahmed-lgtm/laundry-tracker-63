import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme, spacing, radius, font } from "@/src/theme";

export type Coord = { lat: number; lng: number };

export type MapTrackerProps = {
  branch: Coord;
  destination: Coord;
  courier: Coord | null;
  service: string;
  active: boolean;
};

// react-native-maps has no web renderer; show a stylized route map on web.
export default function MapTracker({ branch, destination, courier, active }: MapTrackerProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  // Normalized progress along branch -> destination based on courier position.
  let progress = 0;
  if (courier) {
    const total = Math.hypot(destination.lat - branch.lat, destination.lng - branch.lng) || 1;
    const done = Math.hypot(courier.lat - branch.lat, courier.lng - branch.lng);
    progress = Math.max(0, Math.min(1, done / total));
  }

  // Diagonal route from top-left (branch) to bottom-right (destination).
  const start = { x: 14, y: 20 };
  const end = { x: 80, y: 74 };
  const cx = start.x + (end.x - start.x) * progress;
  const cy = start.y + (end.y - start.y) * progress;

  return (
    <View style={styles.container} testID="map-tracker">
      <LinearGradient colors={["#DCEFE6", "#EAEFEA"]} style={styles.bg}>
        {/* grid streets */}
        {[25, 50, 75].map((p) => (
          <View key={`h${p}`} style={[styles.line, { top: `${p}%`, left: 0, right: 0, height: 1 }]} />
        ))}
        {[25, 50, 75].map((p) => (
          <View key={`v${p}`} style={[styles.line, { left: `${p}%`, top: 0, bottom: 0, width: 1 }]} />
        ))}

        {/* route line */}
        <View
          style={[
            styles.route,
            {
              left: `${start.x}%`,
              top: `${start.y}%`,
              width: `${Math.hypot(end.x - start.x, end.y - start.y)}%`,
              transform: [{ rotate: `${(Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI}deg` }],
            },
          ]}
        />

        {/* branch pin */}
        <View style={[styles.pin, { left: `${start.x}%`, top: `${start.y}%`, backgroundColor: colors.brandPrimary }]}>
          <Ionicons name="storefront" size={16} color={colors.onBrandPrimary} />
        </View>
        {/* destination pin */}
        <View style={[styles.pin, { left: `${end.x}%`, top: `${end.y}%`, backgroundColor: colors.info }]}>
          <Ionicons name="home" size={16} color={colors.onInfo} />
        </View>
        {/* courier */}
        {active ? (
          <View style={[styles.courier, { left: `${cx}%`, top: `${cy}%` }]}>
            <Ionicons name="bicycle" size={18} color={colors.onWarning} />
          </View>
        ) : null}

        <View style={styles.badge}>
          <Ionicons name="map-outline" size={14} color={colors.onSurfaceInverse} />
          <Text style={styles.badgeText}>Peta simulasi (web)</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, overflow: "hidden" },
  bg: { flex: 1 },
  line: { position: "absolute", backgroundColor: "rgba(5,150,105,0.12)" },
  route: {
    position: "absolute",
    height: 4,
    backgroundColor: colors.brandPrimary,
    borderRadius: 2,
    transformOrigin: "left center",
  },
  pin: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -15,
    marginTop: -15,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  courier: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.warning,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -17,
    marginTop: -17,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badge: {
    position: "absolute",
    bottom: spacing.md,
    left: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceInverse,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  badgeText: { color: colors.onSurfaceInverse, fontFamily: font.medium, fontSize: 11 },
}));
