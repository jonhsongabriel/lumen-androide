
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { LumenUser } from '@/contexts/auth';
import type { DeyeCredentials } from '@/services/deye-api';

const TOKEN_KEY = 'lumen_token';
const USER_KEY = 'lumen_user';
const DEYE_KEY = 'lumen_deye_credentials';
const DEYE_CACHE_KEY = 'lumen_deye_cache';

/** Credentials DeyeCloud (région, appId, appSecret, email, mot de passe). */
export async function getDeyeCredentials(): Promise<DeyeCredentials | null> {
  try {
    const raw =
      Platform.OS === 'web'
        ? localStorage.getItem(DEYE_KEY)
        : await SecureStore.getItemAsync(DEYE_KEY);
    return raw ? (JSON.parse(raw) as DeyeCredentials) : null;
  } catch {
    return null;
  }
}

export async function saveDeyeCredentials(credentials: DeyeCredentials): Promise<void> {
  const raw = JSON.stringify(credentials);
  if (Platform.OS === 'web') {
    localStorage.setItem(DEYE_KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(DEYE_KEY, raw);
}

export async function clearDeyeCredentials(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(DEYE_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(DEYE_KEY);
}

/* ------------------------------------------------------------------ */
/* Cache local Deye — consultation hors-ligne de la dernière mesure    */
/* ------------------------------------------------------------------ */

export type DeyeCacheEntry = {
  /** Données temps réel de la dernière consultation en ligne. */
  live: Record<string, unknown> | null;
  /** Nom et id de la centrale. */
  stationName: string | null;
  stationId: string | null;
  /** Horodatage d'enregistrement (ms epoch). */
  savedAt: number;
};

export async function getDeyeCache(): Promise<DeyeCacheEntry | null> {
  try {
    const raw =
      Platform.OS === 'web'
        ? localStorage.getItem(DEYE_CACHE_KEY)
        : await SecureStore.getItemAsync(DEYE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as DeyeCacheEntry) : null;
  } catch {
    return null;
  }
}

export async function saveDeyeCache(entry: DeyeCacheEntry): Promise<void> {
  const raw = JSON.stringify(entry);
  if (Platform.OS === 'web') {
    localStorage.setItem(DEYE_CACHE_KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(DEYE_CACHE_KEY, raw);
}

export async function clearDeyeCache(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(DEYE_CACHE_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(DEYE_CACHE_KEY);
}

export async function getStoredUser(): Promise<LumenUser | null> {
  try {
    const raw =
      Platform.OS === 'web'
        ? localStorage.getItem(USER_KEY)
        : await SecureStore.getItemAsync(USER_KEY);
    return raw ? (JSON.parse(raw) as LumenUser) : null;
  } catch {
    return null;
  }
}

export async function saveStoredUser(user: LumenUser): Promise<void> {
  const raw = JSON.stringify(user);
  if (Platform.OS === 'web') {
    localStorage.setItem(USER_KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(USER_KEY, raw);
}

export async function clearStoredUser(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(USER_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function getAuthToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }

  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveAuthToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }

  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearAuthToken(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
