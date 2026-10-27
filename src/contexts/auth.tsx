import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiRequest } from '@/services/api';
import {
  clearAuthToken,
  clearStoredUser,
  getAuthToken,
  getStoredUser,
  saveAuthToken,
  saveStoredUser,
} from '@/services/session';

export type LumenUser = {
  id: string;
  username: string;
  email: string | null;
  full_name?: string | null;
  phone?: string | null;
  role: string;
  two_factor_enabled?: boolean;
  created_at?: string | null;
};

type AuthResult =
  | { error: null; requires2FA?: false }
  | { error: null; requires2FA: true; tempToken: string }
  | { error: Error };

type AuthContextValue = {
  token: string | null;
  user: LumenUser | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<AuthResult>;
  verifyTwoFactorLogin: (
    tempToken: string,
    code: string,
  ) => Promise<{ error: Error | null }>;
  signUp: (
    username: string,
    password: string,
    email?: string,
    fullName?: string,
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type LoginResponse = {
  token?: string;
  user?: LumenUser;
  requires2FA?: boolean;
  tempToken?: string;
  message?: string;
  error?: string;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<LumenUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [savedToken, savedUser] = await Promise.all([
          getAuthToken(),
          getStoredUser(),
        ]);
        if (mounted && savedToken) {
          setToken(savedToken);
          setUser(savedUser);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const persistSession = useCallback(
    async (nextToken: string, nextUser: LumenUser) => {
      await saveAuthToken(nextToken);
      await saveStoredUser(nextUser);
      setToken(nextToken);
      setUser(nextUser);
    },
    [],
  );

  const signIn = useCallback(
    async (username: string, password: string): Promise<AuthResult> => {
      try {
        const response = await apiRequest<LoginResponse>('auth/login', {
          method: 'POST',
          body: { username: username.trim(), password },
        });
        if (response.requires2FA && response.tempToken) {
          return {
            error: null,
            requires2FA: true,
            tempToken: response.tempToken,
          };
        }
        if (!response.token || !response.user) {
          return {
            error: new Error(
              response.message ||
              response.error ||
              "Le serveur n'a pas retourné de jeton.",
            ),
          };
        }
        await persistSession(response.token, response.user);
        return { error: null };
      } catch (err) {
        return {
          error:
            err instanceof Error
              ? err
              : new Error('Connexion impossible. Vérifiez votre réseau.'),
        };
      }
    },
    [persistSession],
  );

  const verifyTwoFactorLogin = useCallback(
    async (tempToken: string, code: string) => {
      try {
        const response = await apiRequest<LoginResponse>(
          'auth/2fa/verify-login',
          { method: 'POST', body: { tempToken, code } },
        );
        if (!response.token || !response.user) {
          return {
            error: new Error(
              response.message ||
              response.error ||
              'Code invalide ou serveur indisponible.',
            ),
          };
        }
        await persistSession(response.token, response.user);
        return { error: null };
      } catch (err) {
        return {
          error:
            err instanceof Error ? err : new Error('Vérification impossible.'),
        };
      }
    },
    [persistSession],
  );

  const signUp = useCallback(
    async (
      username: string,
      password: string,
      email?: string,
      fullName?: string,
    ) => {
      try {
        const response = await apiRequest<LoginResponse>('auth/register', {
          method: 'POST',
          body: {
            username: username.trim(),
            password,
            email,
            full_name: fullName,
          },
        });
        if (!response.token || !response.user) {
          return {
            error: new Error(
              response.message ||
              response.error ||
              "Le serveur n'a pas retourné de jeton.",
            ),
          };
        }
        await persistSession(response.token, response.user);
        return { error: null };
      } catch (err) {
        return {
          error:
            err instanceof Error ? err : new Error('Inscription impossible.'),
        };
      }
    },
    [persistSession],
  );

  const signOut = useCallback(async () => {
    await clearAuthToken();
    await clearStoredUser();
    setToken(null);
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    try {
      const profile = await apiRequest<LumenUser>('auth/me', { token });
      setUser(profile);
      await saveStoredUser(profile);
    } catch {
      // Silencieux : le profil local reste utilisable hors ligne.
    }
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      signIn,
      verifyTwoFactorLogin,
      signUp,
      signOut,
      refreshProfile,
    }),
    [
      token,
      user,
      loading,
      signIn,
      verifyTwoFactorLogin,
      signUp,
      signOut,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
