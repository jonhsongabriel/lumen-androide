/**
 * Client API DeyeCloud v1.0 — conforme à l'OpenAPI officielle
 * (https://developer.deyecloud.com/api et le dépôt d'exemples
 * DeyeCloudDevelopers/deye-openapi-client-sample-code).
 *
 * Base URL : https://eu1-developer.deyecloud.com/v1.0 (EU : Europe/Afrique/Asie)
 *            https://us1-developer.deyecloud.com/v1.0 (US : Amériques)
 *            https://india-developer.deyecloud.com/v1.0 (Inde)
 * Auth     : header "Authorization: bearer <accessToken>" (minuscule, doc officielle)
 *
 * Endpoints couverts :
 *   POST /account/token                    → accessToken (SHA-256 du mot de passe)
 *   POST /station/list                     → centrales paginées
 *   POST /station/listWithDevice           → centrales + appareils (deviceType: INVERTER…)
 *   POST /station/device                   → appareils par stationIds
 *   POST /station/latest                   → temps réel d'une centrale (stationId)
 *   POST /station/history                  → historique centrale (granularity 1..4)
 *   POST /device/list                      → appareils paginés
 *   POST /device/latest                    → temps réel par SN (batch ≤ 10)
 *   POST /device/measurePoints             → liste des points de mesure d'un SN
 *   POST /device/history                   → historique appareil (granularity + measurePoints)
 *   GET  /order/{orderId}                  → résultat d'une commande de contrôle
 *   POST /order/sys/tou/update             → écriture des programmes Time-of-Use
 *   POST /order/sys/workMode/update        → mode de fonctionnement (SELLING_FIRST…)
 *   POST /order/sys/energyPattern/update   → priorité batterie/charges
 *   POST /order/sys/power/update           → MAX_SELL_POWER / MAX_SOLAR_POWER
 *   POST /order/battery/parameter/update   → courants de charge/décharge max
 *   POST /order/gridPeakShaving/control    → effacement réseau (on/off + power)
 *   POST /strategy/dynamicControl          → stratégies (Self consumption, Fully charge…)
 */

export type DeyeRegion = 'EU' | 'US' | 'INDIA';

export const DEYE_BASE_URLS: Record<DeyeRegion, string> = {
  EU: 'https://eu1-developer.deyecloud.com/v1.0',
  US: 'https://us1-developer.deyecloud.com/v1.0',
  INDIA: 'https://india-developer.deyecloud.com/v1.0',
};

export type DeyeCredentials = {
  region: DeyeRegion;
  appId: string;
  appSecret: string;
  email: string;
  password: string;
  /** Pour les comptes professionnels (business member) — sinon omis. */
  companyId?: string;
};

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type DeyeDeviceType =
  | 'INVERTER' | 'MICRO_INVERTER' | 'COLLECTOR' | 'BATTERY'
  | 'MECD' | 'METER' | 'RELAY_BOX' | 'OPTIMIZER' | 'PV_MODULE';

export type DeyeDevice = {
  deviceId: number | null;
  sn: string;
  deviceType?: string;
  modelName?: string;
  status?: string | number | null;
  stationId?: string;
};

export type DeyeStation = {
  stationId: string;
  stationName?: string;
  stationUid?: string;
  capacity?: string | number | null;
  country?: string;
  city?: string;
  address?: string;
  createTime?: string;
  deviceList?: DeyeDevice[];
};

export type DeyeDataPoint = {
  key: string;
  name?: string;
  value: number | string | null;
  unit?: string | null;
};

export type DeyeDeviceData = {
  deviceId: string | null;
  sn: string;
  time: string | null;
  points: DeyeDataPoint[];
  /** Map clé → valeur (accès direct type raw_data LUMEN). */
  map: Record<string, number | string>;
};

export type DeyeMeasurePoint = {
  key: string;
  name?: string;
  unit?: string | null;
};

