import type { AnyObject, DashboardSite, Monitoring } from './types';

/* ------------------------------------------------------------------ *
 * Lecteurs tolérants : chaque champ peut avoir plusieurs noms
 * (snake_case, camelCase, français) selon la version de l'API.
 * ------------------------------------------------------------------ */

export function isObject(value: unknown): value is AnyObject {
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

function getNumber(object: AnyObject, keys: string[]): number | null {
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

/* ------------------------------------------------------------------ *
 * Normalisation des sites
 * ------------------------------------------------------------------ */

const OFFLINE_STATUSES = [
  'offline',
  'disconnected',
  'inactif',
  'inactive',
  'hors ligne',
];

export function extractSites(payload: unknown, depth = 0): unknown[] {
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

export function normalizeSite(value: unknown): DashboardSite | null {
  if (!isObject(value)) {
    return null;
  }
  const id = getText(value, ['id', 'site_id', 'siteId', '_id']);
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
  const status = getText(value, ['status', 'site_status', 'state']) || 'unknown';
  const explicitOffline = getBoolean(
    value.is_offline ?? value.isOffline ?? value.offline,
  );
  const normalizedStatus = normalizeText(status);
  const isOffline =
    explicitOffline ?? OFFLINE_STATUSES.includes(normalizedStatus);
  return {
    id,
    name,
    location:
      getText(value, ['location', 'address', 'city', 'emplacement']) ||
      'Emplacement non renseigné',
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
    capacityKw: getNumber(value, [
      'capacity_kw',
      'capacityKw',
      'installed_capacity_kw',
      'installedCapacityKw',
    ]),
    latitude: getNumber(value, ['latitude', 'lat']),
    longitude: getNumber(value, ['longitude', 'lng', 'lon', 'long']),
    alertCount: getNumber(value, [
      'alert_count',
      'alertCount',
      'active_alerts',
      'activeAlerts',
    ]),
    monitoring: null,
    monitoringError: false,
  };
}

/* ------------------------------------------------------------------ *
 * Normalisation des mesures (monitoring)
 * ------------------------------------------------------------------ */

const METRIC_KEYS = [
  'production_kw',
  'productionKw',
  'total_production_kw',
  'solar_production_kw',
  'solarProductionKw',
  'consumption_kw',
  'consumptionKw',
  'total_consumption_kw',
  'load_kw',
  'loadKw',
  'battery_level_percent',
  'batteryLevelPercent',
  'avg_battery_level_percent',
  'battery_percent',
  'batteryPercent',
  'soc',
  'battery_voltage',
  'batteryVoltage',
  'avg_battery_voltage',
  'temperature_celsius',
  'temperatureCelsius',
  'avg_temperature_celsius',
  'temperature',
  'daily_production_kwh',
  'dailyProductionKwh',
  'daily_consumption_kwh',
  'dailyConsumptionKwh',
  'total_production_kwh',
  'totalProductionKwh',
  'battery_charge_kw',
  'batteryChargeKw',
  'battery_discharge_kw',
  'batteryDischargeKw',
  'pv_power_kw',
  'pvPowerKw',
  'generator_power_kw',
  'generatorPowerKw',
  'grid_power_kw',
  'gridPowerKw',
  'frequency_hz',
  'frequencyHz',
  'energy_source',
  'energySource',
  'grid_status',
  'gridStatus',
];

const MONITORING_WRAPPER_KEYS = [
  'data',
  'monitoring',
  'latest',
  'result',
  'measurement',
  'measurements',
  'metrics',
];

function findMonitoringObject(payload: unknown, depth = 0): AnyObject | null {
  if (!isObject(payload) || depth > 5) {
    return null;
  }
  if (METRIC_KEYS.some((key) => payload[key] !== undefined)) {
    return payload;
  }
  for (const key of MONITORING_WRAPPER_KEYS) {
    const nested = findMonitoringObject(payload[key], depth + 1);
    if (nested) {
      return nested;
    }
  }
  return null;
}

/** Extrait les données brutes Deye (raw_data) si présentes. */
function extractRawData(object: AnyObject): Record<string, number | string> | null {
  const candidate = object.raw_data ?? object.rawData;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const out: Record<string, number | string> = {};
  for (const [key, value] of Object.entries(candidate as Record<string, unknown>)) {
    if (typeof value === 'number' || typeof value === 'string') out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function normalizeMonitoring(payload: unknown): Monitoring | null {
  const object = findMonitoringObject(payload);
  if (!object) {
    return null;
  }
  const monitoring: Monitoring = {
    production_kw: getNumber(object, [
      'production_kw',
      'productionKw',
      'total_production_kw',
      'solar_production_kw',
      'solarProductionKw',
    ]),
    consumption_kw: getNumber(object, [
      'consumption_kw',
      'consumptionKw',
      'total_consumption_kw',
      'load_kw',
      'loadKw',
    ]),
    battery_level_percent: getNumber(object, [
      'battery_level_percent',
      'batteryLevelPercent',
      'avg_battery_level_percent',
      'battery_percent',
      'batteryPercent',
      'soc',
    ]),
    battery_voltage: getNumber(object, [
      'battery_voltage',
      'batteryVoltage',
      'avg_battery_voltage',
    ]),
    temperature_celsius: getNumber(object, [
      'temperature_celsius',
      'temperatureCelsius',
      'avg_temperature_celsius',
      'temperature',
    ]),
    grid_status:
      getText(object, ['grid_status', 'gridStatus', 'grid_state', 'gridState']) ||
      null,
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
    total_production_kwh: getNumber(object, [
      'total_production_kwh',
      'totalProductionKwh',
    ]),
    battery_charge_kw: getNumber(object, ['battery_charge_kw', 'batteryChargeKw']),
    battery_discharge_kw: getNumber(object, ['battery_discharge_kw', 'batteryDischargeKw']),
    pv_power_kw: getNumber(object, ['pv_power_kw', 'pvPowerKw']),
    generator_power_kw: getNumber(object, ['generator_power_kw', 'generatorPowerKw']),
    grid_power_kw: getNumber(object, ['grid_power_kw', 'gridPowerKw']),
    frequency_hz: getNumber(object, ['frequency_hz', 'frequencyHz']),
    energy_source: getText(object, ['energy_source', 'energySource']) || null,
    timestamp:
      getText(object, [
        'timestamp',
        'created_at',
        'createdAt',
        'updated_at',
        'updatedAt',
      ]) || null,
    raw_data: extractRawData(object),
  };
  const hasData = (
    [
      monitoring.production_kw,
      monitoring.consumption_kw,
      monitoring.battery_level_percent,
      monitoring.battery_voltage,
      monitoring.temperature_celsius,
      monitoring.daily_production_kwh,
      monitoring.daily_consumption_kwh,
      monitoring.total_production_kwh,
      monitoring.battery_charge_kw,
      monitoring.battery_discharge_kw,
      monitoring.pv_power_kw,
      monitoring.generator_power_kw,
      monitoring.grid_power_kw,
      monitoring.frequency_hz,
    ] as const
  ).some((value) => value !== null);
  return hasData || monitoring.grid_status ? monitoring : null;
}

/* ------------------------------------------------------------------ *
 * Formatage affiché
 * ------------------------------------------------------------------ */

export function formatMetric(
  value: number | null | undefined,
  decimals = 2,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  return value.toLocaleString('fr-FR', {
    maximumFractionDigits: decimals,
  });
}

const CONNECTED_STATUSES = ['connected', 'connecte', 'online'];
const DISCONNECTED_STATUSES = ['disconnected', 'deconnecte', 'offline'];

export function getGridStatus(value: string | null): string {
  if (!value) return '—';
  const normalized = normalizeText(value);
  if (CONNECTED_STATUSES.includes(normalized)) {
    return 'Connecté';
  }
  if (DISCONNECTED_STATUSES.includes(normalized)) {
    return 'Déconnecté';
  }
  return value;
}
