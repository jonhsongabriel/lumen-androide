import type { LumenPalette } from '@/constants/lumen-colors';

export type AnyObject = Record<string, unknown>;

export type Monitoring = {
  production_kw: number | null;
  consumption_kw: number | null;
  battery_level_percent: number | null;
  battery_voltage: number | null;
  temperature_celsius: number | null;
  grid_status: string | null;
  daily_production_kwh: number | null;
  daily_consumption_kwh: number | null;
  total_production_kwh: number | null;
  battery_charge_kw: number | null;
  battery_discharge_kw: number | null;
  pv_power_kw: number | null;
  generator_power_kw: number | null;
  grid_power_kw: number | null;
  frequency_hz: number | null;
  energy_source: string | null;
  timestamp: string | null;
  /** Données brutes Deye (raw_data) pour le panneau "Détails techniques avancés". */
  raw_data: Record<string, number | string> | null;
};

export type DashboardSite = {
  id: string;
  name: string;
  location: string;
  type: string;
  status: string;
  isOffline: boolean;
  capacityKw: number | null;
  latitude: number | null;
  longitude: number | null;
  alertCount: number | null;
  monitoring: Monitoring | null;
  monitoringError: boolean;
};

export type SiteStatus = {
  label: string;
  color: keyof LumenPalette;
};
