import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '@/services/api';
import { getAuthToken } from '@/services/session';
import {
  extractSites,
  normalizeMonitoring,
  normalizeSite,
} from './normalize';
import type { DashboardSite } from './types';

const POLLING_INTERVAL_MS = 30_000;

export type DashboardState = {
  sites: DashboardSite[];
  loading: boolean;
  refreshing: boolean;
  error: string;
  /** Total production across sites with real measures, or null. */
  totalProduction: number | null;
  /** Total installed capacity, or null when any site lacks capacity. */
  totalCapacity: number | null;
  /** Total active alerts, or null when any site lacks the counter. */
  totalAlerts: number | null;
  /** Number of online sites that expose real measures. */
  onlineCount: number;
  /** First site exposing real measures, if any. */
  monitoredSite: DashboardSite | null;
  load: (manual?: boolean) => Promise<void>;
};

const FALLBACK_ERROR = 'Impossible de récupérer les données LUMEN.';

function sumOrNull(values: (number | null)[]): number | null {
  const defined = values.filter(
    (value): value is number => value !== null,
  );
  if (defined.length === 0) {
    return null;
  }
  return defined.reduce<number>((sum, value) => sum + value, 0);
}

/**
 * Charge la liste des sites, puis les mesures de chacune.
 * - Fusionne les mesures précédentes pour ne pas clignoter pendant un refresh.
 * - Interdit les requêtes concurrentes (garde `requestInProgress`).
 */
export function useDashboard(activeToken?: string | null): DashboardState {
  const [sites, setSites] = useState<DashboardSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const sitesRef = useRef<DashboardSite[]>([]);
  const requestInProgress = useRef(false);

  useEffect(() => {
    sitesRef.current = sites;
  }, [sites]);

  const load = useCallback(async (manual = false) => {
    if (requestInProgress.current) {
      return;
    }
    requestInProgress.current = true;
    if (manual) {
      setRefreshing(true);
    } else if (sitesRef.current.length === 0) {
      setLoading(true);
    }
    try {
      const token = activeToken ?? (await getAuthToken());
      if (!token) {
        throw new Error(
          'Aucune session active. Reconnectez-vous à LUMEN.',
        );
      }
      const response = await apiRequest<unknown>('sites', {
        method: 'GET',
        token,
      });
      const receivedSites = extractSites(response)
        .map(normalizeSite)
        .filter((site): site is DashboardSite => site !== null);

      // Conserve les mesures déjà connues d'un site récurrent.
      const mergedSites = receivedSites.map((site) => {
        const previous = sitesRef.current.find(
          (item) => item.id === site.id,
        );
        return previous
          ? { ...site, monitoring: previous.monitoring, monitoringError: previous.monitoringError }
          : site;
      });
      setSites(mergedSites);
      sitesRef.current = mergedSites;
      setError('');

      const updatedSites = await Promise.all(
        mergedSites.map(async (site): Promise<DashboardSite> => {
          try {
            const monitoringResponse = await apiRequest<unknown>(
              `monitoring/site/${encodeURIComponent(site.id)}/latest`,
              { method: 'GET', token },
            );
            const monitoring = normalizeMonitoring(monitoringResponse);
            if (!monitoring) {
              return { ...site, monitoring: site.monitoring, monitoringError: true };
            }
            return { ...site, monitoring, monitoringError: false };
          } catch {
            return { ...site, monitoring: site.monitoring, monitoringError: true };
          }
        }),
      );
      setSites(updatedSites);
      sitesRef.current = updatedSites;
    } catch (err) {
      setError(err instanceof Error ? err.message : FALLBACK_ERROR);
    } finally {
      requestInProgress.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const interval = setInterval(() => {
      void load();
    }, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const stats = useMemo(() => {
    const monitoredSite =
      sites.find((site) => site.monitoring !== null) ?? null;
    const onlineCount = sites.filter(
      (site) => !site.isOffline && site.monitoring !== null,
    ).length;

    const productionValues = sites
      .map((site) => site.monitoring?.production_kw ?? null)
      .filter((value): value is number => value !== null);
    const totalProduction = sumOrNull(productionValues);

    const allCapacitiesAvailable =
      sites.length > 0 && sites.every((site) => site.capacityKw !== null);
    const totalCapacity = allCapacitiesAvailable
      ? sumOrNull(sites.map((site) => site.capacityKw))
      : null;

    const allAlertCountsAvailable =
      sites.length > 0 && sites.every((site) => site.alertCount !== null);
    const totalAlerts = allAlertCountsAvailable
      ? sumOrNull(sites.map((site) => site.alertCount))
      : null;

    return {
      monitoredSite,
      onlineCount,
      totalProduction,
      totalCapacity,
      totalAlerts,
    };
  }, [sites]);

  return {
    sites,
    loading,
    refreshing,
    error,
    ...stats,
    load,
  };
}