export type DeyeHistoryRow = {
  time: string;
  values: Record<string, number | string>;
};

/** Granularité /device/history et /station/history. */
export type DeyeGranularity = 1 | 2 | 3 | 4;

export type DeyeTouSlot = {
  time: string;
  enableGridCharge: boolean;
  enableGeneration: boolean;
  power: number | null;
  soc: number | null;
};

export type DeyeWorkMode = 'SELLING_FIRST' | 'ZERO_EXPORT_TO_LOAD' | 'ZERO_EXPORT_TO_CT';
export type DeyeEnergyPattern = 'BATTERY_FIRST' | 'LOAD_FIRST';
export type DeyePowerType = 'MAX_SELL_POWER' | 'MAX_SOLAR_POWER';
export type DeyeBatteryParameterType = 'MAX_CHARGE_CURRENT' | 'MAX_DISCHARGE_CURRENT';

export type DeyeStrategyKind =
  | 'SELF_CONSUMPTION' | 'FULLY_CHARGE' | 'FULLY_FEEDIN_GRID' | 'IDLE';

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

type AuthState = { credentials: DeyeCredentials; token: string; expiryEpochSeconds: number };
let session: AuthState | null = null;

export function setDeyeSession(auth: AuthState | null): void {
  session = auth;
}

export function getDeyeSession(): AuthState | null {
  return session;
}

export function isDeyeSessionValid(): boolean {
  return !!session && session.expiryEpochSeconds > Date.now() / 1000;
}

async function deyePost<T>(path: string, token: string | null, body?: unknown): Promise<T> {
  const response = await fetch(`${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error('DeyeCloud : réponse invalide du serveur.');
  }
  if (!response.ok) {
    const payload = data as Record<string, unknown> | null;
    const message =
      payload && typeof payload.msg === 'string'
        ? payload.msg
        : `Erreur DeyeCloud HTTP ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

async function deyeGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(path, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `bearer ${token}`,
    },
  });
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error('DeyeCloud : réponse invalide du serveur.');
  }
  if (!response.ok) throw new Error(`Erreur DeyeCloud HTTP ${response.status}`);
  return data as T;
}

/** Enveloppe standard : { errorCode: 0, errorMsg: "Success", data | result }. */
export function deyePayload<T>(response: Record<string, unknown> | null): T {
  const code = response?.errorCode;
  if (typeof code === 'number' && code !== 0) {
    throw new Error(`DeyeCloud : ${String(response?.errorMsg ?? 'erreur inconnue')} (${code})`);
  }
  return (response?.data ?? response?.result ?? response) as T;
}

/* ------------------------------------------------------------------ */
/* Authentification — POST /account/token                              */
/* ------------------------------------------------------------------ */

/**
 * Le mot de passe est transmis en SHA-256 minuscule (exigence de l'API).
 * email / mobile / username : un des trois est requis (ici : email).
 * companyId fourni → token « business member », sinon « personal user ».
 */
export async function deyeLogin(credentials: DeyeCredentials): Promise<string> {
  const hashed = sha256HexSync(credentials.password).toLowerCase();
  const body: Record<string, unknown> = {
    appSecret: credentials.appSecret,
    email: credentials.email,
    password: hashed,
  };
  if (credentials.companyId) body.companyId = credentials.companyId;
  const response = await deyePost<{ accessToken?: string; data?: { accessToken?: string } }>(
    `${DEYE_BASE_URLS[credentials.region]}/account/token?appId=${encodeURIComponent(credentials.appId)}`,
    null,
    body,
  );
  const token = response?.accessToken ?? response?.data?.accessToken;
  if (!token) throw new Error('DeyeCloud : identifiants refusés (aucun token reçu).');
  session = { credentials, token, expiryEpochSeconds: Date.now() / 1000 + 3600 };
  return token;
}

