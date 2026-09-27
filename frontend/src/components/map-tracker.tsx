import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Platform, View } from "react-native";

import { makeStyles, useTheme } from "@/src/theme";

export type Coord = { lat: number; lng: number };

export type MapTrackerProps = {
  branch: Coord;
  destination: Coord;
  courier: Coord | null;
  service: string;
  active: boolean;
};

export default function MapTracker({ branch, destination, courier, service, active }: MapTrackerProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  const midLat = (branch.lat + destination.lat) / 2;
  const midLng = (branch.lng + destination.lng) / 2;
  const latDelta = Math.max(Math.abs(branch.lat - destination.lat) * 2.2, 0.03);
  const lngDelta = Math.max(Math.abs(branch.lng - destination.lng) * 2.2, 0.03);

  return (
    <View style={styles.container} testID="map-tracker">
      <MapView
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={{ latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta }}
      >
        <Polyline
          coordinates={[
            { latitude: branch.lat, longitude: branch.lng },
            { latitude: destination.lat, longitude: destination.lng },
          ]}
          strokeColor={colors.brandPrimary}
          strokeWidth={4}
          lineDashPattern={[8, 8]}
        />
        <Marker coordinate={{ latitude: branch.lat, longitude: branch.lng }} title="Cabang Loundry Suci" pinColor={colors.brandPrimary} />
        <Marker coordinate={{ latitude: destination.lat, longitude: destination.lng }} title="Alamat Anda" pinColor={colors.info} />
        {courier && active ? (
          <Marker coordinate={{ latitude: courier.lat, longitude: courier.lng }} title="Kurir" pinColor={colors.warning} />
        ) : null}
      </MapView>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  container: { flex: 1, overflow: "hidden" },
  map: { flex: 1 },
}));
