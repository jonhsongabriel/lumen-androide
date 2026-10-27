import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { getLumenPalette } from '@/constants/lumen-colors';
import { apiRequest } from '@/services/api';
import { getAuthToken } from '@/services/session';
import { useAuth } from '@/contexts/auth';

type MessageRow = {
  id: string;
  subject: string | null;
  content: string;
  status: string;
  created_at: string | null;
  sender_username: string | null;
  sender_email: string | null;
  sender_role: string | null;
  reply_content: string | null;
  replied_at: string | null;
};

type MessageFilter = 'all' | 'nouveau' | 'lu' | 'traite';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  engineer: 'Ingénieur',
  technician: 'Technicien',
  client: 'Client',
};

function statusLabel(status: string): string {
  switch (status) {
    case 'nouveau':
      return 'Nouveau';
    case 'lu':
      return 'Lu';
    case 'traite':
      return 'Traité';
    default:
      return status;
  }
}

export default function MessagesScreen() {
  const COLORS = getLumenPalette(
    useColorScheme() as 'light' | 'dark' | null,
  );
  const { user } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<MessageFilter>('all');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const allowed = user?.role === 'admin' || user?.role === 'technician';

  const filtered = useMemo(() => {
    if (filter === 'all') return messages;
    return messages.filter((m) => m.status === filter);
  }, [messages, filter]);

  /** Compteurs par statut, affichés sur les puces de filtre. */
  const counts = useMemo(
    () => ({
      all: messages.length,
      nouveau: messages.filter((m) => m.status === 'nouveau').length,
      lu: messages.filter((m) => m.status === 'lu').length,
      traite: messages.filter((m) => m.status === 'traite').length,
    }),
    [messages],
  );

  const load = useCallback(async (manual = false) => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Aucune session active. Reconnectez-vous.');
      }
      const response = await apiRequest<unknown>('messages', {
        method: 'GET',
        token,
      });
      const rows = Array.isArray(response) ? response : [];
      const normalized: MessageRow[] = [];
      for (const raw of rows) {
        if (
          raw !== null &&
          typeof raw === 'object' &&
          typeof (raw as Record<string, unknown>).id === 'string'
        ) {
          const value = raw as Record<string, unknown>;
          normalized.push({
            id: value.id as string,
            subject:
              typeof value.subject === 'string' ? value.subject : null,
            content: typeof value.content === 'string' ? value.content : '',
            status:
              typeof value.status === 'string' ? value.status : 'nouveau',
            created_at:
              typeof value.created_at === 'string' ? value.created_at : null,
            sender_username:
              typeof value.sender_username === 'string'
                ? value.sender_username
                : null,
            sender_email:
              typeof value.sender_email === 'string'
                ? value.sender_email
                : null,
            sender_role:
              typeof value.sender_role === 'string'
                ? value.sender_role
                : null,
            reply_content:
              typeof value.reply_content === 'string'
                ? value.reply_content
                : null,
            replied_at:
              typeof value.replied_at === 'string' ? value.replied_at : null,
          });
        }
      }
      setMessages(normalized);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur de chargement.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [allowed]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const tokenHeader = useCallback(async () => {
    const token = await getAuthToken();
    return token ?? '';
  }, []);

  const markRead = async (message: MessageRow) => {
    setBusyId(message.id);
    try {
      const token = await tokenHeader();
      await apiRequest(`messages/${encodeURIComponent(message.id)}/read`, {
        method: 'PATCH',
        token,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, status: 'lu' } : m)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la mise à jour.');
    } finally {
      setBusyId(null);
    }
  };

  const markTreated = async (message: MessageRow) => {
    setBusyId(message.id);
    try {
      const token = await tokenHeader();
      await apiRequest(`messages/${encodeURIComponent(message.id)}/treated`, {
        method: 'PATCH',
        token,
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id ? { ...m, status: 'traite' } : m,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la mise à jour.');
    } finally {
      setBusyId(null);
    }
  };

  const sendReply = async (message: MessageRow) => {
    const reply = (replyDrafts[message.id] || '').trim();
    if (!reply) {
      setError("Écrivez une réponse avant d'envoyer.");
      return;
    }
    setSendingReply(message.id);
    try {
      const token = await tokenHeader();
      const updated = await apiRequest<Record<string, unknown>>(
        `messages/${encodeURIComponent(message.id)}/reply`,
        { method: 'PATCH', token, body: { reply_content: reply } },
      );
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? {
                ...m,
                reply_content:
                  typeof updated.reply_content === 'string'
                    ? updated.reply_content
                    : reply,
                replied_at:
                  typeof updated.replied_at === 'string'
                    ? updated.replied_at
                    : new Date().toISOString(),
                status:
                  typeof updated.status === 'string' ? updated.status : m.status,
              }
            : m,
        ),
      );
      setReplyDrafts((prev) => ({ ...prev, [message.id]: '' }));
      setReplyingId(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Échec de l'envoi de la réponse.",
      );
    } finally {
      setSendingReply(null);
    }
  };

  if (!allowed) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.background}
        />
        <View style={styles.center}>
          <Text style={styles.centerTitle}>Accès non autorisé</Text>
          <Text style={styles.centerText}>
            Cette page est réservée aux administrateurs et techniciens.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const newCount = messages.filter((m) => m.status === 'nouveau').length;

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
              <Text style={styles.badgeText}>{newCount} nouveau(x)</Text>
            </View>
          )}
        </View>

        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>
          Messages envoyés par les utilisateurs via le bouton de contact.
        </Text>

        <View style={styles.filters}>
          {(
            [
              { key: 'all', label: 'Toutes' },
              { key: 'nouveau', label: 'Nouvelles' },
              { key: 'lu', label: 'Lues' },
              { key: 'traite', label: 'Traitées' },
            ] as { key: MessageFilter; label: string }[]
          ).map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={({ pressed }) => [
                styles.filterButton,
                filter === f.key && styles.filterActive,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === f.key }}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === f.key && styles.filterTextActive,
                ]}
              >
                {f.label} ({counts[f.key]})
              </Text>
            </Pressable>
          ))}
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
            <Text style={styles.stateText}>Chargement des messages...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>
              {messages.length === 0
                ? "Aucun message pour l'instant."
                : 'Aucun message dans ce filtre.'}
            </Text>
          </View>
        ) : (
          filtered.map((m) => {
            const busy = busyId === m.id;
            const replying = replyingId === m.id;
            return (
              <View
                key={m.id}
                style={[
                  styles.card,
                  m.status === 'nouveau' && styles.cardNew,
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.senderRow}>
                    <Text style={styles.senderName}>
                      {m.sender_username || 'Utilisateur supprimé'}
                    </Text>
                    {m.sender_role ? (
                      <View style={styles.rolePill}>
                        <Text style={styles.roleText}>
                          {ROLE_LABELS[m.sender_role] || m.sender_role}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.metaCol}>
                    <Text style={styles.statusText}>
                      {statusLabel(m.status)}
                    </Text>
                    {m.created_at ? (
                      <Text style={styles.dateText}>
                        {new Date(m.created_at).toLocaleString('fr-FR')}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {m.sender_email ? (
                  <Text style={styles.senderEmail}>{m.sender_email}</Text>
                ) : null}
                {m.subject ? (
                  <Text style={styles.subject}>{m.subject}</Text>
                ) : null}
                <Text style={styles.messageContent}>{m.content}</Text>

                {m.reply_content ? (
                  <View style={styles.replyBox}>
                    <Text style={styles.replyMeta}>
                      Réponse envoyée
                      {m.replied_at
                        ? ` le ${new Date(m.replied_at).toLocaleString('fr-FR')}`
                        : ''}
                    </Text>
                    <Text style={styles.replyContent}>{m.reply_content}</Text>
                  </View>
                ) : null}

                {replying ? (
                  <View style={styles.replyEditor}>
                    <TextInput
                      value={replyDrafts[m.id] || ''}
                      onChangeText={(text) =>
                        setReplyDrafts((prev) => ({
                          ...prev,
                          [m.id]: text,
                        }))
                      }
                      placeholder="Écrire une réponse..."
                      placeholderTextColor={COLORS.muted}
                      multiline
                      numberOfLines={3}
                      style={styles.replyInput}
                    />
                    <View style={styles.replyActions}>
                      <Pressable onPress={() => setReplyingId(null)}>
                        <Text style={styles.cancelText}>Annuler</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void sendReply(m)}
                        disabled={sendingReply === m.id}
                        style={styles.sendButton}
                      >
                        {sendingReply === m.id ? (
                          <ActivityIndicator size="small" color={COLORS.success} />
                        ) : (
                          <Text style={styles.sendText}>
                            Envoyer la réponse
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                <View style={styles.actions}>
                  {m.status === 'nouveau' ? (
                    <ActionButton
                      label="Marquer lu"
                      busy={busy}
                      onPress={() => void markRead(m)}
                      COLORS={COLORS}
                    />
                  ) : null}
                  {!m.reply_content && !replying ? (
                    <ActionButton
                      label="Répondre"
                      busy={false}
                      onPress={() => setReplyingId(m.id)}
                      COLORS={COLORS}
                    />
                  ) : null}
                  {m.status !== 'traite' ? (
                    <ActionButton
                      label="Marquer traité"
                      busy={busy}
                      onPress={() => void markTreated(m)}
                      COLORS={COLORS}
                    />
                  ) : null}
                </View>
              </View>
            );
          })
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Boîte de réception des messages de contact. Répondez directement
            depuis l&apos;application&nbsp;; la réponse est envoyée par email à l&apos;utilisateur.
          </Text>
          <View style={styles.quickLinksRow}>
            <Pressable
              style={styles.quickLinkChip}
              onPress={() => router.push('/(tabs)/users' as Href)}
              accessibilityRole="button"
              accessibilityLabel="Gérer les utilisateurs"
            >
              <Text style={styles.quickLinkText}>👥 Utilisateurs</Text>
            </Pressable>
            <Pressable
              style={styles.quickLinkChip}
              onPress={() => router.push('/(tabs)/contact' as Href)}
              accessibilityRole="button"
              accessibilityLabel="Formulaire de contact"
            >
              <Text style={styles.quickLinkText}>✉ Contact</Text>
            </Pressable>
            <Pressable
              style={styles.quickLinkChip}
              onPress={() => router.push('/(tabs)/alerts' as Href)}
              accessibilityRole="button"
              accessibilityLabel="Voir les alertes"
            >
              <Text style={styles.quickLinkText}>⚠ Alertes</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({
  label,
  busy,
  onPress,
  COLORS,
}: {
  label: string;
  busy: boolean;
  onPress: () => void;
  COLORS: ReturnType<typeof getLumenPalette>;
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
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: 32,
    },
    centerTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
    centerText: {
      color: COLORS.muted,
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
    },
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
      borderRadius: 15,
    },
    cardNew: { borderColor: COLORS.success },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    senderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
      flex: 1,
    },
    senderName: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
    rolePill: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    roleText: { color: COLORS.muted, fontSize: 9 },
    metaCol: { alignItems: 'flex-end', gap: 2 },
    statusText: { color: COLORS.success, fontSize: 11, fontWeight: '700' },
    dateText: { color: COLORS.muted, fontSize: 10 },
    senderEmail: { color: COLORS.muted, fontSize: 11, marginTop: -4 },
    subject: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
    messageContent: { color: COLORS.text, fontSize: 13, lineHeight: 20 },
    replyBox: {
      borderLeftWidth: 2,
      borderLeftColor: COLORS.success,
      paddingLeft: 10,
      paddingVertical: 4,
      backgroundColor: COLORS.mutedBg,
      borderRadius: 6,
      gap: 4,
    },
    replyMeta: { color: COLORS.muted, fontSize: 10 },
    replyContent: { color: COLORS.text, fontSize: 12, lineHeight: 18 },
    replyEditor: { gap: 8, marginTop: 2 },
    replyInput: {
      minHeight: 80,
      padding: 10,
      color: COLORS.text,
      backgroundColor: COLORS.background,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 10,
      fontSize: 13,
      textAlignVertical: 'top',
    },
    replyActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 14,
    },
    cancelText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
    sendButton: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      backgroundColor: COLORS.successBg,
      borderWidth: 1,
      borderColor: COLORS.successBorder,
      borderRadius: 10,
    },
    sendText: { color: COLORS.success, fontSize: 12, fontWeight: '800' },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 2,
    },
    actionButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 10,
      backgroundColor: COLORS.background,
    },
    actionText: { color: COLORS.text, fontSize: 11, fontWeight: '700' },
    pressed: { opacity: 0.7 },
    disabledText: { opacity: 0.5 },
    footer: { marginTop: 6, gap: 12 },
    footerText: { color: COLORS.muted, fontSize: 11, lineHeight: 18 },
    filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    filterButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 20,
      backgroundColor: COLORS.card,
    },
    filterActive: {
      borderColor: COLORS.success,
      backgroundColor: COLORS.successBg,
    },
    filterText: { color: COLORS.muted, fontSize: 11, fontWeight: '600' },
    filterTextActive: { color: COLORS.success, fontWeight: '700' },
    quickLinksRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    quickLinkChip: {
      paddingVertical: 7,
      paddingHorizontal: 12,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 20,
    },
    quickLinkText: { color: COLORS.primary, fontSize: 11, fontWeight: '700' },
  });

const styles = createStyles(getLumenPalette('dark'));