async function withAuth<T>(
  credentials: DeyeCredentials,
  path: string,
  body: unknown,
  method: 'POST' | 'GET' = 'POST',
): Promise<T> {
  const base = DEYE_BASE_URLS[credentials.region];
  const run = (token: string) =>
    method === 'GET' ? deyeGet<T>(`${base}${path}`, token) : deyePost<T>(`${base}${path}`, token, body);
  if (!session || session.expiryEpochSeconds <= Date.now() / 1000) {
    await deyeLogin(credentials);
  }
  try {
    return await run(session!.token);
  } catch (err) {
    if (err instanceof Error && /401|token|unauthor/i.test(err.message)) {
      await deyeLogin(credentials);
      return run(session!.token);
    }
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Stations                                                            */
/* ------------------------------------------------------------------ */

function text(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function normalizeDevice(row: Record<string, unknown>): DeyeDevice {
  const id = row.deviceId ?? row.device_id ?? row.id;
  return {
    deviceId: typeof id === 'number' ? id : Number.isFinite(Number(id)) ? Number(id) : null,
    sn: text(row, ['deviceSn', 'sn', 'deviceSN', 'serialNumber', 'serial_number']),
    deviceType: text(row, ['deviceType', 'device_type']) || undefined,
    modelName: text(row, ['modelName', 'model']) || undefined,
    status: (row.status as string | number | undefined) ?? null,
    stationId: text(row, ['stationId', 'station_id']),
  };
}

function normalizeStation(row: Record<string, unknown>): DeyeStation {
  const rawDevices = Array.isArray(row.deviceList) ? row.deviceList : [];
  return {
    stationId: text(row, ['stationId', 'id', 'station_id']),
    stationName: text(row, ['stationName', 'name', 'station_name']) || 'Centrale sans nom',
    stationUid: text(row, ['stationUid', 'uid']),
    capacity: (row.capacity as string | number | undefined) ?? null,
    country: text(row, ['country']),
    city: text(row, ['city']),
    address: text(row, ['address']),
    createTime: text(row, ['createTime', 'create_time']),
    deviceList: rawDevices
      .filter((d): d is Record<string, unknown> => typeof d === 'object' && d !== null)
      .map(normalizeDevice),
  };
}

/** POST /station/list — centrales paginées. */
export async function deyeFetchStationList(
  credentials: DeyeCredentials,
  page = 1,
  size = 100,
): Promise<DeyeStation[]> {
  const response = await withAuth<Record<string, unknown>>(credentials, '/station/list', { page, size });
  const payload = deyePayload<Record<string, unknown>>(response) ?? response;
  const list = (payload?.stationList ?? payload?.data ?? (response as { stationList?: unknown[] }).stationList ?? []) as unknown[];
  return (Array.isArray(list) ? list : [])
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .map(normalizeStation);
}

/**
 * POST /station/listWithDevice — centrales + appareils.
 * deviceType optionnel : INVERTER, MICRO_INVERTER, COLLECTOR, BATTERY, MECD,
 * METER, RELAY_BOX, OPTIMIZER, PV_MODULE.
 */
export async function deyeFetchStations(
  credentials: DeyeCredentials,
  page = 1,
  size = 100,
  deviceType?: DeyeDeviceType,
): Promise<DeyeStation[]> {
  const body: Record<string, unknown> = { page, size };
  if (deviceType) body.deviceType = deviceType;
  const response = await withAuth<Record<string, unknown>>(credentials, '/station/listWithDevice', body);
  const payload = deyePayload<Record<string, unknown>>(response) ?? response;
  const list = (payload?.stationList ?? (response as { stationList?: unknown[] }).stationList ?? []) as unknown[];
  return (Array.isArray(list) ? list : [])
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .map(normalizeStation);
}

/** POST /station/device — appareils rattachés à un ensemble de stations. */
export async function deyeFetchStationDevices(
  credentials: DeyeCredentials,
  stationIds: (string | number)[],
  page = 1,
  size = 100,
): Promise<DeyeDevice[]> {
  const response = await withAuth<Record<string, unknown>>(credentials, '/station/device', {
    page,
    size,
    stationIds: stationIds.map((id) => (Number.isFinite(Number(id)) ? Number(id) : id)),
  });
  const payload = deyePayload<Record<string, unknown>>(response) ?? response;
  const list = (payload?.deviceList ?? payload?.data ?? []) as unknown[];
  return (Array.isArray(list) ? list : [])
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .map(normalizeDevice);
}

/** POST /device/list — tous les appareils (business members surtout). */
export async function deyeFetchDeviceList(
  credentials: DeyeCredentials,
  page = 1,
  size = 100,
): Promise<DeyeDevice[]> {
  const response = await withAuth<Record<string, unknown>>(credentials, '/device/list', { page, size });
  const payload = deyePayload<Record<string, unknown>>(response) ?? response;
  const list = (payload?.deviceList ?? payload?.data ?? []) as unknown[];
  return (Array.isArray(list) ? list : [])
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .map(normalizeDevice);
}

export function isDeviceOnline(status: string | number | undefined | null): boolean {
  if (status === undefined || status === null || status === '') return true;
  const normalized = String(status).toLowerCase();
  return !(normalized === '0' || normalized === 'offline' || normalized === 'false');
}

/* ------------------------------------------------------------------ */
/* Temps réel                                                          */
/* ------------------------------------------------------------------ */

function toNumber(value: unknown): number | string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return null;
}

function parsePoints(rawList: unknown): { points: DeyeDataPoint[]; map: Record<string, number | string> } {
  const points: DeyeDataPoint[] = [];
  const map: Record<string, number | string> = {};
  const list = (Array.isArray(rawList) ? rawList : []) as unknown[];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const row = item as Record<string, unknown>;
    // Deux formes possibles : { key/name, value, unit } ou { clé: valeur }
    if ('value' in row || 'val' in row) {
      const key = text(row, ['key', 'variable', 'code', 'measurePointKey']) || text(row, ['name']);
      const value = toNumber('value' in row ? row.value : row.val);
      const unit = typeof row.unit === 'string' ? row.unit : null;
      if (key) {
        points.push({ key, name: typeof row.name === 'string' ? row.name : undefined, value, unit });
        if (value !== null) map[key] = value;
      }
    } else {
      for (const [key, value] of Object.entries(row)) {
        const normalized = toNumber(value);
        points.push({ key, value: normalized });
        if (normalized !== null) map[key] = normalized;
      }
    }
  }
  return { points, map };
}

/**
 * POST /device/latest — temps réel par SN, batch jusqu'à 10 appareils.
 * Réponse : deviceDataList: [{ deviceId, sn, time, dataList }] — les clés de
 * dataList sont les points de mesure (SOC, DCVoltagePV1, GridFrequency…).
 */
export async function deyeFetchLatest(
  credentials: DeyeCredentials,
  deviceSns: string[],
): Promise<DeyeDeviceData[]> {
  const response = await withAuth<Record<string, unknown>>(credentials, '/device/latest', {
    deviceList: deviceSns.slice(0, 10),
  });
  const payload = deyePayload<Record<string, unknown>>(response) ?? response;
  const root = (payload?.deviceDataList ?? (response as { deviceDataList?: unknown[] }).deviceDataList ?? []) as unknown[];
  return root
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => {
      const { points, map } = parsePoints(entry.dataList);
      return {
        deviceId: text(entry, ['deviceId', 'device_id']) || null,
        sn: text(entry, ['deviceSn', 'sn', 'deviceSN']),
        time: typeof entry.time === 'string' ? entry.time : null,
        points,
        map,
      };
    });
}

