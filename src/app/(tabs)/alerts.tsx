import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getLumenPalette } from '@/constants/lumen-colors';
import { apiRequest } from '@/services/api';
import { getAuthToken } from '@/services/session';
import { useAuth } from '@/contexts/auth';

type LumenAlert = {
  id: string;
  site_id?: string | null;
  site_name?: string | null;
  severity: string;
  status: string;
  title: string;
  message: string;
  created_at?: string | null;
};

type FilterType = 'all' | 'new' | 'acknowledged' | 'resolved';

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function extractAlerts(payload: unknown, depth = 0): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isObject(payload) || depth > 5) return [];
  for (const key of ['alerts', 'data', 'items', 'results']) {
    const child: unknown = payload[key];
    if (child !== undefined && child !== payload) {
      const result = extractAlerts(child, depth + 1);
      if (result.length > 0 || Array.isArray(child)) return result;
    }
  }
  return [];
}

function normalizeStatus(value: unknown): string {
  if (typeof value !== 'string') return 'nouveau';
  switch (value.trim().toLowerCase()) {
    case 'new':
    case 'nouveau':
      return 'nouveau';
    case 'acknowledged':
    case 'acquitte':
    case 'acquitté':
      return 'acquitte';
    case 'resolved':
    case 'resolu':
    case 'résolu':
      return 'resolu';
    default:
      return value;
  }
}

function normalizeAlert(value: unknown): LumenAlert | null {
  if (!isObject(value)) return null;
  const id =
    typeof value.id === 'string' && value.id
      ? value.id
      : typeof value.alert_id === 'string'
        ? value.alert_id
        : null;
  if (!id) return null;

  const title =
    (typeof value.title === 'string' && value.title) ||
    (typeof value.name === 'string' && value.name) ||
    'Alerte';
  const message =
    (typeof value.message === 'string' && value.message) ||
    (typeof value.description === 'string' && value.description) ||
    '';

  return {
    id,
    site_id: typeof value.site_id === 'string' ? value.site_id : null,
    site_name: typeof value.site_name === 'string' ? value.site_name : null,
    severity:
      (typeof value.severity === 'string' && value.severity) || 'info',
    status: normalizeStatus(value.status),
    title,
    message,
    created_at:
      (typeof value.created_at === 'string' && value.created_at) || null,
  };
}

function severityLabel(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'Critique';
    case 'warning':
      return 'Avertissement';
    case 'info':
      return 'Information';
    default:
      return severity;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'nouveau':
      return 'Nouveau';
    case 'acquitte':
      return 'Acquitté';
    case 'resolu':
      return 'Résolu';
    default:
      return status;
  }
}

function severityColors(
  severity: string,
  COLORS: ReturnType<typeof getLumenPalette>,
) {
  switch (severity) {
    case 'critical':
      return { color: COLORS.error, bg: COLORS.errorBg, border: COLORS.errorBorder };
    case 'warning':
      return {
        color: COLORS.warning,
        bg: COLORS.warningBg,
        border: COLORS.warningBorder,
      };
    default:
      return { color: COLORS.primary, bg: COLORS.mutedBg, border: COLORS.border };
  }
}

