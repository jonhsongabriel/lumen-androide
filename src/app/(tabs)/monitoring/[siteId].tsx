import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { getLumenPalette } from '@/constants/lumen-colors';
import { apiRequest } from '@/services/api';
import { getAuthToken } from '@/services/session';
import { extractArray, monitoringApi } from '@/services/lumen-api';
import {
  extractSites,
  normalizeMonitoring,
  normalizeSite,
} from '@/features/dashboard/normalize';
import { LineChartCard, type Series } from '@/components/line-chart-card';

type Monitoring = {
  production_kw: number | null;
  consumption_kw: number | null;
  battery_level_percent: number | null;
  battery_voltage: number | null;
  temperature_celsius: number | null;
  grid_status: string | null;
  daily_production_kwh: number | null;
  daily_consumption_kwh: number | null;
  total_production_kwh: number | null;
  battery_charge_kw: number | null;
  battery_discharge_kw: number | null;
  pv_power_kw: number | null;
  generator_power_kw: number | null;
  grid_power_kw: number | null;
  frequency_hz: number | null;
  energy_source: string | null;
  timestamp: string | null;
};

type HistoryRow = Record<string, unknown>;

type TimeRange = '1h' | '24h' | '7d' | '30d';

const RANGE_LABELS: Record<TimeRange, string> = {
  '1h': 'Dernière heure',
  '24h': 'Dernières 24h',
  '7d': '7 derniers jours',
  '30d': '30 derniers jours',
};

type SiteInfo = {
  id: string;
  name: string;
  location: string;
  type: string;
  isOffline: boolean;
  capacity: number | null;
  latitude: number | null;
  longitude: number | null;
};