/**
 * POST /station/latest — agrégats temps réel d'une centrale entière
 * (production/consommation/batterie/réseau de la station).
 */
export async function deyeFetchStationLatest(
  credentials: DeyeCredentials,
  stationId: string,
): Promise<DeyeDeviceData | null> {
  const response = await withAuth<Record<string, unknown>>(credentials, '/station/latest', {
    stationId: Number.isFinite(Number(stationId)) ? Number(stationId) : stationId,
  });
  const payload = deyePayload<Record<string, unknown>>(response) ?? response;
  const entry = (payload?.dataList ?? payload) as Record<string, unknown> | undefined;
  if (!entry || typeof entry !== 'object') return null;
  const { points, map } = parsePoints(entry.dataList ?? [entry]);
  return {
    deviceId: null,
    sn: stationId,
    time: typeof entry.time === 'string' ? entry.time : null,
    points,
    map,
  };
}

/* ------------------------------------------------------------------ */
/* Points de mesure                                                    */
/* ------------------------------------------------------------------ */

/** POST /device/measurePoints — liste des variables disponibles pour un SN. */
export async function deyeFetchMeasurePoints(
  credentials: DeyeCredentials,
  deviceSn: string,
): Promise<DeyeMeasurePoint[]> {
  const response = await withAuth<Record<string, unknown>>(credentials, '/device/measurePoints', { deviceSn });
  const payload = deyePayload<Record<string, unknown>>(response) ?? response;
  const list = (payload?.measurePoints ?? payload?.dataList ?? payload?.list ?? []) as unknown[];
  return (Array.isArray(list) ? list : [])
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .map((row) => ({
      key: text(row, ['measurePointKey', 'key', 'variable', 'code']),
      name: typeof row.name === 'string' ? row.name : undefined,
      unit: typeof row.unit === 'string' ? row.unit : null,
    }));
}

