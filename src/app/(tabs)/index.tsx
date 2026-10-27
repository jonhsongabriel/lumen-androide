import { useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getLumenPalette } from '@/constants/lumen-colors';
import {
  DashboardStatCard,
  MetricCard,
  SiteCard,
} from '@/features/dashboard/cards';
import { formatMetric } from '@/features/dashboard/normalize';
import { createDashboardStyles } from '@/features/dashboard/styles';
import { useDashboard } from '@/features/dashboard/use-dashboard';
import { useAuth } from '@/contexts/auth';
import { SiteMapPreview, type MapSite } from '@/components/SiteMapPreview';
import { useDeyeDashboard } from '@/features/deye/use-deye-realtime';
import { useDeyeLive } from '@/features/deye/use-deye-live';

const WIDE_BREAKPOINT = 900;

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const COLORS = useMemo(
    () => getLumenPalette(colorScheme as 'light' | 'dark' | null),
    [colorScheme],
  );
  const styles = useMemo(() => createDashboardStyles(COLORS), [COLORS]);
  const isWide = Platform.OS === 'web' && width >= WIDE_BREAKPOINT;
  const statCardStyle = isWide
    ? [styles.dashboardStatCard, styles.dashboardStatCardWide]
    : [styles.dashboardStatCard];
  const metricCardStyle = isWide
    ? [styles.metricCard, styles.metricCardWide]
    : [styles.metricCard];
  const router = useRouter();
  const { token } = useAuth();

  const {
    sites,
    loading,
    refreshing,
    error,
    totalProduction,
    totalCapacity,
    totalAlerts,
    onlineCount,
    monitoredSite,
    load,
  } = useDashboard(token);

  const monitoring = monitoredSite?.monitoring ?? null;
  const deye = useDeyeDashboard();
  // Vraie centrale existante : le backend LUMEN renvoie déjà les points bruts
  // Deye (raw_data) de la centrale supervisée — priorité à ce flux réel.
  const deyeLive = useDeyeLive(monitoredSite?.id ?? '', undefined, token);
  const statusColor = error
    ? COLORS.error
    : loading
      ? COLORS.warning
      : COLORS.success;
  const statusLabel = loading
    ? 'CHARGEMENT'
    : error
      ? 'ERREUR API'
      : 'API LUMEN';

  const retry = () => void load(true);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.background}
      />
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>L</Text>
          </View>
          <View>
            <Text style={styles.brandName}>LUMEN</Text>
            <Text style={styles.brandSubtitle}>
              SUPERVISION ÉNERGÉTIQUE
            </Text>
          </View>
        </View>
        {token ? (
          <View
            style={[
              styles.demoBadge,
              error ? styles.badgeError : styles.badgeConnected,
            ]}
          >
            <View
              style={[styles.demoDot, { backgroundColor: statusColor }]}
            />
            <Text style={[styles.demoText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={() => router.push('/(auth)/login')}
            style={styles.retryButton}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Se connecter</Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={COLORS.success}
            colors={[COLORS.success]}
          />
        }
      >
        <Text style={styles.greeting}>Tableau de bord</Text>
        <Text style={styles.subtitle}>
          Vue d’ensemble de tous les sites supervisés
        </Text>
        {!token ? (
          <View style={styles.notice}>
            <Text style={styles.noticeIcon}>ⓘ</Text>
            <View style={styles.noticeContent}>
              <Text style={styles.noticeText}>
                Connectez-vous à votre compte LUMEN pour consulter les
                données réelles de vos centrales.
              </Text>
              <Pressable
                onPress={() => router.push('/(auth)/login')}
                style={styles.retryButton}
                accessibilityRole="button"
              >
                <Text style={styles.retryText}>Se connecter</Text>
              </Pressable>
            </View>
          </View>
        ) : error ? (
          <View style={styles.notice}>
            <Text style={styles.noticeIcon}>ⓘ</Text>
            <View style={styles.noticeContent}>
              <Text style={styles.noticeText}>{error}</Text>
              <Pressable
                onPress={retry}
                disabled={refreshing}
                style={styles.retryButton}
                accessibilityRole="button"
              >
                <Text style={styles.retryText}>
                  {refreshing ? 'Actualisation...' : 'Réessayer'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        <View style={styles.dashboardStatsGrid}>
          <DashboardStatCard
            icon="◨"
            label="Sites totaux"
            value={String(sites.length)}
            foot={`${onlineCount} opérationnels`}
            color={COLORS.success}
            style={statCardStyle}
          />
          <DashboardStatCard
            icon="⦸"
            label="Production totale"
            value={
              totalProduction === null ? '—' : formatMetric(totalProduction)
            }
            unit={totalProduction === null ? '' : 'kW'}
            foot={
              totalProduction === null
                ? 'Aucune mesure de production reçue'
                : 'En temps réel'
            }
            color={COLORS.warning}
            style={statCardStyle}
          />
          <DashboardStatCard
            icon="▤"
            label="Capacité installée"
            value={
              totalCapacity === null ? '—' : formatMetric(totalCapacity, 0)
            }
            unit={totalCapacity === null ? '' : 'kW'}
            foot={
              totalCapacity === null
                ? 'Capacité non fournie par l’API'
                : 'Total des sites'
            }
            color={COLORS.primary}
            style={statCardStyle}
          />
          <DashboardStatCard
            icon="!"
            label="Alertes actives"
            value={totalAlerts === null ? '—' : formatMetric(totalAlerts, 0)}
            foot={
              totalAlerts === null
                ? 'Compteur non fourni par l’API'
                : 'Nécessitent une attention'
            }
            color={COLORS.error}
            style={statCardStyle}
          />
        </View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Vue énergétique</Text>
          <Text style={styles.period}>
            {refreshing ? 'ACTUALISATION' : 'TEMPS RÉEL'}
          </Text>
        </View>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>PRODUCTION SOLAIRE</Text>
            <Text style={styles.heroIcon}>☀</Text>
          </View>
          <View style={styles.powerRow}>
            <Text style={styles.powerValue}>
              {loading && !monitoring
                ? '...'
                : formatMetric(monitoring?.production_kw)}
            </Text>
            <Text style={styles.powerUnit}>kW</Text>
          </View>
          <Text style={styles.heroFoot}>
            {monitoredSite
              ? `Centrale : ${monitoredSite.name}`
              : loading
                ? 'Récupération des mesures réelles...'
                : 'Aucune mesure de production disponible'}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width:
                    monitoring?.battery_level_percent != null
                      ? `${Math.min(
                          100,
                          Math.max(0, monitoring.battery_level_percent),
                        )}%`
                      : '0%',
                },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {monitoring?.battery_level_percent != null
              ? `Niveau de batterie : ${formatMetric(
                  monitoring.battery_level_percent,
                  1,
                )} %`
              : 'Données de batterie indisponibles'}
          </Text>
        </View>
        {deye.connected || deyeLive.summary ? (
          <View
            style={[
              styles.heroCard,
              {
                marginTop: 12,
                borderLeftWidth: 4,
                borderLeftColor: deyeLive.error
                  ? COLORS.error
                  : deyeLive.summary
                    ? COLORS.success
                    : COLORS.primary,
              },
            ]}
          >
            <View style={styles.heroTop}>
              <Text style={styles.heroLabel}>
                {deyeLive.summary
                  ? 'CENTRALE DEYE · DONNÉES RÉELLES'
                  : 'CENTRALE DEYE CLOUD'}
                {deye.stationName || deyeLive.monitoring
                  ? ` · ${deye.stationName ?? monitoredSite?.name ?? ''}`
                  : ''}
              </Text>
              <Text style={styles.heroIcon}>⚡</Text>
            </View>
            {deye.stations.length > 1 ? (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 4,
                  marginBottom: 8,
                }}
              >
                {deye.stations.map((station, index) => (
                  <Pressable
                    key={station.id}
                    onPress={() => deye.selectStation(index)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor:
                        index === deye.stationIndex
                          ? COLORS.primary
                          : COLORS.border,
                      backgroundColor:
                        index === deye.stationIndex
                          ? COLORS.primary
                          : 'transparent',
                    }}
                    accessibilityRole="button"
                  >
                    <Text
                      style={{
                        color:
                          index === deye.stationIndex
                            ? '#FFFFFF'
                            : COLORS.muted,
                        fontSize: 10,
                        fontWeight: '600',
                      }}
                    >
                      {station.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {deye.fromCache ? (
              <Text style={[styles.heroFoot, { color: COLORS.warning }]}>
                ⓘ Données hors-ligne (dernière mesure enregistrée)
              </Text>
            ) : null}
            {deye.faultCode ? (
              <View
                style={{
                  marginTop: 4,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: COLORS.error,
                  borderRadius: 8,
                  padding: 8,
                  backgroundColor: 'rgba(239,68,68,0.08)',
                }}
              >
                <Text style={{ color: COLORS.error, fontSize: 11, fontWeight: '700' }}>
                  ⚠ Défaut onduleur signalé (code {deye.faultCode})
                </Text>
                <Text style={{ color: COLORS.muted, fontSize: 10 }}>
                  Vérifiez l’onduleur ou consultez l’écran Deye Cloud.
                </Text>
              </View>
            ) : null}
            {deyeLive.loading && !deyeLive.summary ? (
              <Text style={styles.heroFoot}>
                Lecture des mesures Deye en cours...
              </Text>
            ) : deyeLive.summary || deye.summary ? (
              <>
                <View style={styles.powerRow}>
                  <Text style={styles.powerValue}>
                    {(deyeLive.summary?.pvPowerKw ?? deye.summary?.pvPowerKw) !== null
                      ? formatMetric(
                          (deyeLive.summary?.pvPowerKw ?? deye.summary?.pvPowerKw) as number,
                        )
                      : '—'}
                  </Text>
                  <Text style={styles.powerUnit}>kW solaire</Text>
                </View>
                <View
                  style={[
                    styles.dashboardStatsGrid,
                    { marginTop: 10, gap: 8 },
                  ]}
                >
                  {[
                    {
                      label: 'Charges',
                      value:
                        deyeLive.summary?.loadPowerKw ?? deye.summary?.loadPowerKw ?? null,
                      unit: 'kW',
                    },
                    {
                      label: 'Réseau',
                      value:
                        deyeLive.summary?.gridPowerKw ?? deye.summary?.gridPowerKw ?? null,
                      unit: 'kW',
                    },
                    {
                      label: 'Batterie',
                      value:
                        deyeLive.summary?.batteryPowerKw ??
                        deye.summary?.batteryPowerKw ??
                        null,
                      unit: 'kW',
                    },
                    {
                      label: 'SOC',
                      value: deyeLive.summary?.batterySoc ?? deye.summary?.batterySoc ?? null,
                      unit: '%',
                    },
                    {
                      label: 'Fréquence',
                      value:
                        deyeLive.summary?.gridFrequency ?? deye.summary?.gridFrequency ?? null,
                      unit: 'Hz',
                    },
                  ].map((item) => (
                    <View
                      key={item.label}
                      style={[
                        styles.metricCard,
                        { flex: 1, minWidth: '22%' },
                      ]}
                    >
                      <Text style={styles.metricLabel}>{item.label}</Text>
                      <View style={styles.metricValueRow}>
                        <Text style={styles.metricValue}>
                          {item.value === null || item.value === undefined
                            ? '—'
                            : formatMetric(item.value)}
                        </Text>
                        <Text style={styles.metricUnit}>{item.unit}</Text>
                      </View>
                    </View>
                  ))}
                </View>
                {(deyeLive.summary?.fault ?? deye.summary?.fault) ? (
                  <Text style={[styles.heroFoot, { color: COLORS.error }]}>
                    ⚠ Défaut onduleur signalé
                  </Text>
                ) : null}
                <Text style={styles.heroFoot}>
                  {deyeLive.timestamp
                    ? `relevé ${new Date(deyeLive.timestamp).toLocaleTimeString(
                        'fr-FR',
                      )}`
                    : deye.timestamp
                      ? `relevé ${new Date(
                          deye.timestamp.replace(' ', 'T'),
                        ).toLocaleTimeString('fr-FR')}`
                      : ''}
                  {' · flux réel LUMEN + DeyeCloud'}
                </Text>
              </>
            ) : deye.error ? (
              <Text style={[styles.heroFoot, { color: COLORS.error }]}>
                {deye.error}
              </Text>
            ) : deye.loading && !deye.summary ? (
              <Text style={styles.heroFoot}>
                Lecture des données DeyeCloud en cours...
              </Text>
            ) : (
              <Text style={styles.heroFoot}>
                Aucune mesure Deye disponible pour cette centrale.
              </Text>
            )}
          </View>
        ) : null}
        <View style={styles.metricsGrid}>
          <MetricCard
            icon="⌁"
            label="Batterie"
            value={formatMetric(monitoring?.battery_level_percent, 1)}
            unit="%"
            color={COLORS.success}
            style={metricCardStyle}
          />
          <MetricCard
            icon="↗"
            label="Consommation"
            value={formatMetric(monitoring?.consumption_kw)}
            unit="kW"
            color={COLORS.primary}
            style={metricCardStyle}
          />
          <MetricCard
            icon="⦸"
            label="Tension batterie"
            value={formatMetric(monitoring?.battery_voltage)}
            unit="V"
            color={COLORS.warning}
            style={metricCardStyle}
          />
          <MetricCard
            icon="◈"
            label="Température"
            value={formatMetric(monitoring?.temperature_celsius, 1)}
            unit="°C"
            color={COLORS.primary}
            style={metricCardStyle}
          />
        </View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Carte des centrales</Text>
          <Text style={styles.count}>
            {sites.filter((site) => site.latitude != null).length} géolocalisée(s)
          </Text>
        </View>
        <SiteMapPreview
          sites={sites.map((site): MapSite => ({
            id: site.id,
            name: site.name,
            location: site.location,
            status: site.isOffline ? 'offline' : site.monitoring ? 'operational' : 'alert',
            latitude: site.latitude,
            longitude: site.longitude,
            productionKw: site.monitoring?.production_kw ?? null,
          }))}
          height={260}
        />
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mes centrales</Text>
          <Text style={styles.count}>
            {loading && sites.length === 0
              ? 'Chargement...'
              : `${sites.length} site(s)`}
          </Text>
        </View>
        {loading && sites.length === 0 ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={COLORS.success} />
            <Text style={styles.stateText}>
              Chargement des centrales depuis l’API...
            </Text>
          </View>
        ) : sites.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.siteName}>Aucune centrale disponible</Text>
            <Text style={styles.siteLocation}>
              {error ||
                'Le serveur n’a retourné aucune centrale pour ce compte.'}
            </Text>
            {token ? (
              <Pressable
                onPress={retry}
                style={styles.retryButton}
                accessibilityRole="button"
              >
                <Text style={styles.retryText}>Réessayer</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          sites.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              COLORS={COLORS}
              onPress={() => router.push(`/monitoring/${site.id}`)}
            />
          ))
        )}
        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>
            Supervision énergétique LUMEN
          </Text>
          <Text style={styles.footerText}>
            {loading
              ? 'Connexion à l’API LUMEN en cours...'
              : `${onlineCount} centrale(s) avec mesures disponibles sur ${sites.length}. Les données sont actualisées toutes les 30 secondes.`}
          </Text>
          {token ? (
            <Pressable
              onPress={retry}
              disabled={refreshing}
              style={styles.refreshButton}
              accessibilityRole="button"
            >
              <Text style={styles.refreshButtonText}>
                {refreshing ? 'Actualisation...' : 'Actualiser les données'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
