import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LumenPalette } from '@/constants/lumen-colors';
import { dashboardStyles } from './styles';
import { formatMetric } from './normalize';
import type { DashboardSite } from './types';

/* ------------------------------------------------------------------ *
 * Carte statistique du tableau de bord
 * ------------------------------------------------------------------ */

type StatCardProps = {
  icon: string;
  label: string;
  value: string;
  unit?: string;
  foot: string;
  color: string;
  style?: StyleProp<ViewStyle>;
};

export function DashboardStatCard({
  icon,
  label,
  value,
  unit = '',
  foot,
  color,
  style,
}: StatCardProps) {
  return (
    <View style={[dashboardStyles.dashboardStatCard, style]}>
      <View style={dashboardStyles.dashboardStatTop}>
        <Text style={[dashboardStyles.dashboardStatIcon, { color }]}>
          {icon}
        </Text>
        <View
          style={[
            dashboardStyles.metricIndicator,
            { backgroundColor: color },
          ]}
        />
      </View>
      <Text style={dashboardStyles.dashboardStatLabel}>{label}</Text>
      <View style={dashboardStyles.dashboardStatValueRow}>
        <Text style={dashboardStyles.dashboardStatValue}>{value}</Text>
        {unit ? (
          <Text style={dashboardStyles.metricUnit}>{unit}</Text>
        ) : null}
      </View>
      <Text style={dashboardStyles.dashboardStatFoot}>{foot}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Carte métrique énergétique
 * ------------------------------------------------------------------ */

type MetricCardProps = {
  icon: string;
  label: string;
  value: string;
  unit: string;
  color: string;
  style?: StyleProp<ViewStyle>;
};

export function MetricCard({
  icon,
  label,
  value,
  unit,
  color,
  style,
}: MetricCardProps) {
  return (
    <View style={[dashboardStyles.metricCard, style]}>
      <View style={dashboardStyles.metricTop}>
        <Text style={[dashboardStyles.metricIcon, { color }]}>{icon}</Text>
        <View
          style={[
            dashboardStyles.metricIndicator,
            { backgroundColor: color },
          ]}
        />
      </View>
      <Text style={dashboardStyles.metricLabel}>{label}</Text>
      <View style={dashboardStyles.metricValueRow}>
        <Text style={dashboardStyles.metricValue}>{value}</Text>
        <Text style={dashboardStyles.metricUnit}>{unit}</Text>
      </View>
      <Text style={dashboardStyles.metricFoot}>
        {value === '—' ? 'Donnée indisponible' : 'Mesure réelle'}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Carte d'une centrale
 * ------------------------------------------------------------------ */

type SiteCardProps = {
  site: DashboardSite;
  COLORS: LumenPalette;
  onPress?: () => void;
};

function siteStatusLabel(site: DashboardSite): string {
  if (site.isOffline) return 'Hors ligne';
  if (site.monitoring !== null) return 'Mesures reçues';
  return site.monitoringError ? 'Mesures indisponibles' : 'En attente des mesures';
}

export function SiteCard({ site, COLORS, onPress }: SiteCardProps) {
  const hasMeasures = site.monitoring !== null;
  const statusColor = site.isOffline || !hasMeasures ? COLORS.warning : COLORS.success;
  const label = siteStatusLabel(site);

  return (
    <Pressable
      style={({ pressed }) => [
        dashboardStyles.siteCard,
        pressed && { opacity: 0.85 },
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={dashboardStyles.siteIcon}>
        <Text style={dashboardStyles.siteIconText}>ϟ</Text>
      </View>
      <View style={dashboardStyles.siteInfo}>
        <Text style={dashboardStyles.siteName}>{site.name}</Text>
        <Text style={dashboardStyles.siteLocation}>{site.location}</Text>
        <Text style={dashboardStyles.siteType}>{site.type}</Text>
        <View style={dashboardStyles.siteStatus}>
          <View
            style={[
              dashboardStyles.statusDot,
              { backgroundColor: statusColor },
            ]}
          />
          <Text
            style={[dashboardStyles.siteStatusText, { color: statusColor }]}
          >
            {label}
          </Text>
        </View>
        {site.monitoring ? (
          <View style={dashboardStyles.siteMetrics}>
            <Text style={dashboardStyles.siteMetricText}>
              Production : {formatMetric(site.monitoring.production_kw)} kW
            </Text>
            <Text style={dashboardStyles.siteMetricText}>
              Batterie :{' '}
              {formatMetric(site.monitoring.battery_level_percent, 1)} %
            </Text>
            <Text style={dashboardStyles.siteMetricText}>
              Consommation : {formatMetric(site.monitoring.consumption_kw)} kW
            </Text>
          </View>
        ) : null}
        {!hasMeasures && site.monitoringError ? (
          <Text style={dashboardStyles.siteWarning}>
            Aucune mesure exploitable reçue.
          </Text>
        ) : null}
        {hasMeasures && site.monitoringError ? (
          <Text style={dashboardStyles.siteWarning}>
            Actualisation échouée. Dernières mesures conservées.
          </Text>
        ) : null}
        {site.isOffline ? (
          <Text style={dashboardStyles.siteWarning}>
            Le serveur signale cette centrale hors ligne.
          </Text>
        ) : null}
      </View>
      <Text style={dashboardStyles.chevron}>›</Text>
    </Pressable>
  );
}