/* ------------------------------------------------------------------ */
/* Historique                                                          */
/* ------------------------------------------------------------------ */

/**
 * POST /device/history — historique d'un appareil.
 *  - granularity 1 : courbe d'une journée (startAt 'yyyy-MM-dd'), measurePoints requis.
 *  - granularity 2 : stats journalières 'yyyy-MM-dd' → 'yyyy-MM-dd' (≤ 31 j).
 *  - granularity 3 : stats mensuelles 'yyyy-MM' → 'yyyy-MM' (≤ 12 mois).
 *  - granularity 4 : stats annuelles 'yyyy' → 'yyyy'.
 */
export async function deyeFetchDeviceHistory(
  credentials: DeyeCredentials,
  deviceSn: string,
  granularity: DeyeGranularity,
  startAt: string,
  endAt: string,
  measurePoints: string[],
): Promise<DeyeHistoryRow[]> {
  const body: Record<string, unknown> = { deviceSn, granularity, startAt, endAt };
  if (granularity === 1) body.measurePoints = measurePoints;
  const response = await withAuth<Record<string, unknown>>(credentials, '/device/history', body);
  const payload = deyePayload<Record<string, unknown>>(response) ?? response;
  return parseHistoryList(payload?.dataList ?? payload?.list ?? (response as { dataList?: unknown[] }).dataList);
}

/**
 * POST /station/history — historique d'une centrale.
 * granularity 1 → frame (puissances uniquement) ; 2 → jours ; 3 → mois ; 4 → années.
 */
export async function deyeFetchStationHistory(
  credentials: DeyeCredentials,
  stationId: string,
  granularity: DeyeGranularity,
  startAt: string,
  endAt: string,
): Promise<DeyeHistoryRow[]> {
  const response = await withAuth<Record<string, unknown>>(credentials, '/station/history', {
    stationId: Number.isFinite(Number(stationId)) ? Number(stationId) : stationId,
    granularity,
    startAt,
    endAt,
  });
  const payload = deyePayload<Record<string, unknown>>(response) ?? response;
  return parseHistoryList(payload?.dataList ?? payload?.list ?? (response as { dataList?: unknown[] }).dataList);
}