function formatMetric(
  value: number | null | undefined,
  unit: string,
  decimals = 2,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('fr-FR', {
    maximumFractionDigits: decimals,
  })} ${unit}`;
}

const TYPE_LABELS: Record<string, string> = {
  isole: 'Isolé (PV + Batterie)',
  autonome: 'Autonome (PV + Batterie + GE)',
  hybride: 'Hybride (PV + Réseau + Batterie)',
  hybride_ge: 'Hybride + GE (PV + Réseau + Batterie + GE)',
  injection: 'Injection (PV + Réseau)',
  hybrid: 'Hybride (PV + Réseau + Batterie)',
  autonomous: 'Autonome (PV + Batterie + GE)',
  'grid-connected': 'Injection (PV + Réseau)',
};

function batteryColor(
  percent: number,
  COLORS: ReturnType<typeof getLumenPalette>,
): string {
  if (percent > 50) return COLORS.accentBattery;
  if (percent > 20) return COLORS.accentProduction;
  return COLORS.error;
}

export default function SiteMonitoringScreen() {
  const COLORS = getLumenPalette(
    useColorScheme() as 'light' | 'dark' | null,
  );
  const { siteId } = useLocalSearchParams<{ siteId: string }>();
  const router = useRouter();

  const [site, setSite] = useState<SiteInfo | null>(null);
  const [monitoring, setMonitoring] = useState<Monitoring | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (manual = false) => {
    if (!siteId) return;
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Aucune session active. Reconnectez-vous.');
      }
      const sitesResponse = await apiRequest<unknown>('sites', {
        method: 'GET',
        token,
      });
      const candidates = Array.isArray(sitesResponse)
        ? sitesResponse
        : extractSites(sitesResponse);
      const found =
        candidates
          .map(normalizeSite)
          .find((item) => item?.id === siteId) ?? null;
      const foundSite: SiteInfo | null = found
        ? {
            id: found.id,
            name: found.name,
            location: found.location,
            type: found.type,
            isOffline: found.isOffline,
            capacity: found.capacityKw,
            latitude: found.latitude,
            longitude: found.longitude,
          }
        : null;
      setSite(foundSite);

      const latestResponse = await apiRequest<unknown>(
        `monitoring/site/${encodeURIComponent(String(siteId))}/latest`,
        { method: 'GET', token },
      );
      const normalized = normalizeMonitoring(latestResponse);
      if (normalized) {
        setMonitoring({
          production_kw: normalized.production_kw ?? null,
          consumption_kw: normalized.consumption_kw ?? null,
          battery_level_percent: normalized.battery_level_percent ?? null,
          battery_voltage: normalized.battery_voltage ?? null,
          temperature_celsius: normalized.temperature_celsius ?? null,
          grid_status: normalized.grid_status ?? null,
          daily_production_kwh: normalized.daily_production_kwh ?? null,
          daily_consumption_kwh: normalized.daily_consumption_kwh ?? null,
          total_production_kwh: normalized.total_production_kwh ?? null,
          battery_charge_kw: normalized.battery_charge_kw ?? null,
          battery_discharge_kw: normalized.battery_discharge_kw ?? null,
          pv_power_kw: normalized.pv_power_kw ?? null,
          generator_power_kw: normalized.generator_power_kw ?? null,
          grid_power_kw: normalized.grid_power_kw ?? null,
          frequency_hz: normalized.frequency_hz ?? null,
          energy_source: normalized.energy_source ?? null,
          timestamp: normalized.timestamp ?? null,
        });
      } else {
        setMonitoring(null);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de récupérer les données de la centrale.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [siteId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const interval = setInterval(() => {
      void load();
    }, 30000);
    return () => clearInterval(interval);
  }, [load]);

  /** Historique de la période sélectionnée (comme la page Web). */
  useEffect(() => {
    if (!siteId) return;
    let active = true;
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const token = await getAuthToken();
        if (!token) throw new Error('Aucune session active. Reconnectez-vous.');
        const end = new Date();
        const start = new Date(end);
        const hours = timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;
        start.setHours(start.getHours() - hours);
        const rows: HistoryRow[] = [];
        const pageSize = 5000;
        let offset = 0;
        while (true) {
          const response = await monitoringApi.getBySite(
            String(siteId),
            pageSize,
            offset,
            undefined,
            start.toISOString(),
            end.toISOString(),
            token,
          );
          const page = extractArray(response) as HistoryRow[];
          rows.push(...page);
          if (page.length < pageSize) break;
          offset += page.length;
        }
        if (active) setHistory(rows);
      } catch {
        if (active) setHistory([]);
      } finally {
        if (active) setHistoryLoading(false);
      }
    };
    void loadHistory();
    return () => { active = false; };
  }, [siteId, timeRange]);

  const isOnline = site ? !site.isOffline : false;
  const batteryPercent = monitoring?.battery_level_percent ?? 0;
  const hasCoordinates =
    typeof site?.latitude === 'number' && typeof site?.longitude === 'number';

  const openMap = useCallback(() => {
    if (!hasCoordinates || !site) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${site.latitude},${site.longitude}`;
    void Linking.openURL(url).catch(() => {});
  }, [hasCoordinates, site]);

  const metricCards = useMemo(() => {
    return [
      {
        label: 'Production',
        value: formatMetric(monitoring?.production_kw, 'kW'),
        accent: COLORS.accentProduction,
        foot: 'Solaire',
      },
      {
        label: 'Consommation',
        value: formatMetric(monitoring?.consumption_kw, 'kW'),
        accent: COLORS.accentConsumption,
        foot: 'Charge actuelle',
      },
      {
        label: 'Batterie',
        value: formatMetric(batteryPercent, '%', 0),
        accent: COLORS.accentBattery,
        foot: `Tension : ${formatMetric(monitoring?.battery_voltage, 'V', 1)}`,
      },
      {
        label: 'Température',
        value: formatMetric(monitoring?.temperature_celsius, '°C', 1),
        accent: COLORS.accentTemperature,
        foot: `Réseau : ${monitoring?.grid_status || 'N/A'}`,
      },
    ];
  }, [monitoring, batteryPercent, COLORS]);

  /** Séries pour les graphiques (re-échantillonnées à ~60 points max). */
  const chartSeries = useMemo(() => {
    const sorted = history
      .slice()
      .sort((a, b) => Date.parse(String(a.timestamp ?? '')) - Date.parse(String(b.timestamp ?? '')));
    const maxPoints = 60;
    const stride = sorted.length > maxPoints ? Math.ceil(sorted.length / maxPoints) : 1;
    const sampled = sorted.filter((_, i) => i % stride === 0 || i === sorted.length - 1);
    const num = (row: HistoryRow, key: string): number | null => {
      const v = row[key];
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const timeLabel = (row: HistoryRow): string => {
      const d = new Date(String(row.timestamp ?? ''));
      if (Number.isNaN(d.getTime())) return '';
      return timeRange === '1h' || timeRange === '24h'
        ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    };
    const pick = (key: string) => sampled.map((row) => num(row, key));
    return {
      labels: sampled.map(timeLabel),
      prodVsCons: [
        { key: 'production_kw', label: 'Production (kW)', color: COLORS.accentProduction, values: pick('production_kw') },
        { key: 'consumption_kw', label: 'Consommation (kW)', color: COLORS.accentConsumption, values: pick('consumption_kw') },
      ] as Series[],
      battery: [
        { key: 'battery_level_percent', label: 'Niveau (%)', color: COLORS.accentBattery, values: pick('battery_level_percent') },
      ] as Series[],
      temperature: [
        { key: 'temperature_celsius', label: 'Température (°C)', color: COLORS.accentTemperature, values: pick('temperature_celsius') },
      ] as Series[],
      pointCount: sampled.length,
      emptyCount: history.length,
    };
  }, [history, timeRange, COLORS]);

  if (loading && !site) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.background}
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.success} />
          <Text style={styles.centerText}>Chargement de la centrale...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.background}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>← Retour aux centrales</Text>
        </Pressable>

        {/* Liens internes rapides (navigation type Deye) */}
        <View style={styles.quickLinksRow}>
          <Pressable
            style={styles.quickLinkChip}
            onPress={() => router.push('/(tabs)/alerts' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Voir les alertes"
          >
            <Text style={styles.quickLinkText}>⚠ Alertes</Text>
          </Pressable>
          <Pressable
            style={styles.quickLinkChip}
            onPress={() => router.push('/(tabs)/history' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Voir l’historique"
          >
            <Text style={styles.quickLinkText}>▤ Historique</Text>
          </Pressable>
          <Pressable
            style={styles.quickLinkChip}
            onPress={() => router.push('/(tabs)/realtime' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Vue temps réel"
          >
            <Text style={styles.quickLinkText}>⌁ Temps réel</Text>
          </Pressable>
        </View>

        <View style={styles.headerRow}>
          <Text style={styles.title}>Supervision temps réel</Text>
          <View
            style={[
              styles.onlineBadge,
              !isOnline && styles.offlineBadge,
            ]}
          >
            <View
              style={[
                styles.dot,
                !isOnline && styles.dotOffline,
              ]}
            />
            <Text
              style={[
                styles.onlineText,
                !isOnline && styles.offlineText,
              ]}
            >
              {isOnline ? 'En ligne' : 'Hors ligne'}
            </Text>
          </View>
        </View>
        <Text style={styles.siteName}>
          {site?.name ?? 'Centrale inconnue'}
        </Text>
        <Text style={styles.subtitle}>
          Données de monitoring en direct
        </Text>
        {/* Sélecteur de période (comme la page Web) */}
        <View style={styles.rangeRow}>
          {(['1h', '24h', '7d', '30d'] as TimeRange[]).map((range) => (
            <Pressable
              key={range}
              onPress={() => setTimeRange(range)}
              style={[
                styles.rangeChip,
                timeRange === range && styles.rangeChipActive,
              ]}
              accessibilityRole="button"
              accessibilityLabel={RANGE_LABELS[range]}
            >
              <Text
                style={[
                  styles.rangeChipText,
                  timeRange === range && styles.rangeChipTextActive,
                ]}
              >
                {RANGE_LABELS[range]}
              </Text>
            </Pressable>
          ))}
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void load(true)}>
              <Text style={styles.retryText}>Réessayer</Text>
            </Pressable>
          </View>
        ) : null}

        {refreshing ? (
          <Text style={styles.refreshing}>Actualisation...</Text>
        ) : null}
        {historyLoading ? (
          <Text style={styles.refreshing}>Chargement de l’historique…</Text>
        ) : null}
        {/* Graphiques dynamiques (comme la page Web) */}
        <LineChartCard
          COLORS={COLORS}
          title="Production vs Consommation"
          series={chartSeries.prodVsCons}
          labels={chartSeries.labels}
        />
        <LineChartCard
          COLORS={COLORS}
          title="État de la batterie"
          series={chartSeries.battery}
          labels={chartSeries.labels}
          yUnit="%"
        />
        <LineChartCard
          COLORS={COLORS}
          title="Température"
          series={chartSeries.temperature}
          labels={chartSeries.labels}
          yUnit="°C"
        />

        {/* Cartes indicateurs (même disposition que la page Web) */}
        <View style={styles.cardsRow}>
          {metricCards.map((card) => (
            <View
              key={card.label}
              style={[styles.metricCard, { borderTopColor: card.accent }]}
            >
              <Text style={styles.metricLabel}>{card.label}</Text>
              <Text
                style={[styles.metricValue, { color: card.accent }]}
              >
                {card.value}
              </Text>
              <Text style={styles.metricFoot}>{card.foot}</Text>
              {card.label === 'Stockage (SOC)' ? (
                <View style={styles.batteryTrack}>
                  <View
                    style={[
                      styles.batteryFill,
                      {
                        width: `${Math.max(0, Math.min(100, batteryPercent))}%`,
                        backgroundColor: batteryColor(batteryPercent, COLORS),
                      },
                    ]}
                  />
                </View>
              ) : null}
            </View>
          ))}
        </View>

        {/* Fiche technique */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informations du site</Text>
          <DetailRow
            label="Localisation"
            value={site?.location ?? '—'}
            COLORS={COLORS}
          />
          <DetailRow
            label="Type de système"
            value={
              TYPE_LABELS[(site?.type ?? '').trim().toLowerCase()] ??
              site?.type ??
              '—'
            }
            COLORS={COLORS}
          />
          <DetailRow
            label="Capacité"
            value={site?.capacity !== null ? formatMetric(site?.capacity, 'kW', 0) : '—'}
            COLORS={COLORS}
          />
          <DetailRow
            label="Statut réseau"
            value={monitoring?.grid_status || 'N/A'}
            COLORS={COLORS}
          />
          {monitoring?.timestamp ? (
            <DetailRow
              label="Dernière mesure"
              value={
                Number.isFinite(new Date(monitoring.timestamp).getTime())
                  ? new Date(monitoring.timestamp).toLocaleString('fr-FR')
                  : monitoring.timestamp
              }
              COLORS={COLORS}
            />
          ) : null}
        </View>

        {/* Détails techniques avancés (données Deye complètes) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Détails techniques avancés</Text>
          <DetailRow
            label="Production PV"
            value={formatMetric(monitoring?.pv_power_kw, 'kW')}
            COLORS={COLORS}
          />
          <DetailRow
            label="Charge batterie"
            value={formatMetric(monitoring?.battery_charge_kw, 'kW')}
            COLORS={COLORS}
          />
          <DetailRow
            label="Décharge batterie"
            value={formatMetric(monitoring?.battery_discharge_kw, 'kW')}
            COLORS={COLORS}
          />
          <DetailRow
            label="Puissance réseau"
            value={formatMetric(monitoring?.grid_power_kw, 'kW')}
            COLORS={COLORS}
          />
          <DetailRow
            label="Groupe électrogène"
            value={formatMetric(monitoring?.generator_power_kw, 'kW')}
            COLORS={COLORS}
          />
          <DetailRow
            label="Fréquence réseau"
            value={formatMetric(monitoring?.frequency_hz, 'Hz', 2)}
            COLORS={COLORS}
          />
          <DetailRow
            label="Production du jour"
            value={formatMetric(monitoring?.daily_production_kwh, 'kWh')}
            COLORS={COLORS}
          />
          <DetailRow
            label="Consommation du jour"
            value={formatMetric(monitoring?.daily_consumption_kwh, 'kWh')}
            COLORS={COLORS}
          />
          <DetailRow
            label="Production totale"
            value={formatMetric(monitoring?.total_production_kwh, 'kWh')}
            COLORS={COLORS}
          />
          <DetailRow
            label="Source d’énergie"
            value={monitoring?.energy_source ?? '—'}
            COLORS={COLORS}
          />
          {hasCoordinates && site ? (
            <Pressable
              onPress={openMap}
              style={styles.mapButton}
              accessibilityRole="button"
              accessibilityLabel="Voir l’emplacement sur la carte"
            >
              <Text style={styles.mapButtonText}>
                Voir sur la carte ({site.latitude?.toFixed(4)}, {site.longitude?.toFixed(4)})
              </Text>
            </Pressable>
          ) : null}
        </View>

        {!monitoring && !error ? (
          <View style={styles.noteCard}>
            <Text style={styles.noteText}>
              Aucune mesure exploitable n&apos;a été reçue pour cette centrale. Les
              valeurs affichent un tiret.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  COLORS,
}: {
  label: string;
  value: string;
  COLORS: ReturnType<typeof getLumenPalette>;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, { color: COLORS.text }]}>
        {value}
      </Text>
    </View>
  );
}

const createStyles = (COLORS: ReturnType<typeof getLumenPalette>) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: 20, paddingBottom: 36, gap: 14 },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 32,
    },
    centerText: { color: COLORS.muted, fontSize: 13 },
    backText: { color: COLORS.success, fontSize: 12, fontWeight: '700' },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
    },
    title: { color: COLORS.text, fontSize: 24, fontWeight: '900' },
    onlineBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: COLORS.successBorder,
      backgroundColor: COLORS.successBg,
      borderRadius: 14,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    offlineBadge: {
      borderColor: COLORS.errorBorder,
      backgroundColor: COLORS.errorBg,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: COLORS.success,
    },
    dotOffline: { backgroundColor: COLORS.error },
    onlineText: { color: COLORS.success, fontSize: 10, fontWeight: '800' },
    offlineText: { color: COLORS.error, fontSize: 10, fontWeight: '800' },
    siteName: { color: COLORS.text, fontSize: 16, fontWeight: '800', marginTop: -6 },
    subtitle: {
      color: COLORS.muted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: -8,
    },
    refreshing: { color: COLORS.success, fontSize: 11, fontWeight: '700' },
    errorCard: {
      padding: 16,
      gap: 10,
      backgroundColor: COLORS.errorBg,
      borderWidth: 1,
      borderColor: COLORS.errorBorder,
      borderRadius: 14,
    },
    errorText: { color: COLORS.error, fontSize: 12, lineHeight: 19 },
    retryText: { color: COLORS.success, fontSize: 12, fontWeight: '700' },
    cardsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    metricCard: {
      flexGrow: 1,
      flexBasis: '46%',
      minWidth: 150,
      padding: 14,
      gap: 6,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderTopWidth: 4,
      borderRadius: 14,
    },
    metricLabel: {
      color: COLORS.muted,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    metricValue: { fontSize: 22, fontWeight: '900' },
    metricFoot: { color: COLORS.muted, fontSize: 10, lineHeight: 15 },
    batteryTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: COLORS.track,
      overflow: 'hidden',
    },
    batteryFill: { height: 6, borderRadius: 3 },
    rangeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: -4,
    },
    rangeChip: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    rangeChipActive: {
      borderColor: COLORS.success,
      backgroundColor: COLORS.successBg,
    },
    rangeChipText: {
      color: COLORS.muted,
      fontSize: 11,
      fontWeight: '700',
    },
    rangeChipTextActive: { color: COLORS.success },
    card: {
      padding: 16,
      gap: 12,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 16,
    },
    cardTitle: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    detailLabel: {
      flex: 1,
      color: COLORS.muted,
      fontSize: 11,
    },
    detailValue: { fontSize: 12, fontWeight: '700', textAlign: 'right' },
    noteCard: {
      padding: 14,
      backgroundColor: COLORS.warningBg,
      borderWidth: 1,
      borderColor: COLORS.warningBorder,
      borderRadius: 12,
    },
    noteText: { color: COLORS.warning, fontSize: 11, lineHeight: 18 },
    mapButton: {
      marginTop: 4,
      paddingVertical: 11,
      alignItems: 'center',
      backgroundColor: COLORS.successBg,
      borderWidth: 1,
      borderColor: COLORS.successBorder,
      borderRadius: 12,
    },
    mapButtonText: { color: COLORS.success, fontSize: 12, fontWeight: '800' },
    quickLinksRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    quickLinkChip: {
      paddingVertical: 7,
      paddingHorizontal: 12,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 20,
    },
    quickLinkText: { color: COLORS.primary, fontSize: 11, fontWeight: '700' },
  });

const styles = createStyles(getLumenPalette('dark'));
