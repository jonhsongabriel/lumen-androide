/**
 * Écran « Deye Cloud » — exploitation complète de l'OpenAPI DeyeCloud v1.0
 * (https://developer.deyecloud.com/api), conforme aux exemples officiels
 * DeyeCloudDevelopers/deye-openapi-client-sample-code.
 *
 * Fonctionnalités :
 *  1. Connexion développeur (EU / US / Inde, App ID, App Secret, email, mot de
 *     passe SHA-256, companyId optionnel pour les comptes business).
 *  2. Centrales : POST /station/listWithDevice (+ /station/latest en option).
 *  3. Temps réel : POST /device/latest (tous les points bruts + agrégats).
 *  4. Points de mesure : POST /device/measurePoints.
 *  5. Historique : POST /device/history avec granularité 1 (journée, courbes) /
 *     2 (jours) / 3 (mois) / 4 (années), et POST /station/history (granularité 2).
 *  6. Time-of-Use : POST /order/sys/tou/update (écriture des 6 créneaux).
 *  7. Contrôle : workMode, energyPattern, MAX_SELL/SOLAR_POWER, paramètres
 *     batterie, grid peak shaving, stratégies dynamicControl.
 *  8. Suivi des ordres : GET /order/{orderId}.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import {
  AlertBox,
  Card,
  Button,
  EmptyState,
  Field,
  Input,
  Screen,
  Select,
  useLumenPalette,
} from '@/components/lumen-ui';
import { LineChartCard } from '@/components/line-chart-card';
import {
  DEYE_BASE_URLS,
  deyeApplyStrategy,
  deyeDateForGranularity,
  deyeFetchDeviceHistory,
  deyeFetchLatest,
  deyeFetchMeasurePoints,
  deyeFetchOrderStatus,
  deyeFetchStationHistory,
  deyeFetchStations,
  deyeFetchStationLatest,
  deyeLogin,
  deyeUpdateBatteryParameter,
  deyeUpdateEnergyPattern,
  deyeUpdateGridPeakShaving,
  deyeUpdatePower,
  deyeUpdateTou,
  deyeUpdateWorkMode,
  isDeviceOnline,
  summarizeDeviceData,
  type DeyeCredentials,
  type DeyeDeviceData,
  type DeyeEnergyPattern,
  type DeyeHistoryRow,
  type DeyeMeasurePoint,
  type DeyeRegion,
  type DeyeStation,
  type DeyeStrategyKind,
  type DeyeTouSlot,
  type DeyeWorkMode,
} from '@/services/deye-api';
import {
  clearDeyeCredentials,
  getDeyeCredentials,
  saveDeyeCredentials,
} from '@/services/session';

type ScreenName = 'credentials' | 'dashboard';
type HistoryMode = 'day' | 'month' | 'year';
type ControlTab = 'tou' | 'mode' | 'power' | 'strategy';

const PV_LABELS: Record<string, string> = {
  DCPowerPV1: 'PV1', DCPowerPV2: 'PV2', DCPowerPV3: 'PV3', DCPowerPV4: 'PV4',
  DCPowerPV5: 'PV5', DCPowerPV6: 'PV6', DCPowerPV7: 'PV7', DCPowerPV8: 'PV8',
};

/** Points de mesure usuels demandés pour la granularité 1 (journée). */
const DAY_MEASURE_POINTS = [
  'SOC', 'DCPowerPV1', 'DCPowerPV2', 'DCPowerPV3', 'DCPowerPV4',
  'TotalLoadPower', 'TotalGridPower', 'BatteryPower', 'GridFrequency',
];

