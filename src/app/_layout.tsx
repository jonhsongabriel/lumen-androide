
import { useEffect } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/contexts/auth';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Redirige vers /login si aucune session, sinon vers l'app. */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!token && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (token && inAuthGroup) {
      router.replace('/');
    }
  }, [token, loading, segments, router]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#38D9A9" />
        <Text style={styles.loadingText}>
          Vérification de la session...
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? styles.darkBg : styles.lightBg;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <AuthProvider>
      <View style={[styles.container, theme]}>
        <Head>
          <title>LUMEN — Supervision énergétique</title>
          <meta name="description" content="Supervision énergétique LUMEN : suivez vos centrales solaires en temps réel." />
        </Head>
        <StatusBar style="auto" />
        <AuthGate>
          <Slot />
        </AuthGate>
      </View>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  lightBg: { backgroundColor: '#F8FAFC' },
  darkBg: { backgroundColor: '#151D28' },
  loading: {
    flex: 1,
    backgroundColor: '#08131F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#DCE5EF',
    marginTop: 14,
    fontSize: 14,
  },
});