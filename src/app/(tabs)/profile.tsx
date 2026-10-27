import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getLumenPalette } from '@/constants/lumen-colors';
import { useAuth } from '@/contexts/auth';
import { apiRequest } from '@/services/api';

function roleLabel(role: string | undefined): string {
  switch (role) {
    case 'admin':
      return 'Administrateur';
    case 'engineer':
      return 'Ingénieur';
    case 'technician':
      return 'Technicien';
    case 'client':
      return 'Client';
    default:
      return role || 'N/A';
  }
}

export default function ProfileScreen() {
  const COLORS = getLumenPalette(
    useColorScheme() as 'light' | 'dark' | null,
  );
  const { user, token, refreshProfile, signOut } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);

  // Flux 2FA (même logique que ProfilePage.tsx du Web)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(
    user?.two_factor_enabled ?? false,
  );
  const [setupOtpauthUrl, setSetupOtpauthUrl] = useState<string | null>(null);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState('');

  const userCreatedAt = user?.created_at;
  const memberSince = useMemo(() => {
    if (!userCreatedAt) return null;
    const date = new Date(userCreatedAt);
    return Number.isFinite(date.getTime()) ? date : null;
  }, [userCreatedAt]);

  const handleSave = async () => {
    setMessage('');
    setMessageError(false);
    setSaving(true);
    try {
      await apiRequest('auth/me', {
        method: 'PATCH',
        token: token ?? undefined,
        body: {
          full_name: fullName.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
        },
      });
      await refreshProfile();
      setMessage('Profil mis à jour avec succès');
    } catch (err) {
      setMessageError(true);
      setMessage(
        err instanceof Error
          ? err.message
          : 'Erreur lors de la mise à jour du profil.',
      );
    } finally {
      setSaving(false);
    }
  };

  const startTwoFactorSetup = async () => {
    setTwoFactorError('');
    setTwoFactorLoading(true);
    try {
      const result = await apiRequest<{ otpauth_url?: string; secret?: string }>(
        'auth/2fa/setup',
        { method: 'POST', token: token ?? undefined },
      );
      setSetupOtpauthUrl(result.otpauth_url ?? null);
      setSetupSecret(result.secret ?? null);
    } catch (err) {
      setTwoFactorError(
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const confirmTwoFactorSetup = async () => {
    if (verifyCode.length < 6) {
      setTwoFactorError(
        'Entrez le code à 6 chiffres affiché par votre application',
      );
      return;
    }
    setTwoFactorError('');
    setTwoFactorLoading(true);
    try {
      await apiRequest('auth/2fa/enable', {
        method: 'POST',
        token: token ?? undefined,
        body: { code: verifyCode },
      });
      setTwoFactorEnabled(true);
      setSetupOtpauthUrl(null);
      setSetupSecret(null);
      setVerifyCode('');
      await refreshProfile();
    } catch (err) {
      setTwoFactorError(
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const disableTwoFactor = async () => {
    setTwoFactorLoading(true);
    setTwoFactorError('');
    try {
      await apiRequest('auth/2fa/disable', {
        method: 'POST',
        token: token ?? undefined,
      });
      setTwoFactorEnabled(false);
      await refreshProfile();
    } catch (err) {
      setTwoFactorError(
        err instanceof Error ? err.message : 'Impossible de désactiver la 2FA.',
      );
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleTwoFactorToggle = (checked: boolean) => {
    if (checked) {
      void startTwoFactorSetup();
    } else {
      void disableTwoFactor();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login' as never);
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.background}
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.success} />
          <Text style={styles.centerText}>Chargement du profil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.background}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>LUMEN</Text>
              <Text style={styles.brandSubtitle}>
                SUPERVISION ÉNERGÉTIQUE
              </Text>
            </View>
          </View>

          <Text style={styles.title}>Profil</Text>
          <Text style={styles.subtitle}>
            Gérez vos informations personnelles et la sécurité de votre compte.
          </Text>

          {/* Informations du compte */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Informations du compte</Text>
            <Field label="Nom d'utilisateur">
              <TextInput
                value={user.username}
                editable={false}
                style={[styles.input, styles.inputDisabled]}
              />
            </Field>
            <Field label="Nom complet">
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Votre nom et prénom"
                placeholderTextColor={COLORS.muted}
                editable={!saving}
                style={styles.input}
              />
            </Field>
            <Field label="Rôle">
              <View style={styles.rolePill}>
                <Text style={styles.roleText}>{roleLabel(user.role)}</Text>
              </View>
            </Field>
            {memberSince ? (
              <Text style={styles.memberSince}>
                Membre depuis le {memberSince.toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            ) : null}
          </View>

          {/* Coordonnées */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Coordonnées</Text>
            <Field label="Email">
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="votre.email@example.com"
                placeholderTextColor={COLORS.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!saving}
                style={styles.input}
              />
            </Field>
            <Field label="Téléphone">
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+33 6 12 34 56 78"
                placeholderTextColor={COLORS.muted}
                keyboardType="phone-pad"
                editable={!saving}
                style={styles.input}
              />
            </Field>
          </View>

          {/* Sécurité */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sécurité</Text>
            <View style={styles.switchRow}>
              <View style={styles.switchTextCol}>
                <Text style={styles.switchLabel}>
                  Authentification à deux facteurs (2FA)
                </Text>
                <Text style={styles.switchHint}>
                  Protégez votre compte avec un code généré par une application
                  d&apos;authentification (Google Authenticator, Authy, etc.)
                </Text>
              </View>
              <Switch
                value={twoFactorEnabled}
                onValueChange={handleTwoFactorToggle}
                disabled={twoFactorLoading || !!setupOtpauthUrl}
                trackColor={{
                  false: COLORS.track,
                  true: COLORS.success,
                }}
              />
            </View>

            {twoFactorError ? (
              <Text style={styles.errorText}>{twoFactorError}</Text>
            ) : null}

            {setupOtpauthUrl ? (
              <View style={styles.setupBox}>
                <Text style={styles.setupTitle}>
                  1. Scannez ce QR code avec votre application
                  d&apos;authentification
                </Text>
                <Text style={styles.setupLink} numberOfLines={0}>
                  {setupOtpauthUrl}
                </Text>
                {setupSecret ? (
                  <Text style={styles.setupSecret}>
                    Ou entrez la clé manuellement : {setupSecret}
                  </Text>
                ) : null}
                <Text style={styles.setupTitle}>
                  2. Entrez le code à 6 chiffres affiché pour confirmer
                </Text>
                <TextInput
                  value={verifyCode}
                  onChangeText={(text) =>
                    setVerifyCode(text.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="123456"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!twoFactorLoading}
                  style={styles.input}
                />
                <View style={styles.setupActions}>
                  <Pressable
                    onPress={() => {
                      setSetupOtpauthUrl(null);
                      setSetupSecret(null);
                      setVerifyCode('');
                      setTwoFactorError('');
                    }}
                    disabled={twoFactorLoading}
                  >
                    <Text style={styles.cancelText}>Annuler</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void confirmTwoFactorSetup()}
                    disabled={twoFactorLoading}
                    style={styles.confirmButton}
                  >
                    <Text style={styles.confirmText}>
                      {twoFactorLoading ? 'Vérification...' : 'Confirmer'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>

          {message ? (
            <Text
              accessibilityRole="alert"
              style={messageError ? styles.errorText : styles.successText}
            >
              {message}
            </Text>
          ) : null}

          {/* Actions */}
          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => void handleSignOut()}
              style={({ pressed }) => [
                styles.logoutButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.logoutText}>Se déconnecter</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleSave()}
              disabled={saving}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.pressed,
                saving && styles.disabledText,
              ]}
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator size="small" color={COLORS.onPrimary} />
              ) : (
                <Text style={styles.saveText}>
                  Enregistrer les modifications
                </Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Vos informations proviennent de l&apos;API LUMEN. La 2FA renforce la
              sécurité de votre compte à chaque connexion.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const createStyles = (COLORS: ReturnType<typeof getLumenPalette>) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.background },
    flex: { flex: 1 },
    content: { padding: 20, paddingBottom: 36, gap: 16 },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 32,
    },
    centerText: { color: COLORS.muted, fontSize: 13 },
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
    card: {
      padding: 16,
      gap: 12,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 16,
    },
    cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
    field: { gap: 6 },
    fieldLabel: {
      color: COLORS.muted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    input: {
      minHeight: 46,
      paddingHorizontal: 12,
      color: COLORS.text,
      backgroundColor: COLORS.background,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 10,
      fontSize: 14,
    },
    inputDisabled: { opacity: 0.6 },
    rolePill: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: COLORS.successBorder,
      backgroundColor: COLORS.successBg,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    roleText: { color: COLORS.success, fontSize: 11, fontWeight: '800' },
    memberSince: { color: COLORS.muted, fontSize: 11 },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    switchTextCol: { flex: 1, gap: 3 },
    switchLabel: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
    switchHint: {
      color: COLORS.muted,
      fontSize: 11,
      lineHeight: 17,
    },
    setupBox: {
      gap: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 12,
      backgroundColor: COLORS.background,
    },
    setupTitle: {
      color: COLORS.text,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 18,
    },
    setupLink: { color: COLORS.primary, fontSize: 11 },
    setupSecret: { color: COLORS.muted, fontSize: 11 },
    setupActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 14,
    },
    cancelText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
    confirmButton: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: COLORS.successBg,
      borderWidth: 1,
      borderColor: COLORS.successBorder,
    },
    confirmText: { color: COLORS.success, fontSize: 12, fontWeight: '800' },
    errorText: { color: COLORS.error, fontSize: 12, lineHeight: 18 },
    successText: { color: COLORS.success, fontSize: 12, fontWeight: '700' },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      flexWrap: 'wrap',
    },
    logoutButton: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: COLORS.errorBorder,
      backgroundColor: COLORS.errorBg,
      borderRadius: 10,
    },
    logoutText: { color: COLORS.error, fontSize: 12, fontWeight: '800' },
    saveButton: {
      minHeight: 46,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: {
      color: COLORS.onPrimary,
      fontSize: 12,
      fontWeight: '800',
    },
    pressed: { opacity: 0.75 },
    disabledText: { opacity: 0.6 },
    footer: { marginTop: 4 },
    footerText: { color: COLORS.muted, fontSize: 11, lineHeight: 18 },
  });

const styles = createStyles(getLumenPalette('dark'));
