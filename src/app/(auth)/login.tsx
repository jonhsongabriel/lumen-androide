import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth';

export default function LoginScreen() {
  const { signIn, verifyTwoFactorLogin } = useAuth();
  const router = useRouter();
  const { siteId } = useLocalSearchParams<{ siteId?: string }>();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [twoFaStep, setTwoFaStep] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [code, setCode] = useState('');

  async function handleLogin() {
    setError('');
    if (!username.trim() || !password) {
      setError('Veuillez saisir votre identifiant et votre mot de passe.');
      return;
    }
    setLoading(true);
    const result = await signIn(username, password);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (result.requires2FA && result.tempToken) {
      setTempToken(result.tempToken);
      setTwoFaStep(true);
      return;
    }
    router.replace(siteId ? `/monitoring/${siteId}` : '/');
  }

  async function handleVerify2FA() {
    setError('');
    if (code.trim().length < 6) {
      setError('Entrez le code à 6 chiffres de votre application.');
      return;
    }
    setLoading(true);
    const result = await verifyTwoFactorLogin(tempToken, code.trim());
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    router.replace(siteId ? `/monitoring/${siteId}` : '/');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.logoCircle}>
          <ActivityIndicator animating={false} size="small" color="#38D9A9" />
          <ActivityMark />
        </View>
        <Text style={styles.brand}>LUMEN</Text>
        <Text style={styles.subtitle}>SUPERVISION ÉNERGÉTIQUE</Text>
        <View style={styles.card}>
          <Text style={styles.title}>
            {twoFaStep ? 'Vérification en 2 étapes' : 'Bienvenue'}
          </Text>
          <Text style={styles.description}>
            {twoFaStep
              ? "Saisissez le code de votre application d'authentification."
              : 'Connectez-vous pour accéder à vos centrales.'}
          </Text>

          {twoFaStep ? (
            <>
              <Text style={styles.label}>Code de vérification</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor="#8492A6"
                keyboardType="number-pad"
                maxLength={6}
                editable={!loading}
                onSubmitEditing={handleVerify2FA}
              />
              <Pressable
                onPress={() => {
                  setTwoFaStep(false);
                  setCode('');
                  setError('');
                }}
                accessibilityRole="button"
              >
                <Text style={styles.backLink}>Retour à la connexion</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.label}>Identifiant</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Votre identifiant"
                placeholderTextColor="#8492A6"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                returnKeyType="next"
              />
              <Text style={styles.label}>Mot de passe</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Votre mot de passe"
                placeholderTextColor="#8492A6"
                secureTextEntry
                autoCapitalize="none"
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </>
          )}

          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              (loading || pressed) && styles.buttonDimmed,
            ]}
            onPress={twoFaStep ? handleVerify2FA : handleLogin}
            disabled={loading}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#071B19" />
            ) : (
              <Text style={styles.buttonText}>
                {twoFaStep ? 'Vérifier le code' : 'Se connecter'}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.replace('/(auth)/register')}
            disabled={loading}
            accessibilityRole="button"
          >
            <Text style={styles.link}>
              Pas encore de compte ?{' '}
              <Text style={styles.linkBold}>Créer un compte</Text>
            </Text>
          </Pressable>
          <Text style={styles.footer}>
            Accès sécurisé à votre plateforme énergétique.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function ActivityMark() {
  return (
    <View style={styles.activityMark}>
      <View style={styles.activityLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08131F',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#122A32',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  activityMark: {
    position: 'absolute',
    width: 25,
    height: 18,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderColor: '#38D9A9',
    transform: [{ rotate: '-35deg' }],
  },
  activityLine: {
    position: 'absolute',
    left: 5,
    top: 4,
    width: 19,
    borderTopWidth: 3,
    borderColor: '#38D9A9',
  },
  brand: {
    color: '#F5F8FC',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 5,
    textAlign: 'center',
  },
  subtitle: {
    color: '#8293A8',
    fontSize: 10,
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 7,
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#111F2E',
    borderColor: '#243548',
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
  },
  title: {
    color: '#F5F8FC',
    fontSize: 25,
    fontWeight: '700',
  },
  description: {
    color: '#9BAABC',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 24,
  },
  label: {
    color: '#DCE5EF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 49,
    borderWidth: 1,
    borderColor: '#304256',
    backgroundColor: '#0B1724',
    color: '#F5F8FC',
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 18,
    fontSize: 15,
  },
  error: {
    color: '#FF8B8B',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  button: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: '#38D9A9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDimmed: {
    opacity: 0.75,
  },
  buttonText: {
    color: '#071B19',
    fontSize: 15,
    fontWeight: '800',
  },
  backLink: {
    color: '#38D9A9',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 16,
  },
  link: {
    color: '#8293A8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
  },
  linkBold: {
    color: '#38D9A9',
    fontWeight: '700',
  },
  footer: {
    color: '#8293A8',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 22,
  },
});