function num(map: Record<string, number | string>, keys: string[]): number | null {
  for (const key of keys) {
    const value = map[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export function DeyeCloudScreen() {
  const COLORS = useLumenPalette();
  const [screen, setScreen] = useState<ScreenName>('credentials');
  const [saved, setSaved] = useState<DeyeCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 1. Credentials -----------------------------------------------------
  const [region, setRegion] = useState<DeyeRegion>('EU');
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [connecting, setConnecting] = useState(false);

  // 2. Stations & appareils -------------------------------------------
  const [stations, setStations] = useState<DeyeStation[]>([]);
  const [stationIndex, setStationIndex] = useState(0);
  const [deviceSn, setDeviceSn] = useState('');

  // 3/4/5. Données -----------------------------------------------------
  const [live, setLive] = useState<DeyeDeviceData | null>(null);
  const [stationLive, setStationLive] = useState<DeyeDeviceData | null>(null);
  const [measurePoints, setMeasurePoints] = useState<DeyeMeasurePoint[]>([]);
  const [history, setHistory] = useState<DeyeHistoryRow[]>([]);
  const [historyMode, setHistoryMode] = useState<HistoryMode>('day');
  /** Date choisie pour la granularité (format yyyy-MM-dd, yyyy-MM ou yyyy). */
  const [historyAnchor, setHistoryAnchor] = useState(() => new Date());
  const [dataLoading, setDataLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 6/7. Contrôle ------------------------------------------------------
  const [tou, setTou] = useState<DeyeTouSlot[]>([]);
  const [controlTab, setControlTab] = useState<ControlTab>('strategy');
  const [orderStatus, setOrderStatus] = useState<string>('');

  const station = stations[stationIndex] ?? null;
  const devices = station?.deviceList ?? [];

  useEffect(() => {
    let active = true;
    void (async () => {
      const stored = await getDeyeCredentials();
      if (!active) return;
      if (stored) {
        setSaved(stored);
        setRegion(stored.region);
        setAppId(stored.appId);
        setAppSecret(stored.appSecret);
        setEmail(stored.email);
        setPassword(stored.password);
        // Credentials déjà enregistrés → accès direct au tableau de bord.
        setScreen('dashboard');
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const credentials: DeyeCredentials | null = useMemo(() => {
    if (appId && appSecret && email && password) {
      return {
        region,
        appId: appId.trim(),
        appSecret: appSecret.trim(),
        email: email.trim(),
        password,
        ...(companyId.trim() ? { companyId: companyId.trim() } : {}),
      };
    }
    return saved;
  }, [region, appId, appSecret, email, password, companyId, saved]);

  const loadStations = useCallback(
    async (creds: DeyeCredentials, manual = false) => {
      if (manual) setRefreshing(true);
      else setDataLoading(true);
      setError('');
      try {
        const list = await deyeFetchStations(creds);
        setStations(list);
        const firstDevice =
          list[stationIndex]?.deviceList?.find((d) => isDeviceOnline(d.status)) ??
          list[stationIndex]?.deviceList?.[0];
        if (firstDevice?.sn) setDeviceSn(firstDevice.sn);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Chargement des centrales Deye impossible.');
      } finally {
        setDataLoading(false);
        setRefreshing(false);
      }
    },
    [stationIndex],
  );

  // Temps réel + historique pour l'appareil choisi (rafraîchi chaque minute)
  useEffect(() => {
    if (!credentials || !deviceSn) return;
    let active = true;
    const load = async (manual = false) => {
      if (manual) setRefreshing(true);
      else setDataLoading(true);
      setError('');
      try {
        const results = await Promise.all([
          deyeFetchLatest(credentials, [deviceSn]).catch(() => []),
          station
            ? deyeFetchStationLatest(credentials, station.stationId).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (!active) return;
        const latest = results[0][0] ?? null;
        setLive(latest);
        setStationLive(results[1]);
        if (latest) {
          const [points, historyRows] = await Promise.all([
            deyeFetchMeasurePoints(credentials, deviceSn).catch(() => []),
            deyeFetchDeviceHistory(
              credentials,
              deviceSn,
              historyMode === 'day' ? 1 : historyMode === 'month' ? 3 : 4,
              deyeDateForGranularity(historyAnchor, historyMode === 'day' ? 1 : historyMode === 'month' ? 3 : 4),
              deyeDateForGranularity(historyAnchor, historyMode === 'month' ? 3 : 4),
              DAY_MEASURE_POINTS,
            ).catch(() => []),
          ]);
          if (!active) return;
          setMeasurePoints(points);
          setHistory(historyRows);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Chargement des données Deye impossible.');
      } finally {
        if (active) {
          setDataLoading(false);
          setRefreshing(false);
        }
      }
    };
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials, deviceSn, historyMode, historyAnchor]);

  // Historique station (jours, 31 max) — indépendant de l'appareil
  useEffect(() => {
    if (!credentials || !station?.stationId) return;
    let active = true;
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 86400_000);
    void deyeFetchStationHistory(
      credentials,
      station.stationId,
      2,
      deyeDateForGranularity(start, 2),
      deyeDateForGranularity(end, 2),
    )
      .then((rows) => active && setHistory((prev) => prev.length === 0 ? rows : prev))
      .catch(() => undefined);
    return () => { active = false; };
  }, [credentials, station?.stationId]);

  const connect = async () => {
    setConnecting(true);
    setError('');
    try {
      const creds: DeyeCredentials = {
        region,
        appId: appId.trim(),
        appSecret: appSecret.trim(),
        email: email.trim(),
        password,
        ...(companyId.trim() ? { companyId: companyId.trim() } : {}),
      };
      await deyeLogin(creds);
      await saveDeyeCredentials(creds);
      setSaved(creds);
      setScreen('dashboard');
      await loadStations(creds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion DeyeCloud impossible.');
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    await clearDeyeCredentials();
    setSaved(null);
    setStations([]);
    setDeviceSn('');
    setLive(null);
    setStationLive(null);
    setHistory([]);
    setTou([]);
    setScreen('credentials');
  };

  const runControl = async (action: () => Promise<{ orderId: string | null }>, label: string) => {
    if (!credentials) return;
    setError('');
    setOrderStatus(`${label} : envoi en cours…`);
    try {
      const { orderId } = await action();
      if (!orderId) {
        setOrderStatus(`${label} : commande envoyée.`);
        return;
      }
      // GET /order/{orderId} — vérifie l'exécution après un délai
      await new Promise((resolve) => setTimeout(resolve, 4000));
      const status = await deyeFetchOrderStatus(credentials, orderId);
      const state = String(status?.status ?? status?.orderStatus ?? 'envoyée');
      setOrderStatus(`${label} : ${state} (order ${orderId})`);
    } catch (err) {
      setOrderStatus('');
      setError(err instanceof Error ? err.message : `${label} : échec de la commande.`);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Formulaire de connexion                                          */
  /* ---------------------------------------------------------------- */
  if (loading) {
    return (
      <Screen COLORS={COLORS} title="Deye Cloud" subtitle="Chargement…">
        <ActivityIndicator color={COLORS.primary} />
      </Screen>
    );
  }

  if (screen === 'credentials' || !credentials) {
    return (
      <Screen
        COLORS={COLORS}
        title="Deye Cloud"
        subtitle="Connectez votre compte développeur DeyeCloud (OpenAPI officielle v1.0)"
      >
        <Card COLORS={COLORS} title="Identifiants développeur">
          <Text style={{ color: COLORS.muted, fontSize: 11 }}>
            Créez une application sur developer.deyecloud.com → Application →
            Create Application pour obtenir votre App ID et App Secret.
          </Text>
          <Field COLORS={COLORS} label="Centre de données">
            <Select
              COLORS={COLORS}
              value={region}
              onChange={(value) => setRegion(value as DeyeRegion)}
              options={[
                { value: 'EU', label: 'EU — Europe, Afrique, Asie-Pacifique' },
                { value: 'US', label: 'US — Amériques' },
                { value: 'INDIA', label: 'Inde' },
              ]}
            />
            <Text style={{ color: COLORS.muted, fontSize: 10, marginTop: 4 }}>
              {DEYE_BASE_URLS[region]}
            </Text>
          </Field>
          <Field COLORS={COLORS} label="App ID">
            <Input COLORS={COLORS} value={appId} onChangeText={setAppId} placeholder="App ID de l'application Deye" />
          </Field>
          <Field COLORS={COLORS} label="App Secret">
            <Input COLORS={COLORS} value={appSecret} onChangeText={setAppSecret} placeholder="App Secret" />
          </Field>
          <Field COLORS={COLORS} label="Email du compte Deye">
            <Input COLORS={COLORS} value={email} onChangeText={setEmail} placeholder="email@exemple.com" />
          </Field>
          <Field COLORS={COLORS} label="Mot de passe Deye">
            <Input COLORS={COLORS} value={password} onChangeText={setPassword} placeholder="Mot de passe" secure />
          </Field>
          <Field COLORS={COLORS} label="Company ID (comptes business, optionnel)">
            <Input COLORS={COLORS} value={companyId} onChangeText={setCompanyId} placeholder="0" />
          </Field>
          <Button
            COLORS={COLORS}
            label={connecting ? 'Connexion…' : 'Se connecter à DeyeCloud'}
            onPress={() => void connect()}
            loading={connecting}
          />
        </Card>
        {error ? <AlertBox COLORS={COLORS}>{error}</AlertBox> : null}
      </Screen>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Tableau de bord                                                  */
  /* ---------------------------------------------------------------- */
  const summary = live ? summarizeDeviceData(live) : null;
  const historyLabels = history.map((row) => {
    const date = new Date(row.time.replace(' ', 'T'));
    return Number.isNaN(date.getTime())
      ? row.time
      : historyMode === 'day'
        ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString('fr-FR');
  });
  const pickSeries = (keys: string[], label: string, color: string) => ({
    key: keys[0],
    label,
    color,
    values: history.map((row) => {
      for (const key of keys) {
        const value = num(row.values, [key]);
        if (value !== null) {
          return historyMode === 'day' ? value / 1000 : value; // W → kW pour la journée
        }
      }
      return null;
    }),
  });

  const touEditable: DeyeTouSlot[] = tou.length > 0 ? tou : [];
  const strategyOptions: { kind: DeyeStrategyKind; label: string; description: string }[] = [
    { kind: 'SELF_CONSUMPTION', label: 'Autoconsommation', description: 'Maximiser l’usage du solaire sur place' },
    { kind: 'FULLY_CHARGE', label: 'Charge complète', description: 'Charger la batterie au SOC cible' },
    { kind: 'FULLY_FEEDIN_GRID', label: 'Injection totale', description: 'Vendre le surplus au réseau' },
    { kind: 'IDLE', label: 'Repos', description: 'Ni charge ni décharge batterie' },
  ];

  return (
    <Screen
      COLORS={COLORS}
      title="Deye Cloud"
      subtitle="Données et contrôle officiels DeyeCloud v1.0"
    >
      {error ? <AlertBox COLORS={COLORS}>{error}</AlertBox> : null}
      {orderStatus ? (
        <Card COLORS={COLORS} title="Statut de commande">
          <Text style={{ color: COLORS.muted, fontSize: 11 }}>{orderStatus}</Text>
        </Card>
      ) : null}

      {/* Centrale + appareil */}
      <Card COLORS={COLORS} title="Centrale & onduleur">
        {stations.length === 0 ? (
          dataLoading ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <EmptyState COLORS={COLORS} icon="◉" message="Aucune centrale sur ce compte Deye." />
          )
        ) : (
          <>
            <Field COLORS={COLORS} label="Centrale">
              <Select
                COLORS={COLORS}
                value={String(stationIndex)}
                onChange={(value) => {
                  const index = Number(value);
                  setStationIndex(index);
                  const firstDevice =
                    stations[index]?.deviceList?.find((d) => isDeviceOnline(d.status)) ??
                    stations[index]?.deviceList?.[0];
                  setDeviceSn(firstDevice?.sn ?? '');
                }}
                options={stations.map((s, index) => ({
                  value: String(index),
                  label: `${s.stationName ?? `Centrale ${index + 1}`}${s.city ? ` · ${s.city}` : ''}`,
                }))}
              />
            </Field>
            {devices.length > 0 ? (
              <Field COLORS={COLORS} label="Onduleur (SN)">
                <Select
                  COLORS={COLORS}
                  value={deviceSn}
                  onChange={setDeviceSn}
                  options={devices.map((device) => ({
                    value: device.sn,
                    label: `${device.modelName || device.deviceType || 'Onduleur'} · ${device.sn}${isDeviceOnline(device.status) ? '' : ' (hors ligne)'}`,
                  }))}
                />
              </Field>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <View style={{ flex: 1 }}>
                <Button
                  COLORS={COLORS}
                  label={refreshing ? 'Actualisation…' : 'Actualiser'}
                  variant="outline"
                  onPress={() => void loadStations(credentials, true)}
                  loading={refreshing}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button COLORS={COLORS} label="Déconnecter" variant="outline" onPress={() => void disconnect()} />
              </View>
            </View>
          </>
        )}
      </Card>

      {/* Temps réel */}
      {dataLoading && !live ? <ActivityIndicator color={COLORS.primary} /> : null}
      {live && summary ? (
        <Card COLORS={COLORS} title="Temps réel onduleur (/device/latest)">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[
              { label: 'Puissance PV', value: summary.pvPowerKw, unit: 'kW', color: COLORS.accentProduction },
              { label: 'Charges', value: summary.loadPowerKw, unit: 'kW', color: COLORS.accentConsumption },
              { label: 'Réseau', value: summary.gridPowerKw, unit: 'kW', color: COLORS.primary },
              { label: 'Batterie', value: summary.batteryPowerKw, unit: 'kW', color: COLORS.accentBattery },
              { label: 'SOC', value: summary.batterySoc, unit: '%', color: COLORS.accentBattery },
              { label: 'Fréquence', value: summary.gridFrequency, unit: 'Hz', color: COLORS.accentTemperature },
            ].filter((item) => item.value !== null).map((item) => (
              <View
                key={item.label}
                style={{
                  flexGrow: 1,
                  minWidth: '30%',
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: 10,
                  padding: 10,
                  backgroundColor: COLORS.background,
                }}
              >
                <Text style={{ color: COLORS.muted, fontSize: 11 }}>{item.label}</Text>
                <Text style={{ color: item.color, fontSize: 17, fontWeight: '800' }}>
                  {(item.value as number).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} {item.unit}
                </Text>
              </View>
            ))}
          </View>
          {live.time ? (
            <Text style={{ color: COLORS.muted, fontSize: 10, marginTop: 8 }}>
              Dernier relevé : {new Date(live.time.replace(' ', 'T')).toLocaleString('fr-FR')}
              {summary.fault && summary.fault !== '0' ? ' · ⚠ défaut signalé' : ''}
            </Text>
          ) : null}
          {/* Strings PV individuels */}
          {live.points.filter((p) => PV_LABELS[p.key]).length > 0 ? (
            <View style={{ marginTop: 10 }}>
              <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 12 }}>Strings photovoltaïques</Text>
              {live.points.filter((p) => PV_LABELS[p.key]).map((point) => (
                <View key={point.key} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                  <Text style={{ color: COLORS.muted, fontSize: 12 }}>{PV_LABELS[point.key]}</Text>
                  <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: '600' }}>
                    {typeof point.value === 'number' ? `${point.value.toFixed(0)} W` : String(point.value ?? '—')}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* Temps réel de la station (agrégé) */}
      {stationLive && stationLive.points.length > 0 ? (
        <Card COLORS={COLORS} title="Temps réel centrale (/station/latest)">
          {stationLive.points.map((point, index) => (
            <View key={`${point.key}-${index}`} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
              <Text style={{ color: COLORS.muted, fontSize: 11 }}>{point.name || point.key}</Text>
              <Text style={{ color: COLORS.text, fontSize: 11, fontWeight: '600' }}>
                {point.value === null ? '—' : typeof point.value === 'number'
                  ? point.value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
                  : point.value}
                {point.unit ? ` ${point.unit}` : ''}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Historique multi-granularité */}
      <Card COLORS={COLORS} title="Historique (/device/history)">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([
            { key: 'day', label: 'Journée' },
            { key: 'month', label: 'Mois' },
            { key: 'year', label: 'Année' },
          ] as { key: HistoryMode; label: string }[]).map((mode) => (
            <View key={mode.key} style={{ flex: 1 }}>
              <Button
                COLORS={COLORS}
                label={mode.label}
                variant={historyMode === mode.key ? 'primary' : 'outline'}
                small
                onPress={() => setHistoryMode(mode.key)}
              />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Button
            COLORS={COLORS}
            label="‹"
            variant="outline"
            small
            onPress={() =>
              setHistoryAnchor((prev) => {
                const next = new Date(prev);
                if (historyMode === 'day') next.setDate(next.getDate() - 1);
                else if (historyMode === 'month') next.setMonth(next.getMonth() - 1);
                else next.setFullYear(next.getFullYear() - 1);
                return next;
              })
            }
          />
          <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: '600', flex: 1, textAlign: 'center' }}>
            {historyMode === 'day'
              ? historyAnchor.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
              : historyMode === 'month'
                ? historyAnchor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                : String(historyAnchor.getFullYear())}
          </Text>
          <Button
            COLORS={COLORS}
            label="›"
            variant="outline"
            small
            disabled={
              historyMode === 'day'
                ? deyeDateForGranularity(historyAnchor, 1) >= deyeDateForGranularity(new Date(), 1)
                : historyMode === 'month'
                  ? deyeDateForGranularity(historyAnchor, 3) >= deyeDateForGranularity(new Date(), 3)
                  : historyAnchor.getFullYear() >= new Date().getFullYear()
            }
            onPress={() =>
              setHistoryAnchor((prev) => {
                const next = new Date(prev);
                if (historyMode === 'day') next.setDate(next.getDate() + 1);
                else if (historyMode === 'month') next.setMonth(next.getMonth() + 1);
                else next.setFullYear(next.getFullYear() + 1);
                return next;
              })
            }
          />
        </View>
        {history.length === 0 ? (
          <Text style={{ color: COLORS.muted, textAlign: 'center', paddingVertical: 14 }}>
            Aucune donnée pour cette granularité.
          </Text>
        ) : (
          <LineChartCard
            COLORS={COLORS}
            title={historyMode === 'day' ? 'Courbes de la journée (kW)' : historyMode === 'month' ? 'Statistiques du mois (kWh)' : 'Statistiques de l’année (kWh)'}
            labels={historyLabels}
            height={230}
            yUnit={historyMode === 'day' ? ' kW' : ' kWh'}
            series={[
              pickSeries(['TotalPVPower', 'DCPowerPV1', 'DCPowerPV2', 'pvPower'], 'PV', COLORS.accentProduction),
              pickSeries(['TotalLoadPower', 'LoadPower', 'UPSLoadPower'], 'Charges', COLORS.accentConsumption),
              pickSeries(['TotalGridPower', 'GridPower'], 'Réseau', COLORS.primary),
              pickSeries(['BatteryPower'], 'Batterie', COLORS.accentBattery),
              pickSeries(['SOC'], 'SOC %', COLORS.warning),
            ]}
          />
        )}
        {measurePoints.length > 0 ? (
          <Text style={{ color: COLORS.muted, fontSize: 10, marginTop: 6 }}>
            {measurePoints.length} points de mesure disponibles (/device/measurePoints)
          </Text>
        ) : null}
      </Card>

      {/* Contrôle & stratégies */}
      <Card COLORS={COLORS} title="Contrôle de l'onduleur">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([
            { key: 'strategy', label: 'Stratégies' },
            { key: 'tou', label: 'TOU' },
            { key: 'mode', label: 'Modes' },
            { key: 'power', label: 'Puissances' },
          ] as { key: ControlTab; label: string }[]).map((tab) => (
            <View key={tab.key} style={{ flex: 1 }}>
              <Button
                COLORS={COLORS}
                label={tab.label}
                variant={controlTab === tab.key ? 'primary' : 'outline'}
                small
                onPress={() => setControlTab(tab.key)}
              />
            </View>
          ))}
        </View>

        {controlTab === 'strategy' ? (
          <View style={{ marginTop: 10, gap: 8 }}>
            {strategyOptions.map((strategy) => (
              <Button
                key={strategy.kind}
                COLORS={COLORS}
                label={`${strategy.label} — ${strategy.description}`}
                variant="outline"
                small
                onPress={() =>
                  void runControl(
                    () => deyeApplyStrategy(credentials, deviceSn, strategy.kind),
                    `Stratégie ${strategy.label}`,
                  )
                }
              />
            ))}
          </View>
        ) : null}

        {controlTab === 'tou' ? (
          <View style={{ marginTop: 10, gap: 8 }}>
            {touEditable.length === 0 ? (
              <Text style={{ color: COLORS.muted, fontSize: 11 }}>
                Aucun programme TOU lu — utilisez une stratégie pour en écrire un.
              </Text>
            ) : (
              <>
                <View style={{ borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', paddingVertical: 5 }}>
                    {['Créneau', 'Réseau', 'Solaire', 'SOC'].map((header) => (
                      <Text key={header} style={{ flex: 1, color: COLORS.muted, fontSize: 10, fontWeight: '600', textAlign: 'center' }}>
                        {header}
                      </Text>
                    ))}
                  </View>
                  {touEditable.map((slot, index) => (
                    <View key={index} style={{ flexDirection: 'row', paddingVertical: 5, borderTopWidth: 1, borderTopColor: COLORS.border }}>
                      <Text style={{ flex: 1, color: COLORS.text, fontSize: 10, textAlign: 'center' }}>{slot.time}</Text>
                      <Text style={{ flex: 1, fontSize: 10, textAlign: 'center', color: slot.enableGridCharge ? COLORS.success : COLORS.muted }}>
                        {slot.enableGridCharge ? 'Oui' : 'Non'}
                      </Text>
                      <Text style={{ flex: 1, fontSize: 10, textAlign: 'center', color: slot.enableGeneration ? COLORS.success : COLORS.muted }}>
                        {slot.enableGeneration ? 'Oui' : 'Non'}
                      </Text>
                      <Text style={{ flex: 1, color: COLORS.text, fontSize: 10, textAlign: 'center' }}>
                        {slot.soc !== null ? `${slot.soc}%` : '—'}
                      </Text>
                    </View>
                  ))}
                </View>
                <Button
                  COLORS={COLORS}
                  label="Réécrire ces programmes (POST /order/sys/tou/update)"
                  variant="outline"
                  small
                  onPress={() => void runControl(() => deyeUpdateTou(credentials, deviceSn, touEditable), 'Mise à jour TOU')}
                />
              </>
            )}
          </View>
        ) : null}

        {controlTab === 'mode' ? (
          <View style={{ marginTop: 10, gap: 8 }}>
            {([
              { mode: 'SELLING_FIRST' as DeyeWorkMode, label: 'Vente prioritaire' },
              { mode: 'ZERO_EXPORT_TO_LOAD' as DeyeWorkMode, label: 'Zéro export → charges' },
              { mode: 'ZERO_EXPORT_TO_CT' as DeyeWorkMode, label: 'Zéro export → CT' },
            ]).map((option) => (
              <Button
                key={option.mode}
                COLORS={COLORS}
                label={`workMode = ${option.mode} (${option.label})`}
                variant="outline"
                small
                onPress={() => void runControl(() => deyeUpdateWorkMode(credentials, deviceSn, option.mode), `workMode ${option.mode}`)}
              />
            ))}
            {([
              { pattern: 'BATTERY_FIRST' as DeyeEnergyPattern, label: 'Batterie en priorité' },
              { pattern: 'LOAD_FIRST' as DeyeEnergyPattern, label: 'Charges en priorité' },
            ]).map((option) => (
              <Button
                key={option.pattern}
                COLORS={COLORS}
                label={`energyPattern = ${option.pattern} (${option.label})`}
                variant="outline"
                small
                onPress={() => void runControl(() => deyeUpdateEnergyPattern(credentials, deviceSn, option.pattern), `energyPattern ${option.pattern}`)}
              />
            ))}
          </View>
        ) : null}

        {controlTab === 'power' ? (
          <View style={{ marginTop: 10, gap: 8 }}>
            <Button
              COLORS={COLORS}
              label="MAX_SELL_POWER = 0 (bloquer la vente au réseau)"
              variant="outline"
              small
              onPress={() => void runControl(() => deyeUpdatePower(credentials, deviceSn, 'MAX_SELL_POWER', 0), 'MAX_SELL_POWER=0')}
            />
            <Button
              COLORS={COLORS}
              label="MAX_SOLAR_POWER = 0 (limiter le solaire)"
              variant="outline"
              small
              onPress={() => void runControl(() => deyeUpdatePower(credentials, deviceSn, 'MAX_SOLAR_POWER', 0), 'MAX_SOLAR_POWER=0')}
            />
            <Button
              COLORS={COLORS}
              label="Batterie : MAX_CHARGE_CURRENT = 0"
              variant="outline"
              small
              onPress={() => void runControl(() => deyeUpdateBatteryParameter(credentials, deviceSn, 'MAX_CHARGE_CURRENT', 0), 'MAX_CHARGE_CURRENT=0')}
            />
            <Button
              COLORS={COLORS}
                label="Effacement réseau : gridPeakShaving on (2000 W)"
              variant="outline"
              small
              onPress={() => void runControl(() => deyeUpdateGridPeakShaving(credentials, deviceSn, 'on', 2000), 'Grid peak shaving')}
            />
          </View>
        ) : null}
        <Text style={{ color: COLORS.muted, fontSize: 10, marginTop: 8 }}>
          Chaque commande renvoie un orderId vérifié via GET /order/&#123;orderId&#125;. Vérifiez le
          résultat sur l’onduleur avant toute nouvelle commande.
        </Text>
      </Card>

      {/* Tous les points de mesure bruts */}
      {live && live.points.length > 0 ? (
        <Card COLORS={COLORS} title={`Tous les points de mesure (${live.points.length})`}>
          <ScrollView style={{ maxHeight: 320 }}>
            {live.points.map((point, index) => (
              <View
                key={`${point.key}-${index}`}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 4,
                  borderBottomWidth: 1,
                  borderBottomColor: COLORS.border,
                }}
              >
                <Text style={{ color: COLORS.muted, fontSize: 11, flexShrink: 1 }}>
                  {point.name || point.key}
                </Text>
                <Text style={{ color: COLORS.text, fontSize: 11, fontWeight: '600' }}>
                  {point.value === null ? '—' : typeof point.value === 'number'
                    ? point.value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
                    : point.value}
                  {point.unit ? ` ${point.unit}` : ''}
                </Text>
              </View>
            ))}
          </ScrollView>
        </Card>
      ) : null}
    </Screen>
  );
}
