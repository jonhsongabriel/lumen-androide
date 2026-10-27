/**
 * Aperçu de carte (OpenStreetMap via react-native-maps) des centrales,
 * équivalent du composant SiteMap (react-leaflet) du site Web.
 *
 * Fonctionne sur Web et natif :
 * - Web   : react-native-maps rend une carte Leaflet OSM.
 * - Natif : rend la carte native (Google Maps / Apple Maps).
 *
 * ⚠️ En production, activer expo-maps ou fournir une clé API Google Maps
 * via app.json (config plugin "react-native-maps") si besoin.
 */
import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, UrlTile } from 'react-native-maps';
import { getLumenPalette } from '@/constants/lumen-colors';

export type MapSite = {
  id: string;
  name: string;
  location: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  productionKw: number | null;
};

const STATUS_HEX: Record<string, string> = {
  operational: '#16a34a',
  alert: '#f59e0b',
  offline: '#dc2626',
};

export function SiteMapPreview({
  sites,
  height = 260,
}: {
  sites: MapSite[];
  height?: number;
}) {
  const COLORS = getLumenPalette('light');
  const mapped = useMemo(
    () => sites.filter((s) => s.latitude != null && s.longitude != null),
    [sites],
  );

  const center = useMemo(() => {
    if (mapped.length === 0) {
      return { latitude: -18.91368, longitude: 47.53613 }; // Antananarivo par défaut
    }
    return {
      latitude: mapped.reduce((sum, s) => sum + (s.latitude as number), 0) / mapped.length,
      longitude: mapped.reduce((sum, s) => sum + (s.longitude as number), 0) / mapped.length,
    };
  }, [mapped]);

  if (mapped.length === 0) {
    return (
      <View
        style={[s.empty, { backgroundColor: COLORS.card, borderColor: COLORS.border, height }]}
      >
        <Text style={[s.emptyText, { color: COLORS.muted }]}>
          Aucune coordonnée GPS pour afficher la carte.
        </Text>
        <Text style={[s.emptyHint, { color: COLORS.muted }]}>
          Renseignez latitude / longitude dans le formulaire d&apos;ajout.
        </Text>
      </View>
    );
  }

  return (
    <View style={[s.wrap, { height, borderColor: COLORS.border }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'web' ? PROVIDER_DEFAULT : undefined}
        initialRegion={{
          ...center,
          latitudeDelta: mapped.length === 1 ? 0.05 : 1.5,
          longitudeDelta: mapped.length === 1 ? 0.05 : 1.5,
        }}
        showsUserLocation={false}
        showsCompass={false}
      >
        {Platform.OS === 'web' ? (
          <UrlTile
            urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maximumZ={19}
            flipY={false}
          />
        ) : null}
        {mapped.map((site) => (
          <Marker
            key={site.id}
            coordinate={{
              latitude: site.latitude as number,
              longitude: site.longitude as number,
            }}
            title={site.name}
            description={`${site.location} — ${
              site.productionKw != null ? `${site.productionKw.toFixed(2)} kW` : 'aucune donnée'
            }`}
            pinColor={STATUS_HEX[site.status] ?? '#6b7280'}
          />
        ))}
      </MapView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  empty: {
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 6,
  },
  emptyText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  emptyHint: { fontSize: 11, textAlign: 'center', lineHeight: 17 },
});
