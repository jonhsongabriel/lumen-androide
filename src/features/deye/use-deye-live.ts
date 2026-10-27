/**
 * Agrège les mesures brutes Deye déjà renvoyées par le backend LUMEN.
 *
 * Le backend LUMEN collecte déjà les onduleurs Deye (source `deye_cloud` /
 * Solarman configurés dans « Ajouter une centrale ») et expose dans chaque
 * relevé `raw_data` — les points bruts Deye (DCPowerPV1, TotalLoadPower, SOC,
 * GridFrequency, ExternalCT1Power, Fault…). Ce hook lit ce flux existant :
 * les données affichées sont donc de vraies mesures, sans configuration Deye
 * côté app (aucun App ID/Secret nécessaire ici).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { summarizeRawData, type DeyeRawSummary } from '@/services/deye-api';
import { monitoringApi } from '@/services/lumen-api';
import { normalizeMonitoring } from '@/features/dashboard/normalize';
import type { Monitoring } from '@/features/dashboard/types';

export type DeyeLiveState = {
  loading: boolean;
  error: string;
  /** Agrégats calculés depuis raw_data Deye (kW, %, Hz, défaut). */
  summary: DeyeRawSummary | null;
  /** Mesures normalisées LUMEN (production_kw, consumption_kw, …). */
  monitoring: Monitoring | null;
  timestamp: string | null;
  refresh: () => void;
};

const POLL_MS = 30_000;

export function useDeyeLive(
  siteId: string,
  deviceId: string | undefined,
  token: string | null,
): DeyeLiveState {
  const [summary, setSummary] = useState<DeyeRawSummary | null>(null);
  const [monitoring, setMonitoring] = useState<Monitoring | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!siteId || !token || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const response = deviceId
        ? await monitoringApi.getLatest(siteId, deviceId, token)
        : await monitoringApi.getTotal(siteId, token);
      const normalized = normalizeMonitoring(response);
      setMonitoring(normalized);
      if (normalized?.raw_data) {
        setSummary(summarizeRawData(normalized.raw_data as Record<string, number | string>));
      }
      setTimestamp(normalized?.timestamp ?? null);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lecture des mesures impossible.');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [siteId, deviceId, token]);

  useEffect(() => {
    if (!siteId || !token) return;
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [siteId, deviceId, token, load]);

  return { loading, error, summary, monitoring, timestamp, refresh: () => void load() };
}
