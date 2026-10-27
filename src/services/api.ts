
// src/services/api.ts

/**
 * Client HTTP centralisé pour l'API LUMEN.
 *
 * L'adresse de base sera configurée après vérification
 * de l'URL HTTPS publique du backend.
 */

export const API_BASE_URL = 'https://monitoring.lumen.green/api/lumen';

type ApiOptions = {
  token?: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
};

export async function apiRequest<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error(
      "L'adresse de l'API LUMEN n'est pas encore configurée.",
    );
  }

  const response = await fetch(
    `${API_BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`,
    {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(options.token
          ? { Authorization: `Bearer ${options.token}` }
          : {}),
      },
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    },
  );

  const text = await response.text();

  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error('Le serveur a renvoyé une réponse invalide.');
  }

  if (!response.ok) {
    const errorMessage =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : `Erreur API HTTP ${response.status}`;

    throw new Error(errorMessage);
  }

  return data as T;
}
