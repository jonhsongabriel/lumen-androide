/**
 * Écran « Projets » — portage mobile de ProjectsPage.tsx (Web).
 * Liste des sites : admin/technicien = tous, client = son projet.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@/contexts/auth';
import { apiList, type Site } from '@/services/lumen-api';
import { getAuthToken } from '@/services/session';
import {
  AlertBox,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingScreen,
  Screen,
  useLumenPalette,
} from '@/components/lumen-ui';

const STATUS = {
  operational: { label: 'Opérationnel', tone: 'success' as const, icon: '●' },
  alert: { label: 'Alerte', tone: 'warning' as const, icon: '▲' },
  offline: { label: 'Hors ligne', tone: 'error' as const, icon: '✕' },
};

export default function ProjectsScreen() {
  const COLORS = useLumenPalette();
  const router = useRouter();
  const { user } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canViewAllSites =
    user?.role === 'admin' || user?.role === 'engineer' || user?.role === 'technician';
  const canCreateSite = user?.role === 'admin' || user?.role === 'engineer';

  const load = useCallback(async () => {
    setError('');
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Aucune session active.');
      const rows = await apiList('sites', token);
      setSites(rows as unknown as Site[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des projets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  if (loading && sites.length === 0 && !error) {
    return <LoadingScreen COLORS={COLORS} label="Chargement des projets..." />;
  }

  return (
    <Screen
      COLORS={COLORS}
      title={canViewAllSites ? 'Tous les Projets' : 'Mon Projet'}
      subtitle={
        canViewAllSites
          ? `${sites.length} site(s) solaire(s) enregistré(s)`
          : "Consultez les informations de votre installation"
      }
    >
      {error ? <AlertBox COLORS={COLORS}>{error}</AlertBox> : null}

      {canCreateSite ? (
        <Button
          COLORS={COLORS}
          label="＋ Ajouter Centrale"
          onPress={() => router.push('/projects/add' as Href)}
        />
      ) : null}

      {sites.length === 0 && !error ? (
        <EmptyState
          COLORS={COLORS}
          icon="📍"
          message={
            canViewAllSites
              ? 'Aucun projet enregistré'
              : "Vous n'avez pas encore de projet assigné"
          }
        />
      ) : (
        <View style={styles.grid}>
          {sites.map((site) => {
            const status = (site.status ?? '').toLowerCase();
            const st =
              (Object.hasOwn(STATUS, status)
                ? STATUS[status as keyof typeof STATUS]
                : undefined) ?? {
                label: 'Inconnu',
                tone: 'muted' as const,
                icon: '○',
              };
            return (
              <Card key={site.id} COLORS={COLORS}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.siteName, { color: COLORS.text }]}>{site.name}</Text>
                  <Badge COLORS={COLORS} tone={st.tone} label={`${st.icon} ${st.label}`} />
                </View>
                <Text style={[styles.row, { color: COLORS.muted }]}>📍 {site.location}</Text>

                {site.capacity_kw != null ? (
                  <DetailRow label="Capacité" value={`${site.capacity_kw} kW`} COLORS={COLORS} />
                ) : null}
                {site.monitor_type ? (
                  <DetailRow
                    label="Moniteur"
                    value={`${site.monitor_type} ${site.monitor_model ?? ''}`}
                    COLORS={COLORS}
                  />
                ) : null}
                {site.wifi_ssid ? (
                  <DetailRow label="WiFi" value={site.wifi_ssid} COLORS={COLORS} />
                ) : null}
                {site.equipment_list && site.equipment_list.length > 0 ? (
                  <DetailRow
                    label="Équipements"
                    value={`${site.equipment_list.length} type(s)`}
                    COLORS={COLORS}
                  />
                ) : null}
                {site.scada_enabled ? (
                  <DetailRow
                    label="SCADA"
                    value={(site.scada_protocol ?? '').toUpperCase()}
                    COLORS={COLORS}
                  />
                ) : null}
                {site.last_communication ? (
                  <Text style={[styles.lastComm, { color: COLORS.muted }]}>
                    Dernière communication :{' '}
                    {new Date(site.last_communication).toLocaleString('fr-FR')}
                  </Text>
                ) : null}

                <Button
                  COLORS={COLORS}
                  variant="outline"
                  small
                  label="👁 Voir les données"
                  onPress={() => router.push(`/monitoring/${site.id}`)}
                />
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

function DetailRow({ label, value, COLORS }: { label: string; value: string; COLORS: ReturnType<typeof useLumenPalette> }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: COLORS.muted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: COLORS.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 12 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  siteName: { flex: 1, fontSize: 15, fontWeight: '800' },
  row: { fontSize: 11 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  detailLabel: { fontSize: 11, flex: 1 },
  detailValue: { fontSize: 12, fontWeight: '700', textAlign: 'right' },
  lastComm: { fontSize: 10 },
});