function parseHistoryList(list: unknown): DeyeHistoryRow[] {
  const rows = (Array.isArray(list) ? list : []) as unknown[];
  return rows
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .map((row) => {
      const { map } = parsePoints(row.dataList);
      const flat = { ...map };
      for (const [key, value] of Object.entries(row)) {
        if (['time', 'dataTimeStamp', 'data_time', 'dataList'].includes(key)) continue;
        const normalized = toNumber(value);
        if (normalized !== null) flat[key] = normalized;
      }
      return { time: text(row, ['time', 'dataTimeStamp', 'data_time']), values: flat };
    });
}

/* ------------------------------------------------------------------ */
/* Ordres de contrôle (Commissioning Operation Model)                  */
/* ------------------------------------------------------------------ */

/** GET /order/{orderId} — statut d'exécution d'une commande envoyée. */
export async function deyeFetchOrderStatus(
  credentials: DeyeCredentials,
  orderId: string,
): Promise<Record<string, unknown> | null> {
  const response = await withAuth<Record<string, unknown>>(
    credentials,
    `/order/${encodeURIComponent(orderId)}`,
    undefined,
    'GET',
  );
  return deyePayload<Record<string, unknown>>(response) ?? response;
}

function extractOrderId(response: unknown): string | null {
  const payload = (response ?? {}) as Record<string, unknown>;
  const candidates = [payload, (payload.data ?? {}) as Record<string, unknown>, (payload.result ?? {}) as Record<string, unknown>];
  for (const candidate of candidates) {
    const id = candidate.orderId ?? candidate.order_id ?? candidate.id;
    if (typeof id === 'string' && id) return id;
    if (typeof id === 'number') return String(id);
  }
  return null;
}

/** POST /order/sys/tou/update — écriture des 6 créneaux Time-of-Use. */
export async function deyeUpdateTou(
  credentials: DeyeCredentials,
  deviceSn: string,
  slots: DeyeTouSlot[],
  timeoutSeconds = 30,
): Promise<{ orderId: string | null }> {
  const response = await withAuth<Record<string, unknown>>(credentials, '/order/sys/tou/update', {
    deviceSn,
    timeUseSettingItems: slots.map((slot) => ({
      time: slot.time,
      enableGridCharge: slot.enableGridCharge,
      enableGeneration: slot.enableGeneration,
      ...(slot.power !== null ? { power: slot.power } : {}),
      ...(slot.soc !== null ? { soc: slot.soc } : {}),
    })),
    timeoutSeconds,
  });
  return { orderId: extractOrderId(response) };
}

/** POST /order/sys/workMode/update — SELLING_FIRST | ZERO_EXPORT_TO_LOAD | ZERO_EXPORT_TO_CT. */
export async function deyeUpdateWorkMode(
  credentials: DeyeCredentials,
  deviceSn: string,
  workMode: DeyeWorkMode,
): Promise<{ orderId: string | null }> {
  const response = await withAuth<Record<string, unknown>>(credentials, '/order/sys/workMode/update', {
    deviceSn,
    workMode,
  });
  return { orderId: extractOrderId(response) };
}

/** POST /order/sys/energyPattern/update — BATTERY_FIRST | LOAD_FIRST. */
export async function deyeUpdateEnergyPattern(
  credentials: DeyeCredentials,
  deviceSn: string,
  energyPattern: DeyeEnergyPattern,
): Promise<{ orderId: string | null }> {
  const response = await withAuth<Record<string, unknown>>(credentials, '/order/sys/energyPattern/update', {
    deviceSn,
    energyPattern,
  });
  return { orderId: extractOrderId(response) };
}

/** POST /order/sys/power/update — MAX_SELL_POWER ou MAX_SOLAR_POWER. */
export async function deyeUpdatePower(
  credentials: DeyeCredentials,
  deviceSn: string,
  powerType: DeyePowerType,
  value: number,
): Promise<{ orderId: string | null }> {
  const response = await withAuth<Record<string, unknown>>(credentials, '/order/sys/power/update', {
    deviceSn,
    powerType,
    value,
  });
  return { orderId: extractOrderId(response) };
}

