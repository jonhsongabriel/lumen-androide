/**
 * Client API LUMEN complet — portage 1:1 du client Web
 * (Lumensolaire/src/services/api.ts) vers React Native.
 * S'appuie sur apiRequest (src/services/api.ts) pour le transport.
 */
import { apiRequest } from './api';

export type Site = {
  id: string;
  name: string;
  location: string;
  status: string;
  is_offline?: boolean;
  system_type?: string;
  capacity_kw?: number | null;
  installation_date?: string | null;
  last_communication?: string | null;
  serial_number?: string | null;
  scada_enabled?: boolean;
  scada_protocol?: string | null;
  wifi_ssid?: string | null;
  monitor_type?: string | null;
  monitor_model?: string | null;
  equipment_list?: Equipment[];
  description?: string | null;
  created_at?: string;
};

export type Equipment = {
  type: string;
  brand: string;
  model: string;
  count?: number;
  capacity_w?: number;
};

export type MonitoringRow = {
  id: string;
  site_id: string;
  production_kw: number | null;
  consumption_kw: number | null;
  battery_level_percent: number | null;
  battery_voltage: number | null;
  temperature_celsius: number | null;
  grid_status: string | null;
  timestamp: string;
};

export type AlertItem = {
  id: string;
  site_id: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'new' | 'acknowledged' | 'resolved';
  title: string;
  message: string;
  threshold_value?: number | null;
  actual_value?: number | null;
  site_name?: string | null;
  site?: { name?: string } | null;
  component?: string | null;
  error_code?: string | null;
  created_at: string;
};

export type SiteConfiguration = {
  id: string;
  site_id: string;
  parameter_name: string;
  parameter_value: string;
  unit: string | null;
  description: string | null;
  min_value: number | null;
  max_value: number | null;
  updated_at?: string;
};

export type Device = {
  id: string;
  device_name: string | null;
  serial_number: string;
  device_type: string;
  password?: string | null;
  created_at?: string;
};

export type LumenUserRow = {
  id: string;
  username: string;
  email: string | null;
  full_name?: string | null;
  role: string;
  two_factor_enabled?: boolean;
  created_at?: string;
};

export type SiteCompareRow = {
  id: string;
  name: string;
  location: string | null;
  status: string;
  last_communication: string | null;
  is_offline: boolean;
  today_production_kwh: number;
  active_alerts: number;
  critical_alerts: number;
};

export type AuditRow = {
  id: string;
  user_id: string;
  site_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
  username?: string | null;
};

/* ------------------------------------------------------------------ */
/* Sites                                                               */
/* ------------------------------------------------------------------ */
export const sitesApi = {
  getAll: () => apiRequest<unknown>('sites'),
  create: (data: Record<string, unknown>) =>
    apiRequest<unknown>('sites', { method: 'POST', body: data }),
  compare: () => apiRequest<unknown>('sites/compare'),
};

