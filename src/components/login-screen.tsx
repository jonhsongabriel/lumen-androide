
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

import { apiRequest } from '@/services/api';
import { saveAuthToken } from '@/services/session';

type LoginResponse = {
  token?: string;
  user?: {
    id?: string | number;
    username?: string;
    role?: string;
  };
  requires2FA?: boolean;
  tempToken?: string;
  error?: string;
  message?: string;
};

type LoginScreenProps = {
  onLoggedIn: (token: string) => void;
};

export default function LoginScreen({ onLoggedIn }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError('');

    if (!username.trim() || !password) {
      setError('Veuillez saisir votre identifiant et votre mot de passe.');
      return;
    }

    setLoading(true);

    try {
      const response = await apiRequest<LoginResponse>('auth/login', {
        method: 'POST',
        body: {
          username: username.trim(),
          password,
        },
      });

      if (response.requires2FA) {
        setError(
          'Une vérification en deux étapes est requise. La prise en charge de cette vérification sera ajoutée ensuite.',
        );
        return;
      }

      if (!response.token) {
        throw new Error(
          response.message || response.error || 'Le serveur n’a pas retourné de jeton.',
        );
      }

      await saveAuthToken(response.token);
      onLoggedIn(response.token);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Connexion impossible. Vérifiez votre réseau et vos identifiants.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.logoCircle}>
          <ActivityIndicator
            animating={false}
            size="small"
            color="#38D9A9"
          />
          <ActivityMark />
        </View>

        <Text style={styles.brand}>LUMEN</Text>
        <Text style={styles.subtitle}>SUPERVISION ÉNERGÉTIQUE</Text>

        <View style={styles.card}>
          <Text style={styles.title}>Bienvenue</Text>
          <Text style={styles.description}>
            Connectez-vous pour accéder à vos centrales.
          </Text>

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
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#071B19" />
            ) : (
              <Text style={styles.buttonText}>Se connecter</Text>
            )}
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
  footer: {
    color: '#8293A8',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 22,
  },
});