/** POST /order/battery/parameter/update — MAX_CHARGE_CURRENT / MAX_DISCHARGE_CURRENT. */
export async function deyeUpdateBatteryParameter(
  credentials: DeyeCredentials,
  deviceSn: string,
  paramterType: DeyeBatteryParameterType,
  value: number,
): Promise<{ orderId: string | null }> {
  // « paramterType » (sic) : orthographe imposée par l'API Deye.
  const response = await withAuth<Record<string, unknown>>(credentials, '/order/battery/parameter/update', {
    deviceSn,
    paramterType,
    value,
  });
  return { orderId: extractOrderId(response) };
}

/** POST /order/gridPeakShaving/control — effacement réseau (limitation de la sortie). */
export async function deyeUpdateGridPeakShaving(
  credentials: DeyeCredentials,
  deviceSn: string,
  action: 'on' | 'off',
  power: number,
): Promise<{ orderId: string | null }> {
  const response = await withAuth<Record<string, unknown>>(credentials, '/order/gridPeakShaving/control', {
    deviceSn,
    action,
    power,
  });
  return { orderId: extractOrderId(response) };
}

/* ------------------------------------------------------------------ */
/* Stratégies (Strategy Dynamic Control)                               */
/* ------------------------------------------------------------------ */

const WEEK_DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

/**
 * POST /strategy/dynamicControl — applique une stratégie prédéfinie en un
 * seul appel (self consumption, fully charge, fully feed-in, idle).
 * Les champs non fournis conservent leur valeur précédente côté onduleur.
 */
export async function deyeApplyStrategy(
  credentials: DeyeCredentials,
  deviceSn: string,
  kind: DeyeStrategyKind,
  options: {
    soc?: number;
    power?: number;
    workMode?: DeyeWorkMode;
    touAction?: 'on' | 'off';
    solarSellAction?: 'on' | 'off';
    gridChargeAction?: 'on' | 'off';
    maxSellPower?: number;
    maxSolarPower?: number;
  } = {},
): Promise<{ orderId: string | null }> {
  const soc = options.soc ?? (kind === 'FULLY_CHARGE' ? 90 : 15);
  const power = options.power ?? 4000;
  const workMode = options.workMode ?? (kind === 'FULLY_FEEDIN_GRID' ? 'SELLING_FIRST' : 'ZERO_EXPORT_TO_CT');
  const slots: DeyeTouSlot[] = ['00:10', '02:10', '04:10', '15:10', '20:10', '23:10'].map((time) => ({
    time,
    enableGridCharge: options.gridChargeAction !== 'off',
    enableGeneration: true,
    power,
    soc,
  }));
  const body: Record<string, unknown> = {
    deviceSn,
    touAction: options.touAction ?? 'on',
    touDays: [...WEEK_DAYS],
    workMode,
    timeUseSettingItems: slots.map((slot) => ({
      time: slot.time,
      enableGridCharge: slot.enableGridCharge,
      enableGeneration: slot.enableGeneration,
      power: slot.power,
      soc: slot.soc,
    })),
  };
  if (options.solarSellAction) body.solarSellAction = options.solarSellAction;
  if (options.gridChargeAction) body.gridChargeAction = options.gridChargeAction;
  if (options.maxSellPower !== undefined) body.maxSellPower = options.maxSellPower;
  if (options.maxSolarPower !== undefined) body.maxSolarPower = options.maxSolarPower;
  const response = await withAuth<Record<string, unknown>>(credentials, '/strategy/dynamicControl', body);
  return { orderId: extractOrderId(response) };
}

/* ------------------------------------------------------------------ */
/* Agrégats dérivés (affichage)                                        */
/* ------------------------------------------------------------------ */