/* ------------------------------------------------------------------ */
/* Monitoring                                                          */
/* ------------------------------------------------------------------ */
export const monitoringApi = {
  /** Relevés bruts d'un site sur une période (bornes ISO). */
  getBySite: (
    siteId: string,
    limit = 500,
    offset = 0,
    deviceId?: string,
    startDate?: string,
    endDate?: string,
    token?: string,
  ) => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (deviceId) params.set('device_id', deviceId);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    return apiRequest<unknown>(
      `monitoring/site/${encodeURIComponent(siteId)}?${params.toString()}`,
      { token },
    );
  },
  getLatest: (siteId: string, deviceId?: string, token?: string) => {
    const params = new URLSearchParams();
    if (deviceId) params.set('device_id', deviceId);
    const query = params.toString();
    return apiRequest<unknown>(
      `monitoring/site/${encodeURIComponent(siteId)}/latest${query ? `?${query}` : ''}`,
      { token },
    );
  },
  getDevicesLatest: (siteId: string, token?: string) =>
    apiRequest<unknown>(
      `monitoring/site/${encodeURIComponent(siteId)}/devices-latest`,
      { token },
    ),
  getTotal: (siteId: string, token?: string) =>
    apiRequest<unknown>(
      `monitoring/site/${encodeURIComponent(siteId)}/total`,
      { token },
    ),
  getEnergyBreakdown: (
    siteId: string,
    startDate: string,
    endDate: string,
    bucket: 'day' | 'month' | 'year',
    deviceId?: string,
    token?: string,
  ) => {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      bucket,
    });
    if (deviceId) params.set('device_id', deviceId);
    return apiRequest<unknown>(
      `monitoring/site/${encodeURIComponent(siteId)}/energy-breakdown?${params.toString()}`,
      { token },
    );
  },
};

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */
export const alertsApi = {
  getAll: (siteId?: string, status?: string, severity?: string) => {
    const params = new URLSearchParams();
    if (siteId) params.set('site_id', siteId);
    if (status) params.set('status', status);
    if (severity) params.set('severity', severity);
    const qs = params.toString();
    return apiRequest<unknown>(`alerts${qs ? `?${qs}` : ''}`);
  },
  acknowledge: (id: string) =>
    apiRequest<unknown>(`alerts/${id}/acknowledge`, { method: 'PATCH' }),
  resolve: (id: string) =>
    apiRequest<unknown>(`alerts/${id}/resolve`, { method: 'PATCH' }),
};

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */
export const usersApi = {
  getAll: () => apiRequest<unknown>('users'),
  updateRole: (id: string, role: string) =>
    apiRequest<unknown>(`users/${id}/role`, {
      method: 'PATCH',
      body: { role },
    }),
  getSites: (id: string) => apiRequest<unknown>(`users/${id}/sites`),
  setSites: (id: string, siteIds: string[]) =>
    apiRequest<unknown>(`users/${id}/sites`, {
      method: 'PUT',
      body: { site_ids: siteIds },
    }),
};

/* ------------------------------------------------------------------ */
/* Configurations                                                      */
/* ------------------------------------------------------------------ */
export const configurationsApi = {
  getBySite: (siteId: string) =>
    apiRequest<unknown>(`configurations/site/${encodeURIComponent(siteId)}`),
  update: (id: string, value: string) =>
    apiRequest<unknown>(`configurations/${id}`, {
      method: 'PATCH',
      body: { value },
    }),
};

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */
export const auditApi = {
  getAll: (siteId?: string, limit = 100) => {
    const params = new URLSearchParams();
    if (siteId) params.set('site_id', siteId);
    params.set('limit', String(limit));
    return apiRequest<unknown>(`audit?${params.toString()}`);
  },
};

/* ------------------------------------------------------------------ */
/* Appareils SCADA                                                     */
/* ------------------------------------------------------------------ */
export const devicesApi = {
  getBySite: (siteId: string, token?: string) =>
    apiRequest<unknown>(`devices/site/${encodeURIComponent(siteId)}`, { token }),
  add: (
    siteId: string,
    data: {
      serial_number: string;
      device_name?: string;
      password?: string;
      device_type?: string;
    },
  ) =>
    apiRequest<unknown>(`devices/site/${encodeURIComponent(siteId)}`, {
      method: 'POST',
      body: data,
    }),
  remove: (id: string) => apiRequest<unknown>(`devices/${id}`, { method: 'DELETE' }),
};

/* ------------------------------------------------------------------ */
/* Utilitaires d'extraction de listes                                  */
/* ------------------------------------------------------------------ */
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Extrait un tableau d'un payload API (wrapper data/items/results éventuel). */
export function extractArray(payload: unknown, depth = 0): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(isObject);
  }
  if (!isObject(payload) || depth > 5) return [];
  for (const key of ['data', 'items', 'results', 'sites', 'users', 'alerts', 'devices', 'configurations', 'logs', 'message']) {
    const child: unknown = payload[key];
    if (child !== undefined && child !== payload) {
      const result = extractArray(child, depth + 1);
      if (result.length > 0 || Array.isArray(child)) return result;
    }
  }
  return [];
}

/** Requête authentifiée qui renvoie toujours un tableau d'objets. */
export async function apiList(
  path: string,
  token: string,
): Promise<Record<string, unknown>[]> {
  const response = await apiRequest<unknown>(path, { token });
  return extractArray(response);
}
