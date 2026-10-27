// Runtime validation coverage for monitoring measurements and aggregated site readings.
import { describe, expect, it } from 'vitest';
import { normalizeMonitoring, normalizeSite } from './normalize';

describe('normalizeMonitoring', () => {
  it('normalizes a single latest monitoring reading', () => {
    expect(normalizeMonitoring({
      production_kw: '2.5',
      consumption_kw: 1.2,
      battery_level_percent: '84',
      battery_charge_kw: '1.1',
      pv_power_kw: '2.4',
      daily_production_kwh: '8.7',
      energy_source: 'Solar',
      timestamp: '2026-04-05T10:00:00.000Z',
    })).toMatchObject({
      production_kw: 2.5,
      consumption_kw: 1.2,
      battery_level_percent: 84,
      battery_charge_kw: 1.1,
      pv_power_kw: 2.4,
      daily_production_kwh: 8.7,
      energy_source: 'Solar',
      timestamp: '2026-04-05T10:00:00.000Z',
    });

  });

  it('normalizes the backend aggregated site totals', () => {
    expect(normalizeMonitoring({
      total_production_kw: '5.75',
      total_consumption_kw: '3.1',
      avg_battery_level_percent: '76',
      avg_battery_voltage: '51.2',
      avg_temperature_celsius: '29.5',
    })).toMatchObject({
      production_kw: 5.75,
      consumption_kw: 3.1,
      battery_level_percent: 76,
      battery_voltage: 51.2,
      temperature_celsius: 29.5,
    });
  });

  describe('normalizeSite', () => {
    it('recognizes camel-case offline flags and disconnected status', () => {
      expect(normalizeSite({
        id: 'site-1',
        name: 'Centrale',
        isOffline: true,
      })).toMatchObject({ id: 'site-1', isOffline: true });

      expect(normalizeSite({
        id: 'site-2',
        name: 'Site déconnecté',
        status: 'disconnected',
      })).toMatchObject({ id: 'site-2', isOffline: true });
    });
  });
});