const NUM = (map: Record<string, number | string>, ...keys: string[]): number | null => {
  for (const key of keys) {
    const value = map[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

/** Résumé temps réel calculé depuis les points bruts d'un onduleur. */
export function summarizeDeviceData(data: DeyeDeviceData): DeyeRawSummary {
  return summarizeRawData(data.map);
}

/**
 * Résumé temps réel depuis une map de points bruts — accepte aussi bien les
 * données du cloud Deye que le champ raw_data renvoyé par le backend LUMEN
 * (mêmes clés : DCPowerPV1, TotalLoadPower, SOC, GridFrequency, Fault…).
 */
export type DeyeRawSummary = {
  pvPowerKw: number | null;
  loadPowerKw: number | null;
  gridPowerKw: number | null;
  batteryPowerKw: number | null;
  batterySoc: number | null;
  gridFrequency: number | null;
  fault: string | null;
};

export function summarizeRawData(map: Record<string, number | string>): DeyeRawSummary {
  const pvStrings = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    .map((i) => NUM(map, `DCPowerPV${i}`))
    .filter((v): v is number => v !== null);
  const pvPower =
    NUM(map, 'TotalPVPower', 'pvPower', 'PVPower') ??
    (pvStrings.length > 0 ? pvStrings.reduce((a, b) => a + b, 0) : null);
  const loadPower = NUM(map, 'TotalLoadPower', 'LoadPower', 'UPSLoadPower', 'homePower');
  const gridPower = NUM(map, 'TotalGridPower', 'GridPower', 'ExternalCT1Power');
  const batteryPower = NUM(map, 'BatteryPower', 'batteryPower');
  const soc = NUM(map, 'BMS_SOC', 'SOC', 'batterySOC', 'soc');
  const gridFrequency = NUM(map, 'GridFrequency', 'ACFrequency');
  const fault = map.Fault !== undefined ? String(map.Fault) : null;
  return {
    pvPowerKw: pvPower !== null ? pvPower / 1000 : null,
    loadPowerKw: loadPower !== null ? loadPower / 1000 : null,
    gridPowerKw: gridPower !== null ? gridPower / 1000 : null,
    batteryPowerKw: batteryPower !== null ? batteryPower / 1000 : null,
    batterySoc: soc,
    gridFrequency,
    fault,
  };
}
/** Format Deye des dates selon la granularité. */
export function deyeDateForGranularity(date: Date, granularity: DeyeGranularity): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  if (granularity === 4) return String(date.getFullYear());
  if (granularity === 3) return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/* ------------------------------------------------------------------ */
/* SHA-256 (JS pur, aucune dépendance native)                          */
/* ------------------------------------------------------------------ */

export function sha256HexSync(message: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  let bytes: number[];
  try {
    bytes = Array.from(new TextEncoder().encode(message));
  } catch {
    // Fallback RN : message ASCII attendu (mot de passe).
    bytes = [];
    for (let i = 0; i < message.length; i++) bytes.push(message.charCodeAt(i) & 0xff);
  }
  const l = bytes.length;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const bitLenHi = Math.floor((l * 8) / 4294967296);
  const bitLenLo = (l * 8) >>> 0;
  bytes.push((bitLenHi >>> 24) & 0xff, (bitLenHi >>> 16) & 0xff, (bitLenHi >>> 8) & 0xff, bitLenHi & 0xff);
  bytes.push((bitLenLo >>> 24) & 0xff, (bitLenLo >>> 16) & 0xff, (bitLenLo >>> 8) & 0xff, bitLenLo & 0xff);
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array<number>(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let block = 0; block < bytes.length; block += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] =
        ((bytes[block + i * 4] << 24) |
          (bytes[block + i * 4 + 1] << 16) |
          (bytes[block + i * 4 + 2] << 8) |
          bytes[block + i * 4 + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e;
      e = (d + temp1) >>> 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return H.map((x) => x.toString(16).padStart(8, '0')).join('');
}
