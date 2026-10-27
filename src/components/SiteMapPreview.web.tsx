/**
 * Implémentation WEB de SiteMapPreview — Leaflet pur (DOM), sans react-native-maps.
 * Chargée automatiquement par Metro/Expo grâce à l'extension .web.tsx.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [leafletReady, setLeafletReady] = useState(
    typeof window !== 'undefined' && !!(window as any).L,
  );

  // Charger Leaflet (CSS + JS) une seule fois depuis CDN
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).L) {
      const frame = requestAnimationFrame(() => setLeafletReady(true));
      return () => cancelAnimationFrame(frame);
    }
    if ((window as any).__leafletLoading) {
      const interval = setInterval(() => {
        if ((window as any).L) {
          clearInterval(interval);
          setLeafletReady(true);
        }
      }, 100);
      return () => clearInterval(interval);
    }
    (window as any).__leafletLoading = true;

    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);
  }, []);

  // Créer la carte quand Leaflet est prêt + il y a des sites
  useEffect(() => {
    if (!leafletReady || mapped.length === 0 || !containerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const center: [number, number] = [
      mapped.reduce((sum, s) => sum + (s.latitude as number), 0) / mapped.length,
      mapped.reduce((sum, s) => sum + (s.longitude as number), 0) / mapped.length,
    ];

    const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(
      center,
      mapped.length === 1 ? 13 : 8,
    );
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapped.forEach((site) => {
      const color = STATUS_HEX[site.status] ?? '#6b7280';
      L.circleMarker([site.latitude as number, site.longitude as number], {
        radius: 8,
        color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: 2,
      })
        .addTo(map)
        .bindPopup(
          `<b>${escapeHtml(site.name)}</b><br/>${escapeHtml(site.location)} — ${
            site.productionKw != null ? `${site.productionKw.toFixed(2)} kW` : 'aucune donnée'
          }`,
        );
    });

    return () => {
      map.remove();
    };
  }, [leafletReady, mapped]);

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
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', borderRadius: 13, overflow: 'hidden' }}
      />
    </View>
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

