import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getLumenPalette } from '@/constants/lumen-colors';
import { apiRequest } from '@/services/api';
import { extractArray } from '@/services/lumen-api';

/**
 * Barre de navigation supérieure (style Facebook) :
 * logo LUMEN à gauche, raccourcis messages / notifications / profil à droite,
 * badges de compteur (messages non lus, alertes actives) et menu profil
 * avec déconnexion. Thème clair/sombre suit le système.
 */
export function TopNav() {
  const router = useRouter();
  const { user, token, signOut } = useAuth();
  const scheme = useColorScheme();
  const COLORS = getLumenPalette(scheme);

  const [unreadMessages, setUnreadMessages] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);

  const initials = user?.full_name || user?.username || '?';
  const avatar = initials
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);

  const isStaff = user?.role === 'admin' || user?.role === 'technician';

  const loadCounters = useCallback(async () => {
    if (!token) return;
    try {
      const [messagesRes, alertsRes] = await Promise.all([
        isStaff ? apiRequest<unknown>('messages', { token }) : Promise.resolve([]),
        apiRequest<unknown>('alerts?status=active', { token }),
      ]);
      const messages = extractArray(messagesRes);
      setUnreadMessages(
        messages.filter((m) => {
          const status = String(m.status ?? 'nouveau').toLowerCase();
          return status === 'nouveau' || status === 'new';
        }).length,
      );
      const alerts = extractArray(alertsRes);
      setActiveAlerts(alerts.length);
    } catch {
      // Silencieux : les badges restent simplement à leur dernière valeur.
    }
  }, [token, isStaff]);

  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => void loadCounters(), 60_000);
    const initial = setTimeout(() => void loadCounters(), 0);
    return () => {
      clearInterval(timer);
      clearTimeout(initial);
    };
  }, [loadCounters, token]);

  const handleSignOut = () => {
    setMenuVisible(false);
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: () => void signOut(),
        },
      ],
    );
  };

  return (
    <View style={[styles.bar, { backgroundColor: COLORS.card, borderBottomColor: COLORS.border }]}>
      <Pressable
        onPress={() => router.navigate('/(tabs)')}
        accessibilityRole="button"
        style={styles.brand}
      >
        <View style={styles.logoCircle}>
          <Text style={styles.logoMark}>L</Text>
        </View>
        <Text style={[styles.brandText, { color: COLORS.text }]}>LUMEN</Text>
      </Pressable>

      <View style={styles.actions}>
        {isStaff ? (
          <HeaderAction
            glyph="✉"
            label="Messages"
            badge={unreadMessages}
            onPress={() => router.navigate('/(tabs)/messages')}
            COLORS={COLORS}
          />
        ) : null}
        <HeaderAction
          glyph="🔔"
          label="Notifications"
          badge={activeAlerts}
          onPress={() => router.navigate('/(tabs)/notifications')}
          COLORS={COLORS}
        />
        <Pressable
          onPress={() => setMenuVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Menu profil"
          style={[styles.avatar, { backgroundColor: COLORS.successBg, borderColor: COLORS.success }]}
        >
          <Text style={[styles.avatarText, { color: COLORS.success }]}>{avatar}</Text>
        </Pressable>
      </View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menu, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            <View style={styles.menuHeader}>
              <Text style={[styles.menuName, { color: COLORS.text }]}>
                {user?.full_name || user?.username || 'Utilisateur'}
              </Text>
              <Text style={[styles.menuRole, { color: COLORS.muted }]}>
                {user?.email || user?.role || ''}
              </Text>
            </View>
            <MenuButton
              label="Mon profil"
              glyph="👤"
              COLORS={COLORS}
              onPress={() => {
                setMenuVisible(false);
                router.navigate('/(tabs)/profile');
              }}
            />
            <MenuButton
              label="Se déconnecter"
              glyph="⎋"
              danger
              COLORS={COLORS}
              onPress={handleSignOut}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function HeaderAction({
  glyph,
  label,
  badge,
  onPress,
  COLORS,
}: {
  glyph: string;
  label: string;
  badge?: number;
  onPress: () => void;
  COLORS: ReturnType<typeof getLumenPalette>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label} (${badge})` : label}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed, { backgroundColor: COLORS.successBg }]}
    >
      <Text style={[styles.actionIcon, { color: COLORS.success }]}>{glyph}</Text>
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function MenuButton({
  label,
  glyph,
  danger,
  COLORS,
  onPress,
}: {
  label: string;
  glyph: string;
  danger?: boolean;
  COLORS: ReturnType<typeof getLumenPalette>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.menuButton,
        pressed && styles.menuButtonPressed,
        danger && { backgroundColor: COLORS.errorBg },
      ]}
    >
      <Text style={[styles.menuGlyph, { color: danger ? COLORS.error : COLORS.text }]}>{glyph}</Text>
      <Text style={[styles.menuLabel, { color: danger ? COLORS.error : COLORS.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#122A32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMark: {
    color: '#38D9A9',
    fontSize: 18,
    fontWeight: '900',
  },
  brandText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  action: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionIcon: {
    fontSize: 16,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#EF4343',
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'flex-end',
    padding: 12,
  },
  menu: {
    width: 220,
    borderRadius: 14,
    borderWidth: 1,
    paddingTop: 6,
    paddingBottom: 6,
    overflow: 'hidden',
  },
  menuHeader: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuName: {
    fontSize: 14,
    fontWeight: '700',
  },
  menuRole: {
    fontSize: 11,
    marginTop: 2,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuButtonPressed: {
    opacity: 0.6,
  },
  menuGlyph: {
    fontSize: 14,
    width: 20,
    textAlign: 'center',
  },
  menuLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default TopNav;