export default function AlertsScreen() {
  const COLORS = getLumenPalette(
    useColorScheme() as 'light' | 'dark' | null,
  );
  const { user } = useAuth();
  const router = useRouter();

  const [alerts, setAlerts] = useState<LumenAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (manual = false) => {
    if (manual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error(
          'Aucune session active. Reconnectez-vous à LUMEN.',
        );
      }
      const response = await apiRequest<unknown>('alerts', {
        method: 'GET',
        token,
      });
      const normalized = extractAlerts(response)
        .map(normalizeAlert)
        .filter((alert): alert is LumenAlert => alert !== null);
      setAlerts(normalized);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de récupérer les alertes.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Chargement initial des données depuis l'API (asynchrone).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return alerts.filter((alert) => {
      if (filter === 'new') return alert.status === 'nouveau';
      if (filter === 'acknowledged') return alert.status === 'acquitte';
      if (filter === 'resolved') return alert.status === 'resolu';
      return true;
    });
  }, [alerts, filter]);

  const newCount = alerts.filter((a) => a.status === 'nouveau').length;

  const acknowledge = async (alert: LumenAlert) => {
    setBusyId(alert.id);
    try {
      const token = await getAuthToken();
      if (token) {
        await apiRequest(`alerts/${encodeURIComponent(alert.id)}/acknowledge`, {
          method: 'PATCH',
          token,
          body: { acknowledged_by: user?.id ?? null },
        });
      }
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alert.id ? { ...a, status: 'acquitte' } : a,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Échec de l'acquittement.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const resolve = async (alert: LumenAlert) => {
    setBusyId(alert.id);
    try {
      const token = await getAuthToken();
      if (token) {
        await apiRequest(`alerts/${encodeURIComponent(alert.id)}/resolve`, {
          method: 'PATCH',
          token,
        });
      }
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alert.id ? { ...a, status: 'resolu' } : a,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Échec de la résolution.',
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.background}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={COLORS.success}
            colors={[COLORS.success]}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>LUMEN</Text>
            <Text style={styles.brandSubtitle}>
              SUPERVISION ÉNERGÉTIQUE
            </Text>
          </View>
          {newCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {newCount} nouveau(x)
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.title}>Alertes</Text>
        <Text style={styles.subtitle}>
          Notifications et alertes de vos installations supervisées.
        </Text>

        <View style={styles.filters}>
          <FilterButton
            label="Toutes"
            active={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          <FilterButton
            label="Nouvelles"
            active={filter === 'new'}
            onPress={() => setFilter('new')}
          />
          <FilterButton
            label="Acquittées"
            active={filter === 'acknowledged'}
            onPress={() => setFilter('acknowledged')}
          />
          <FilterButton
            label="Résolues"
            active={filter === 'resolved'}
            onPress={() => setFilter('resolved')}
          />
        </View>

        <Pressable onPress={() => void load(true)} disabled={refreshing}>
          <Text style={styles.refreshText}>
            {refreshing ? 'Actualisation...' : 'Actualiser'}
          </Text>
        </Pressable>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void load(true)}>
              <Text style={styles.retryText}>Réessayer</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={COLORS.success} />
            <Text style={styles.stateText}>Chargement des alertes...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>Aucune alerte pour l&apos;instant.</Text>
          </View>
        ) : (
          filtered.map((alert) => {
            const sev = severityColors(alert.severity, COLORS);
            const busy = busyId === alert.id;
            return (
              <View
                key={alert.id}
                style={[styles.card, { borderLeftColor: sev.color }]}
              >
                <View style={styles.cardHeader}>
                  <View
                    style={[styles.severityPill, { backgroundColor: sev.bg, borderColor: sev.border }]}
                  >
                    <Text style={[styles.severityText, { color: sev.color }]}>
                      {severityLabel(alert.severity)}
                    </Text>
                  </View>
                  <View style={styles.cardMeta}>
                    <Text style={styles.statusText}>
                      {statusLabel(alert.status)}
                    </Text>
                    {alert.created_at ? (
                      <Text style={styles.dateText}>
                        {new Date(alert.created_at).toLocaleString('fr-FR')}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                {alert.message ? (
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                ) : null}
                {alert.site_name ? (
                  <Text style={styles.siteText}>Site : {alert.site_name}</Text>
                ) : null}
                {alert.site_id && alert.status !== 'resolu' ? (
                  <Pressable
                    onPress={() =>
                      router.push(
                        `/monitoring/${alert.site_id}` as never,
                      )
                    }
                    accessibilityRole="button"
                  >
                    <Text style={styles.linkText}>
                      Voir la centrale →
                    </Text>
                  </Pressable>
                ) : null}
                {alert.status !== 'resolu' ? (
                  <View style={styles.actions}>
                    {alert.status === 'nouveau' ? (
                      <ActionButton
                        label="Acquitter"
                        busy={busy}
                        onPress={() => void acknowledge(alert)}
                      />
                    ) : null}
                    <ActionButton
                      label="Résoudre"
                      busy={busy}
                      onPress={() => void resolve(alert)}
                    />
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Les alertes proviennent de l&apos;API LUMEN. Acquittez une alerte pour
            signaler que vous la prenez en charge, ou résolvez-la une fois le
            problème corrigé.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterButton,
        active && styles.filterActive,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.filterText, active && styles.filterTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ActionButton({
  label,
  busy,
  onPress,
}: {
  label: string;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.actionButton,
        pressed && styles.pressed,
        busy && styles.disabledText,
      ]}
      accessibilityRole="button"
    >
      <Text style={styles.actionText}>{busy ? '...' : label}</Text>
    </Pressable>
  );
}

const createStyles = (COLORS: ReturnType<typeof getLumenPalette>) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.background },
    scroll: { flex: 1 },
    content: { padding: 20, paddingBottom: 36, gap: 16 },
    header: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      paddingBottom: 14,
    },
    brand: {
      color: COLORS.text,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 2,
    },
    brandSubtitle: {
      color: COLORS.muted,
      fontSize: 8,
      letterSpacing: 1.1,
      marginTop: 3,
    },
    badge: {
      borderWidth: 1,
      borderColor: COLORS.errorBorder,
      backgroundColor: COLORS.errorBg,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    badgeText: { color: COLORS.error, fontSize: 10, fontWeight: '800' },
    title: {
      color: COLORS.text,
      fontSize: 28,
      fontWeight: '800',
      marginTop: 8,
    },
    subtitle: {
      color: COLORS.muted,
      fontSize: 13,
      lineHeight: 20,
      marginTop: -9,
    },
    filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    filterButton: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 22,
      backgroundColor: COLORS.card,
    },
    filterActive: {
      borderColor: COLORS.success,
      backgroundColor: COLORS.successBg,
    },
    filterText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
    filterTextActive: { color: COLORS.success },
    refreshText: {
      color: COLORS.success,
      fontSize: 12,
      fontWeight: '700',
    },
    errorCard: {
      padding: 16,
      gap: 10,
      backgroundColor: COLORS.errorBg,
      borderWidth: 1,
      borderColor: COLORS.errorBorder,
      borderRadius: 14,
    },
    errorText: { color: COLORS.error, fontSize: 12, lineHeight: 19 },
    retryText: { color: COLORS.success, fontSize: 12, fontWeight: '700' },
    stateCard: {
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 14,
    },
    stateText: { color: COLORS.muted, fontSize: 12 },
    card: {
      padding: 14,
      gap: 8,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderLeftWidth: 4,
      borderRadius: 15,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    severityPill: {
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    severityText: { fontSize: 10, fontWeight: '800' },
    cardMeta: { alignItems: 'flex-end', gap: 2 },
    statusText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
    dateText: { color: COLORS.muted, fontSize: 10 },
    alertTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
    alertMessage: {
      color: COLORS.muted,
      fontSize: 12,
      lineHeight: 19,
    },
    siteText: { color: COLORS.primary, fontSize: 11, fontWeight: '600' },
    linkText: { color: COLORS.success, fontSize: 12, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    actionButton: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 10,
      backgroundColor: COLORS.background,
    },
    actionText: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
    pressed: { opacity: 0.7 },
    disabledText: { opacity: 0.5 },
    footer: { marginTop: 6, gap: 4 },
    footerText: { color: COLORS.muted, fontSize: 11, lineHeight: 18 },
  });

const styles = createStyles(getLumenPalette('dark'));
