import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getLumenPalette } from '@/constants/lumen-colors';
import { SiteMapPreview } from '@/components/SiteMapPreview';
import { apiRequest } from '@/services/api';
import { getAuthToken } from '@/services/session';

type Monitoring = {
  site_id?: string;
  production_kw?: number | null;
  consumption_kw?: number | null;
  battery_level_percent?: number | null;
  battery_voltage?: number | null;
  temperature_celsius?: number | null;
  grid_status?: string | null;
  daily_production_kwh?: number | null;
  daily_consumption_kwh?: number | null;
  timestamp?: string | null;
};

type Site = {
  id: string;
  name: string;
  location: string;
  type: string;
  status: string;
  isOffline: boolean;
  capacity: number | null;
  latitude: number | null;
  longitude: number | null;
  monitoring: Monitoring | null;
  monitoringError: boolean;
};

type FilterType = 'all' | 'hybride' | 'autonome';

type AnyObject = Record<string, unknown>;

function isObject(value: unknown): value is AnyObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getText(object: AnyObject, keys: string[]): string {
  for (const key of keys) {
    const value = object[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return '';
}

function getNumber(
  object: AnyObject,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = object[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function getBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'oui'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'non'].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function extractSites(payload: unknown, depth = 0): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isObject(payload) || depth > 5) {
    return [];
  }

  for (const key of ['sites', 'data', 'items', 'results']) {
  const child: unknown = payload[key];

    if (child !== undefined && child !== payload) {
      const result = extractSites(child, depth + 1);

      if (result.length > 0 || Array.isArray(child)) {
        return result;
      }
    }
  }

  return [];
}

function normalizeSite(value: unknown): Site | null {
  if (!isObject(value)) {
    return null;
  }

  const id = getText(value, [
    'id',
    'site_id',
    'siteId',
    '_id',
  ]);

  const name = getText(value, [
    'name',
    'site_name',
    'siteName',
    'nom',
    'project_name',
  ]);

  if (!id || !name) {
    return null;
  }

  const status =
    getText(value, ['status', 'site_status', 'state']) || 'unknown';

  const explicitOffline = getBoolean(
    value.is_offline ?? value.isOffline ?? value.offline,
  );

  const normalizedStatus = normalizeText(status);

  const isOffline =
    explicitOffline ??
    ['offline', 'disconnected', 'inactif', 'inactive', 'hors ligne'].includes(
      normalizedStatus,
    );

  return {
    id,
    name,
    location:
      getText(value, [
        'location',
        'address',
        'city',
        'emplacement',
      ]) || 'Emplacement non renseigné',
    type:
      getText(value, [
        'type',
        'site_type',
        'siteType',
        'system_type',
        'installation_type',
      ]) || 'Type non renseigné',
    status,
    isOffline,
    capacity: getNumber(value, [
      'capacity_kw',
      'capacity',
      'installed_capacity_kw',
      'installed_capacity',
      'power_kw',
    ]),
    latitude: getNumber(value, ['latitude', 'lat']),
    longitude: getNumber(value, ['longitude', 'lng', 'lon', 'long']),
    monitoring: null,
    monitoringError: false,
  };
}

function findMonitoringObject(
  payload: unknown,
  depth = 0,
): AnyObject | null {
  if (!isObject(payload) || depth > 5) {
    return null;
  }

  const metricKeys = [
    'production_kw',
    'productionKw',
    'consumption_kw',
    'consumptionKw',
    'battery_level_percent',
    'batteryLevelPercent',
    'battery_voltage',
    'batteryVoltage',
    'temperature_celsius',
    'temperatureCelsius',
    'daily_production_kwh',
    'dailyProductionKwh',
    'daily_consumption_kwh',
    'dailyConsumptionKwh',
    'grid_status',
    'gridStatus',
  ];

  if (metricKeys.some((key) => payload[key] !== undefined)) {
    return payload;
  }

  // Prend en charge les enveloppes habituelles de l'API.
  for (const key of [
    'data',
    'monitoring',
    'latest',
    'result',
    'measurement',
    'measurements',
    'metrics',
  ]) {
    const nested = findMonitoringObject(payload[key], depth + 1);

    if (nested) {
      return nested;
    }
  }

  return null;
}

function normalizeMonitoring(payload: unknown): Monitoring | null {
  const object = findMonitoringObject(payload);

  if (!object) {
    return null;
  }

  const monitoring: Monitoring = {
    site_id: getText(object, ['site_id', 'siteId']) || undefined,

    production_kw: getNumber(object, [
      'production_kw',
      'productionKw',
      'solar_production_kw',
      'solarProductionKw',
    ]),

    consumption_kw: getNumber(object, [
      'consumption_kw',
      'consumptionKw',
      'load_kw',
      'loadKw',
    ]),

    battery_level_percent: getNumber(object, [
      'battery_level_percent',
      'batteryLevelPercent',
      'battery_percent',
      'batteryPercent',
      'soc',
    ]),

    battery_voltage: getNumber(object, [
      'battery_voltage',
      'batteryVoltage',
    ]),

    temperature_celsius: getNumber(object, [
      'temperature_celsius',
      'temperatureCelsius',
      'temperature',
    ]),

    grid_status: getText(object, [
      'grid_status',
      'gridStatus',
      'grid_state',
      'gridState',
    ]) || null,

    daily_production_kwh: getNumber(object, [
      'daily_production_kwh',
      'dailyProductionKwh',
      'today_production_kwh',
    ]),

    daily_consumption_kwh: getNumber(object, [
      'daily_consumption_kwh',
      'dailyConsumptionKwh',
      'today_consumption_kwh',
    ]),

    timestamp: getText(object, [
      'timestamp',
      'created_at',
      'createdAt',
      'updated_at',
      'updatedAt',
    ]) || null,
  };

  const hasData = [
    monitoring.production_kw,
    monitoring.consumption_kw,
    monitoring.battery_level_percent,
    monitoring.battery_voltage,
    monitoring.temperature_celsius,
    monitoring.daily_production_kwh,
    monitoring.daily_consumption_kwh,
  ].some((value) => value !== null && value !== undefined);

  return hasData || monitoring.grid_status ? monitoring : null;
}

function formatMetric(
  value: number | null | undefined,
  unit: string,
  decimals = 2,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return `${value.toLocaleString('fr-FR', {
    maximumFractionDigits: decimals,
  })} ${unit}`;
}

function formatTimestamp(value?: string | null): string {
  if (!value) return '—';

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('fr-FR');
}

function getGridStatus(value?: string | null): string {
  if (!value) return '—';

  const normalized = normalizeText(value);

  if (['connected', 'connecte', 'online'].includes(normalized)) {
    return 'Connecté';
  }

  if (
    ['disconnected', 'deconnecte', 'offline'].includes(normalized)
  ) {
    return 'Déconnecté';
  }

  return value;
}

export default function TabTwoScreen() {
  const COLORS = getLumenPalette(
    useColorScheme() as 'light' | 'dark' | null,
  );
  const [sites, setSites] = useState<Site[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Le minuteur utilise toujours la dernière liste de sites.
  const sitesRef = useRef<Site[]>([]);
  const requestInProgress = useRef(false);

  useEffect(() => {
    sitesRef.current = sites;
  }, [sites]);

  const refreshMonitoring = useCallback(
    async (currentSites: Site[]) => {
      if (requestInProgress.current || currentSites.length === 0) {
        return;
      }

      requestInProgress.current = true;

      try {
        const token = await getAuthToken();

        if (!token) {
          return;
        }

        const updatedSites = await Promise.all(
          currentSites.map(async (site): Promise<Site> => {
            try {
              const response = await apiRequest<unknown>(
                `monitoring/site/${encodeURIComponent(site.id)}/latest`,
                {
                  method: 'GET',
                  token,
                },
              );

              const monitoring = normalizeMonitoring(response);

              if (!monitoring) {
                return {
                  ...site,
                  monitoring: site.monitoring,
                  monitoringError: true,
                };
              }

              return {
                ...site,
                monitoring,
                monitoringError: false,
              };
            } catch {
              // Une erreur sur un site ne bloque pas les autres.
              return {
                ...site,
                monitoring: site.monitoring,
                monitoringError: true,
              };
            }
          }),
        );

        setSites((current) =>
          current.map((site) => {
            const updated = updatedSites.find(
              (item) => item.id === site.id,
            );

            return updated ?? site;
          }),
        );
      } finally {
        requestInProgress.current = false;
      }
    },
    [],
  );

  const loadSites = useCallback(
    async (manual = false) => {
      if (requestInProgress.current) {
        return;
      }

      if (manual) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const token = await getAuthToken();

        if (!token) {
          throw new Error(
            'Aucune session active. Déconnectez-vous puis reconnectez-vous.',
          );
        }

        const response = await apiRequest<unknown>('sites', {
          method: 'GET',
          token,
        });

        const receivedSites = extractSites(response)
          .map(normalizeSite)
          .filter((site): site is Site => site !== null);

        if (!Array.isArray(receivedSites)) {
          throw new Error('Format de réponse des centrales invalide.');
        }

        // Conserve les dernières mesures pendant le chargement.
        const mergedSites = receivedSites.map((site) => {
          const previous = sitesRef.current.find(
            (item) => item.id === site.id,
          );

          return previous
            ? {
                ...site,
                monitoring: previous.monitoring,
                monitoringError: previous.monitoringError,
              }
            : site;
        });

        setSites(mergedSites);
        sitesRef.current = mergedSites;

        // Récupère les mesures réelles de chaque centrale.
        await refreshMonitoring(mergedSites);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Impossible de récupérer les centrales.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [refreshMonitoring],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSites();
  }, [loadSites]);

  // Actualisation périodique des mesures sans recréer le minuteur
  // après chaque mise à jour de l'état React.
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshMonitoring(sitesRef.current);
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshMonitoring]);

  const filteredSites = useMemo(() => {
    const query = normalizeText(search);

    return sites.filter((site) => {
      const matchesSearch =
        normalizeText(site.name).includes(query) ||
        normalizeText(site.location).includes(query);

      const type = normalizeText(site.type);

      const matchesType =
        filter === 'all' ||
        (filter === 'hybride' &&
          (type.includes('hybride') || type.includes('hybrid'))) ||
        (filter === 'autonome' &&
          (type.includes('autonome') || type.includes('autonomous')));

      return matchesSearch && matchesType;
    });
  }, [sites, search, filter]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.background}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadSites(true)}
            tintColor={COLORS.success}
            colors={[COLORS.success]}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>LUMEN</Text>
            <Text style={styles.brandSubtitle}>
              SUPERVISION ÉNERGÉTIQUE
            </Text>
          </View>

          <View
            style={[
              styles.connectionBadge,
              error && styles.connectionBadgeError,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                error && styles.statusDotError,
              ]}
            />
            <Text
              style={[
                styles.connectionText,
                error && styles.connectionTextError,
              ]}
            >
              {loading
                ? 'CHARGEMENT'
                : error
                  ? 'ERREUR API'
                  : 'API DISPONIBLE'}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>Mes centrales</Text>
        <Text style={styles.subtitle}>
          Retrouvez les installations accessibles à votre compte LUMEN.
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>CENTRALES RÉELLES</Text>
          <Text style={styles.summaryValue}>
            {loading ? '—' : filteredSites.length}
          </Text>
          <Text style={styles.summaryFoot}>
            {loading
              ? 'Récupération depuis le serveur...'
              : `${sites.length} centrale(s) reçue(s) depuis l’API`}
          </Text>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Chargement impossible</Text>
            <Text style={styles.errorText}>{error}</Text>

            <Pressable
              style={styles.retryButton}
              onPress={() => void loadSites(true)}
              accessibilityRole="button"
            >
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </Pressable>
          </View>
        ) : null}

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher une centrale..."
          placeholderTextColor={COLORS.muted}
          style={styles.searchInput}
          accessibilityLabel="Rechercher une centrale"
          returnKeyType="search"
        />

        <Text style={styles.sectionTitle}>Type d’installation</Text>

        <View style={styles.filters}>
          <FilterButton
            label="Toutes"
            active={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          <FilterButton
            label="Hybride"
            active={filter === 'hybride'}
            onPress={() => setFilter('hybride')}
          />
          <FilterButton
            label="Autonome"
            active={filter === 'autonome'}
            onPress={() => setFilter('autonome')}
          />
        </View>

        {/* Carte des centrales (équivalent SiteMap Leaflet du Web) */}
        {!loading && sites.length > 0 ? (
          <SiteMapPreview
            sites={sites.map((site) => ({
              id: site.id,
              name: site.name,
              location: site.location ?? '—',
              status: site.isOffline ? 'offline' : site.monitoring ? 'operational' : 'alert',
              latitude: site.latitude ?? null,
              longitude: site.longitude ?? null,
              productionKw: site.monitoring?.production_kw ?? null,
            }))}
          />
        ) : null}

        <View style={styles.installationsHeader}>
          <Text style={styles.sectionTitle}>Installations</Text>

          <Pressable
            onPress={() => void loadSites(true)}
            disabled={loading || refreshing}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.refreshText,
                (loading || refreshing) && styles.disabledText,
              ]}
            >
              {refreshing ? 'Actualisation...' : 'Actualiser'}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={COLORS.success} />
            <Text style={styles.stateText}>
              Chargement des centrales...
            </Text>
          </View>
        ) : error && sites.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Centrales indisponibles</Text>
            <Text style={styles.emptyText}>
              Vérifiez la connexion puis réessayez.
            </Text>
          </View>
        ) : filteredSites.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {sites.length === 0
                ? 'Aucune centrale reçue'
                : 'Aucune centrale trouvée'}
            </Text>
            <Text style={styles.emptyText}>
              {sites.length === 0
                ? 'Le serveur n’a retourné aucune centrale pour ce compte.'
                : 'Modifiez votre recherche ou choisissez un autre filtre.'}
            </Text>
          </View>
        ) : (
          filteredSites.map((site) => {
            const expanded = selectedSite === site.id;
            const monitoring = site.monitoring;

            const statusLabel = site.isOffline
              ? 'Centrale hors ligne'
              : monitoring
                ? 'Mesures reçues'
                : 'Mesures indisponibles';

            const statusIsError = site.isOffline || !monitoring;

            return (
              <View key={site.id} style={styles.siteCard}>
                <Pressable
                  onPress={() =>
                    setSelectedSite(expanded ? null : site.id)
                  }
                  style={({ pressed }) => [
                    styles.siteHeader,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Afficher les détails de ${site.name}`}
                  accessibilityState={{ expanded }}
                >
                  <View style={styles.siteIcon}>
                    <Text style={styles.siteIconText}>⚡</Text>
                  </View>

                  <View style={styles.siteInfo}>
                    <Text style={styles.siteName}>{site.name}</Text>
                    <Text style={styles.siteLocation}>
                      {site.location}
                    </Text>
                    <Text style={styles.siteType}>{site.type}</Text>
                    {site.capacity !== null && (
                      <Text style={styles.capacityText}>
                        Puissance installée :{' '}
                        {formatMetric(site.capacity, 'kW')}
                      </Text>
                    )}
                  </View>

                  <Text style={styles.chevron}>
                    {expanded ? '−' : '+'}
                  </Text>
                </Pressable>

                <View style={styles.siteDivider} />

                <View style={styles.siteStatusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      statusIsError && styles.statusDotError,
                    ]}
                  />
                  <Text
                    style={[
                      styles.siteStatusText,
                      statusIsError && styles.siteStatusError,
                    ]}
                  >
                    {statusLabel}
                  </Text>
                </View>

                {expanded && (
                  <View style={styles.details}>
                    <DetailRow
                      label="Production solaire"
                      value={formatMetric(monitoring?.production_kw, 'kW')}
                    />
                    <DetailRow
                      label="Consommation"
                      value={formatMetric(monitoring?.consumption_kw, 'kW')}
                    />
                    <DetailRow
                      label="Niveau de batterie"
                      value={formatMetric(
                        monitoring?.battery_level_percent,
                        '%',
                        1,
                      )}
                    />
                    <DetailRow
                      label="Tension batterie"
                      value={formatMetric(
                        monitoring?.battery_voltage,
                        'V',
                      )}
                    />
                    <DetailRow
                      label="Température"
                      value={formatMetric(
                        monitoring?.temperature_celsius,
                        '°C',
                        1,
                      )}
                    />
                    <DetailRow
                      label="Production journalière"
                      value={formatMetric(
                        monitoring?.daily_production_kwh,
                        'kWh',
                      )}
                    />
                    <DetailRow
                      label="Consommation journalière"
                      value={formatMetric(
                        monitoring?.daily_consumption_kwh,
                        'kWh',
                      )}
                    />
                    <DetailRow
                      label="État du réseau"
                      value={getGridStatus(monitoring?.grid_status)}
                    />
                    <DetailRow
                      label="Dernière mesure"
                      value={formatTimestamp(monitoring?.timestamp)}
                    />
                    {typeof site.latitude === 'number' &&
                      typeof site.longitude === 'number' && (
                        <Pressable
                          onPress={() =>
                            void Linking.openURL(
                              `https://www.google.com/maps/search/?api=1&query=${site.latitude},${site.longitude}`,
                            ).catch(() => {})
                          }
                          style={styles.mapButton}
                          accessibilityRole="button"
                          accessibilityLabel={`Voir ${site.name} sur la carte`}
                        >
                          <Text style={styles.mapButtonText}>
                            Voir sur la carte
                          </Text>
                        </Pressable>
                      )}

                    {!monitoring && (
                      <Text style={styles.detailsNote}>
                        {site.isOffline
                          ? 'Le serveur signale cette centrale hors ligne. Aucune mesure exploitable n’est actuellement disponible.'
                          : site.monitoringError
                            ? 'La récupération des mesures a échoué ou aucune mesure exploitable n’a été renvoyée. Les dernières mesures connues sont conservées.'
                            : 'Aucune mesure exploitable n’a été reçue.'}
                      </Text>
                    )}

                    {monitoring && site.monitoringError && (
                      <Text style={styles.warningNote}>
                        Actualisation échouée. Les dernières mesures reçues
                        sont conservées.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>
            Supervision énergétique LUMEN
          </Text>
          <Text style={styles.footerText}>
            Les centrales et leurs mesures proviennent de l’API LUMEN.
            Les mesures sont actualisées toutes les 30 secondes. Un tiret
            indique qu’aucune valeur exploitable n’a été reçue.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterButton,
        active && styles.filterActive,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text
        style={[
          styles.filterText,
          active && styles.filterTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const createStyles = (COLORS: ReturnType<typeof getLumenPalette>) =>
  StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 36, gap: 16 },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 14,
  },
  brand: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  brandSubtitle: {
    color: COLORS.muted,
    fontSize: 8,
    letterSpacing: 1.1,
    marginTop: 3,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    backgroundColor: COLORS.successBg,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  connectionBadgeError: {
    borderColor: COLORS.errorBorder,
    backgroundColor: COLORS.errorBg,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  statusDotError: { backgroundColor: COLORS.error },
  connectionText: {
    color: COLORS.success,
    fontSize: 9,
    fontWeight: '800',
  },
  connectionTextError: { color: COLORS.error },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: -9,
  },
  summaryCard: {
    padding: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
  },
  summaryLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  summaryValue: {
    color: COLORS.success,
    fontSize: 34,
    fontWeight: '900',
    marginTop: 5,
  },
  summaryFoot: { color: COLORS.muted, fontSize: 11, marginTop: 3 },
  errorCard: {
    padding: 16,
    gap: 10,
    backgroundColor: COLORS.errorBg,
    borderWidth: 1,
    borderColor: COLORS.errorBorder,
    borderRadius: 14,
  },
  errorTitle: { color: COLORS.error, fontSize: 14, fontWeight: '800' },
  errorText: { color: COLORS.errorBorder, fontSize: 12, lineHeight: 19 },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: COLORS.errorBorder,
    borderRadius: 9,
  },
  retryButtonText: {
    color: COLORS.errorBg,
    fontSize: 12,
    fontWeight: '800',
  },
  searchInput: {
    minHeight: 48,
    paddingHorizontal: 14,
    color: COLORS.text,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    fontSize: 13,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    backgroundColor: COLORS.card,
  },
  filterActive: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.successBg,
  },
  filterText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: { color: COLORS.success },
  installationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refreshText: {
    color: COLORS.success,
    fontSize: 12,
    fontWeight: '700',
  },
  disabledText: { opacity: 0.5 },
  stateCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
  },
  stateText: { color: COLORS.muted, fontSize: 12 },
  siteCard: {
    padding: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
  },
  siteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  siteIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.mutedBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  siteIconText: { fontSize: 23, color: COLORS.success },
  siteInfo: { flex: 1, gap: 4 },
  siteName: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  siteLocation: { color: COLORS.muted, fontSize: 11 },
  siteType: { color: COLORS.primary, fontSize: 11, marginTop: 2 },
  capacityText: { color: COLORS.muted, fontSize: 10, marginTop: 2 },
  chevron: { color: COLORS.success, fontSize: 24, paddingHorizontal: 4 },
  pressed: { opacity: 0.75 },
  siteDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 13,
  },
  siteStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  siteStatusText: { color: COLORS.success, fontSize: 11 },
  siteStatusError: { color: COLORS.error },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  details: { marginTop: 15, gap: 13 },
  detailLabel: { flex: 1, color: COLORS.muted, fontSize: 11 },
  detailValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  detailsNote: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 3,
  },
  warningNote: {
    color: COLORS.warning,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 3,
  },
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
  emptyCard: {
    padding: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    gap: 8,
  },
  emptyTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  emptyText: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  footer: {
    padding: 16,
    backgroundColor: COLORS.successBg,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    borderRadius: 14,
    gap: 8,
  },
  footerTitle: { color: COLORS.success, fontSize: 13, fontWeight: '800' },
  footerText: { color: COLORS.muted, fontSize: 12, lineHeight: 19 },
});

const styles = createStyles(getLumenPalette(null));
