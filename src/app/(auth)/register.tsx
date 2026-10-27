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
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setError('');
    if (!username.trim() || !password) {
      setError('Veuillez saisir un identifiant et un mot de passe.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    const result = await signUp(
      username,
      password,
      email.trim() || undefined,
      fullName.trim() || undefined,
    );
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.logoCircle}>
          <View style={styles.activityMark}>
            <View style={styles.activityLine} />
          </View>
        </View>
        <Text style={styles.brand}>LUMEN</Text>
        <Text style={styles.subtitle}>SUPERVISION ÉNERGÉTIQUE</Text>
        <View style={styles.card}>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.description}>
            Rejoignez LUMEN pour suivre vos centrales solaires en temps réel.
          </Text>

          <Text style={styles.label}>Nom complet</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Ex : Jean Rakoto"
            placeholderTextColor="#8492A6"
            editable={!loading}
            returnKeyType="next"
          />
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
          <Text style={styles.label}>Email (optionnel)</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="vous@exemple.com"
            placeholderTextColor="#8492A6"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!loading}
            returnKeyType="next"
          />
          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="8 caractères minimum"
            placeholderTextColor="#8492A6"
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
            returnKeyType="next"
          />
          <Text style={styles.label}>Confirmer le mot de passe</Text>
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Ressaisissez votre mot de passe"
            placeholderTextColor="#8492A6"
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
            returnKeyType="done"
            onSubmitEditing={handleRegister}
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
            onPress={handleRegister}
            disabled={loading}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#071B19" />
            ) : (
              <Text style={styles.buttonText}>Créer mon compte</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.replace('/(auth)/login')}
            disabled={loading}
            accessibilityRole="button"
          >
            <Text style={styles.link}>
              Vous avez déjà un compte ?{' '}
              <Text style={styles.linkBold}>Se connecter</Text>
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
    marginBottom: 28,
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
    marginBottom: 20,
  },
  label: {
    color: '#DCE5EF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 47,
    borderWidth: 1,
    borderColor: '#304256',
    backgroundColor: '#0B1724',
    color: '#F5F8FC',
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    fontSize: 15,
  },
  error: {
    color: '#FF8B8B',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
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
    marginTop: 18,
  },
});
