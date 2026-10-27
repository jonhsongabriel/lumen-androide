/**
 * Hook « Deye temps réel pour le tableau de bord ».
 *
 * Si des credentials DeyeCloud sont enregistrés (SecureStore), récupère la
 * vraie centrale du compte (POST /station/listWithDevice) et ses agrégats
 * temps réel (POST /station/latest, avec repli sur /device/latest du premier
 * onduleur). Actualisé toutes les 60 secondes — conforme au modèle d'appel
 * recommandé par la doc OpenAPI Deye (limiter le polling).
 *
 * Résilience :
 *  - la dernière donnée valide est conservée en cas d'erreur passagère
 *    (pas de clignotement ni de perte d'affichage) ;
 *  - après 3 échecs consécutifs le polling ralentit (backoff ×2, max 8 min)
 *    et repart à 1 minute dès qu'un appel réussit.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deyeFetchLatest,
  deyeFetchStationLatest,
  deyeFetchStations,
  isDeviceOnline,
  summarizeDeviceData,
  type DeyeCredentials,
  type DeyeDeviceData,
  type DeyeStation,
} from '@/services/deye-api';
import {
  getDeyeCache,
  getDeyeCredentials,
  saveDeyeCache,
} from '@/services/session';

export type DeyeDashboardState = {
  /** Vrai dès que des credentials Deye existent (même avant les premières mesures). */
  connected: boolean;
  loading: boolean;
  error: string;
  stationName: string | null;
  stationId: string | null;
  /** Nombre d'appareils en ligne dans la centrale. */
  devicesOnline: number;
  devicesTotal: number;
  /** Agrégats temps réel (kW, %, Hz) — null si aucune mesure. */
  summary: ReturnType<typeof summarizeDeviceData> | null;
  /** Horodatage du dernier relevé Deye. */
  timestamp: string | null;
  /** Code défaut onduleur non nul — déclenche une alerte visuelle. */
  faultCode: string | null;
  /** Vrai si l'affichage vient du cache hors-ligne (pas de connexion active). */
  fromCache: boolean;
  /** Liste des centrales du compte (sélecteur multi-centrales). */
  stations: { id: string; name: string; deviceCount: number; onlineCount: number }[];
  stationIndex: number;
  selectStation: (index: number) => void;
  refresh: () => void;
};

const BASE_POLL_MS = 60_000;
const MAX_POLL_MS = 8 * 60_000;

export function useDeyeDashboard(): DeyeDashboardState {
  const [credentials, setCredentials] = useState<DeyeCredentials | null>(null);
  const [stations, setStations] = useState<DeyeStation[]>([]);
  const [stationIndex, setStationIndex] = useState(0);
  const [live, setLive] = useState<DeyeDeviceData | null>(null);
  const [liveIsCache, setLiveIsCache] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const failureCount = useRef(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [stored, cached] = await Promise.all([
        getDeyeCredentials(),
        getDeyeCache(),
      ]);
      if (!active) return;
      if (stored) setCredentials(stored);
      // Affiche immédiatement la dernière mesure connue (hors-ligne).
      if (cached?.live) {
        setLive(cached.live as unknown as DeyeDeviceData);
        setLiveIsCache(true);
      }
    })();
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    if (!credentials || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError('');
    try {
      const list = await deyeFetchStations(credentials);
      setStations(list);
      setLiveIsCache(false);
      const station = list[stationIndex] ?? list[0] ?? null;
      if (!station) {
        setLive(null);
        failureCount.current = 0;
        return;
      }
      // Préférer /station/latest (agrégats de la centrale) ; repli sur le
      // premier onduleur en ligne via /device/latest.
      let data: DeyeDeviceData | null = null;
      try {
        data = await deyeFetchStationLatest(credentials, station.stationId);
      } catch {
        data = null;
      }
      if (!data) {
        const online =
          station.deviceList?.find((d: { status?: string | number | null }) => isDeviceOnline(d.status)) ??
          station.deviceList?.[0];
        if (online?.sn) {
          const batch = await deyeFetchLatest(credentials, [online.sn]).catch(() => []);
          data = batch[0] ?? null;
        }
      }
      if (data) {
        // Ne recule jamais : une mesure plus ancienne que l'affichée est ignorée.
        setLive((prev) => {
          const prevTime = prev?.time ? Date.parse(prev.time.replace(' ', 'T')) : 0;
          const newTime = data.time ? Date.parse(data.time.replace(' ', 'T')) : Date.now();
          return newTime >= prevTime ? data : prev;
        });
        // Cache hors-ligne mis à jour à chaque mesure fraîche.
        void saveDeyeCache({
          live: data as unknown as Record<string, unknown>,
          stationName: station.stationName ?? null,
          stationId: station.stationId,
          savedAt: Date.now(),
        });
      }
      failureCount.current = 0;
    } catch (err) {
      // Échec : la dernière donnée valide reste affichée (pas d'écran vide).
      failureCount.current += 1;
      setError(
        err instanceof Error
          ? `DeyeCloud : ${err.message}`
          : 'DeyeCloud : erreur inconnue.',
      );
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [credentials, stationIndex]);

  useEffect(() => {
    if (!credentials) return;
    // Démarrage différé : évite un setState synchrone dans le corps de l'effet.
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), BASE_POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [credentials, load]);

  // Backoff : après 3 échecs consécutifs, espace le polling (×2, max 8 min).
  useEffect(() => {
    if (!credentials || failureCount.current < 3) return;
    const delay = Math.min(BASE_POLL_MS * 2 ** Math.min(failureCount.current - 2, 3), MAX_POLL_MS);
    const timer = setTimeout(() => void load(), delay);
    return () => clearTimeout(timer);
  });

  const selectStation = useCallback((index: number) => {
    setStationIndex(index);
    setLive(null);
    setLiveIsCache(false);
  }, []);

  // Réinitialisation à la déconnexion (dérivé, pas un effet d'état).
  const effectiveStations = credentials ? stations : [];
  const effectiveLive = credentials ? live : null;
  const station = effectiveStations[stationIndex] ?? effectiveStations[0] ?? null;
  const devices = station?.deviceList ?? [];
  const summary = effectiveLive ? summarizeDeviceData(effectiveLive) : null;
  const faultCode =
    summary?.fault && summary.fault !== '0' && summary.fault !== '' ? summary.fault : null;

  return {
    connected: credentials !== null,
    loading,
    error,
    stationName: station?.stationName ?? null,
    stationId: station?.stationId ?? null,
    devicesOnline: devices.filter((d) => isDeviceOnline(d.status)).length,
    devicesTotal: devices.length,
    summary,
    timestamp: live?.time ?? null,
    faultCode,
    fromCache: liveIsCache,
    stations: effectiveStations.map((s) => ({
      id: s.stationId,
      name: s.stationName ?? `Centrale ${s.stationId}`,
      deviceCount: s.deviceList?.length ?? 0,
      onlineCount: (s.deviceList ?? []).filter((d) => isDeviceOnline(d.status)).length,
    })),
    stationIndex,
    selectStation,
    refresh: () => void load(),
  };
}
