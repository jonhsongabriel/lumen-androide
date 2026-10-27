import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  AlertBox,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LoadingScreen,
  Screen,
  Select,
  useLumenPalette,
} from '@/components/lumen-ui';
import { useAuth } from '@/contexts/auth';
import { normalizeMonitoring, normalizeSite } from '@/features/dashboard/normalize';
import type { Monitoring } from '@/features/dashboard/types';
import { apiList, devicesApi, extractArray, monitoringApi } from '@/services/lumen-api';
import { apiRequest } from '@/services/api';
import { LineChartCard } from '@/components/line-chart-card';

type SiteOption = { id: string; name: string; location: string; isOffline: boolean };
type Row = Record<string, unknown>;

function valueOf(value: unknown, fallback = ''): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : fallback;
}

function normalizeSites(rows: Row[]): SiteOption[] {
  return rows.flatMap((row) => {
    const site = normalizeSite(row);
    if (!site) return [];
    return [{
      id: site.id,
      name: site.name,
      location: site.location,
      isOffline: site.isOffline,
    }];
  });
}

function authToken(token: string | null): string {
  if (!token) throw new Error('Aucune session active. Reconnectez-vous.');
  return token;
}

function localDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDateInput(date: string, amount: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(year, month - 1, day + amount);
  return localDateInput(shifted);
}

function dateBounds(from: string, to: string): { start: string; end: string } {
  const [startYear, startMonth, startDay] = from.split('-').map(Number);
  const [endYear, endMonth, endDay] = to.split('-').map(Number);
  return {
    start: new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0).toISOString(),
    end: new Date(endYear, endMonth - 1, endDay + 1, 0, 0, 0, 0).toISOString(),
  };
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sampleHistoryRows(rows: HistoryRow[], maxPoints: number): HistoryRow[] {
  if (rows.length <= maxPoints) return rows;
  const stride = Math.ceil((rows.length - 1) / (maxPoints - 1));
  const sampled = rows.filter((_, index) => index % stride === 0);
  const last = rows[rows.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

async function fetchMonitoringRows(
  siteId: string,
  deviceId: string | undefined,
  start: string,
  end: string,
  token: string,
): Promise<HistoryRow[]> {
  const pageSize = 5000;
  const rows: HistoryRow[] = [];
  let offset = 0;
  while (true) {
    const response = await monitoringApi.getBySite(
      siteId,
      pageSize,
      offset,
      deviceId,
      start,
      end,
      token,
    );
    const page = extractArray(response) as HistoryRow[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
    offset += page.length;
  }
}

function SitePicker({
  COLORS,
  sites,
  selected,
  onChange,
}: {
  COLORS: ReturnType<typeof useLumenPalette>;
  sites: SiteOption[];
  selected: string;
  onChange: (id: string) => void;
}) {
  return (
    <Select
      COLORS={COLORS}
      value={selected}
      onChange={onChange}
      options={sites.map((site) => ({ value: site.id, label: site.name }))}
      disabled={sites.length === 0}
    />
  );
}

const links: {
  title: string;
  description: string;
  href: string;
  roles?: string[];
}[] = [
  { title: 'Projets', description: 'Consulter les centrales solaires', href: '/projects' },
  { title: 'Ajouter une centrale', description: 'Enregistrer un nouveau site', href: '/projects/add', roles: ['admin', 'engineer'] },
  { title: 'Relier un appareil', description: 'Gérer les appareils SCADA et ESP32', href: '/connect', roles: ['admin', 'engineer', 'technician'] },
  { title: 'Temps réel', description: 'Suivre les mesures de production', href: '/realtime' },
  { title: 'Deye Cloud', description: 'Onduleurs Deye — temps réel, énergie et contrôle', href: '/deye' },
  { title: 'Supervision', description: 'Ouvrir le détail d’une centrale', href: '/monitoring' },
  { title: 'Comparaison', description: 'Comparer production et alertes', href: '/compare' },
  { title: 'Historique et rapports', description: 'Consulter et partager les relevés', href: '/history' },
  { title: 'Configuration', description: 'Paramètres et journal d’audit', href: '/configuration', roles: ['admin', 'engineer'] },
  { title: 'Gestion des utilisateurs', description: 'Rôles et attribution des sites', href: '/users', roles: ['admin'] },
  { title: 'Notifications', description: 'Alertes et leur état de traitement', href: '/notifications' },
  { title: 'Messages', description: 'Boîte de réception de l’équipe', href: '/messages', roles: ['admin', 'technician'] },
  { title: 'Contacter le support', description: 'Envoyer un message à l’équipe technique', href: '/contact' },
  { title: 'Profil', description: 'Compte et sécurité', href: '/profile' },
];

export function MoreScreen() {
  const COLORS = useLumenPalette();
  const router = useRouter();
  const { user } = useAuth();
  const navigate = (href: string) => router.push(href as Href);
  return (
    <Screen COLORS={COLORS} title="Plus" subtitle="Tous les outils de supervision LUMEN">
      {links.filter((link) => !link.roles || (user?.role && link.roles.includes(user.role))).map((link) => (
        <Pressable key={link.href} onPress={() => navigate(link.href)}>
          <Card COLORS={COLORS}>
            <Text style={[s.title, { color: COLORS.text }]}>{link.title}</Text>
            <Text style={[s.subtitle, { color: COLORS.muted }]}>{link.description}</Text>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

export function ContactScreen() {
  const COLORS = useLumenPalette();
  const { token } = useAuth();
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const send = async () => {
    setError('');
    setNotice('');
    if (!content.trim()) {
      setError('Écrivez un message avant de l’envoyer.');
      return;
    }
    setBusy(true);
    try {
      await apiRequest('messages', {
        method: 'POST',
        token: authToken(token),
        body: { subject: subject.trim() || undefined, content: content.trim() },
      });
      setSubject('');
      setContent('');
      setNotice('Message envoyé. L’équipe vous répondra dès que possible.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’envoi du message.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen COLORS={COLORS} title="Contacter le support" subtitle="Votre compte sera transmis avec votre message">
      {notice ? <AlertBox COLORS={COLORS} tone="success">{notice}</AlertBox> : null}
      {error ? <AlertBox COLORS={COLORS}>{error}</AlertBox> : null}
      <Card COLORS={COLORS} title="Nouveau message">
        <Field COLORS={COLORS} label="Sujet (facultatif)">
          <Input COLORS={COLORS} value={subject} onChangeText={setSubject} placeholder="Question, panne, demande…" />
        </Field>
        <Field COLORS={COLORS} label="Message">
          <Input COLORS={COLORS} value={content} onChangeText={setContent} multiline placeholder="Décrivez votre demande…" />
        </Field>
        <Button COLORS={COLORS} label="Envoyer" onPress={() => void send()} loading={busy} />
      </Card>
    </Screen>
  );
}

type ProjectForm = {
  name: string;
  location: string;
  capacity: string;
  type: string;
  cloudSource: string;
  installationDate: string;
  latitude: string;
  longitude: string;
  description: string;
  serial: string;
  devicePassword: string;
  scadaEnabled: string;
  scadaProtocol: string;
  wifi: string;
  wifiPassword: string;
  wifiIp: string;
  monitor: string;
  model: string;
  monitorSerial: string;
  solarmanAppId: string;
  solarmanAppSecret: string;
  solarmanEmail: string;
  solarmanPassword: string;
  solarmanSiteId: string;
  deyeSerial: string;
  deyeEmail: string;
  deyePassword: string;
};

const emptyProject: ProjectForm = {
  name: '', location: '', capacity: '', type: 'hybride', cloudSource: 'deye', installationDate: '',
  latitude: '', longitude: '', description: '', serial: '', devicePassword: '',
  scadaEnabled: 'true', scadaProtocol: 'modbus', wifi: '', wifiPassword: '', wifiIp: '',
  monitor: '', model: '', monitorSerial: '', solarmanAppId: '', solarmanAppSecret: '',
  solarmanEmail: '', solarmanPassword: '', solarmanSiteId: '',
  deyeSerial: '', deyeEmail: '', deyePassword: '',
};

type EquipmentDraft = { type: string; brand: string; model: string; count: string; capacity: string };

export function AddProjectScreen() {
  const COLORS = useLumenPalette();
  const router = useRouter();
  const { token, user } = useAuth();
  const [form, setForm] = useState(emptyProject);
  const [equipment, setEquipment] = useState<EquipmentDraft[]>([
    { type: 'onduleur', brand: '', model: '', count: '1', capacity: '' },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canCreate = user?.role === 'admin' || user?.role === 'engineer';

  const update = (key: keyof ProjectForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setError('');
    if (!form.name.trim() || !form.location.trim()) {
      setError('Le nom et l’emplacement sont obligatoires.');
      return;
    }
    for (const [label, raw] of [
      ['Capacité', form.capacity],
      ['Latitude', form.latitude],
      ['Longitude', form.longitude],
    ]) {
      if (raw.trim() && !Number.isFinite(Number(raw))) {
        setError(`${label} doit être un nombre valide.`);
        return;
      }
    }
    if (Number(form.capacity) < 0) {
      setError('La capacité ne peut pas être négative.');
      return;
    }
    if (form.latitude && (Number(form.latitude) < -90 || Number(form.latitude) > 90)) {
      setError('La latitude doit être comprise entre -90 et 90.');
      return;
    }
    if (form.longitude && (Number(form.longitude) < -180 || Number(form.longitude) > 180)) {
      setError('La longitude doit être comprise entre -180 et 180.');
      return;
    }
    if (equipment.some((item) => item.count.trim() && (!Number.isInteger(Number(item.count)) || Number(item.count) < 1))) {
      setError('Le nombre d’équipements doit être un entier positif.');
      return;
    }
    if (equipment.some((item) => item.capacity.trim() && (!Number.isFinite(Number(item.capacity)) || Number(item.capacity) < 0))) {
      setError('La capacité de chaque équipement doit être un nombre positif.');
      return;
    }
    setBusy(true);
    try {
      await apiRequest('sites', {
        method: 'POST',
        token: authToken(token),
        body: {
          name: form.name.trim(),
          location: form.location.trim(),
          system_type: form.type,
          cloud_source: form.cloudSource,
          capacity_kw: form.capacity.trim() ? Number(form.capacity) : null,
          installation_date: form.installationDate || null,
          latitude: form.latitude.trim() ? Number(form.latitude) : null,
          longitude: form.longitude.trim() ? Number(form.longitude) : null,
          description: form.description.trim() || null,
          serial_number: form.serial.trim() || null,
          password: form.devicePassword.trim() || null,
          scada_enabled: form.scadaEnabled === 'true',
          scada_protocol: form.scadaProtocol,
          wifi_ssid: form.wifi.trim() || null,
          wifi_password: form.wifiPassword.trim() || null,
          wifi_ip: form.wifiIp.trim() || null,
          monitor_type: form.monitor.trim() || null,
          monitor_model: form.model.trim() || null,
          monitor_serial: form.monitorSerial.trim() || null,
          mqtt_topic_prefix: 'centrale',
          equipment_list: equipment
            .filter((item) => item.brand.trim() && item.model.trim())
            .map((item) => ({
              type: item.type,
              brand: item.brand.trim(),
              model: item.model.trim(),
              count: Number(item.count) || 1,
              capacity_w: item.capacity.trim() ? Number(item.capacity) : undefined,
            })),
          solarman_app_id: form.cloudSource === 'solarman' ? form.solarmanAppId.trim() || null : null,
          solarman_app_secret: form.cloudSource === 'solarman' ? form.solarmanAppSecret.trim() || null : null,
          solarman_email: form.cloudSource === 'solarman' ? form.solarmanEmail.trim() || null : null,
          solarman_password: form.cloudSource === 'solarman' ? form.solarmanPassword || null : null,
          solarman_site_id: form.cloudSource === 'solarman' ? form.solarmanSiteId.trim() || null : null,
          deye_serial: form.cloudSource === 'deye' || form.cloudSource === 'hybride'
            ? form.deyeSerial.trim() || null
            : null,
          deye_email: form.cloudSource === 'deye' || form.cloudSource === 'hybride'
            ? form.deyeEmail.trim() || null
            : null,
          deye_password: form.cloudSource === 'deye' || form.cloudSource === 'hybride'
            ? form.deyePassword || null
            : null,
        },
      });
      router.replace('/projects' as Href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du projet.');
    } finally {
      setBusy(false);
    }
  };

  if (!canCreate) {
    return <Screen COLORS={COLORS} title="Nouveau projet"><AlertBox COLORS={COLORS}>Seuls les administrateurs et ingénieurs peuvent créer une centrale.</AlertBox></Screen>;
  }

  const fields: { key: keyof ProjectForm; label: string; numeric?: boolean; secure?: boolean; solarman?: boolean; deye?: boolean }[] = [
    { key: 'name', label: 'Nom *' },
    { key: 'location', label: 'Emplacement *' },
    { key: 'capacity', label: 'Capacité installée (kW)', numeric: true },
    { key: 'installationDate', label: 'Date d’installation (AAAA-MM-JJ)' },
    { key: 'latitude', label: 'Latitude', numeric: true },
    { key: 'longitude', label: 'Longitude', numeric: true },
    { key: 'description', label: 'Description' },
    { key: 'serial', label: 'Numéro de série SCADA' },
    { key: 'devicePassword', label: 'Mot de passe de l’appareil SCADA', secure: true },
    { key: 'wifi', label: 'Réseau Wi-Fi' },
    { key: 'wifiPassword', label: 'Mot de passe Wi-Fi', secure: true },
    { key: 'wifiIp', label: 'Adresse IP Wi-Fi' },
    { key: 'monitor', label: 'Type de moniteur' },
    { key: 'model', label: 'Modèle du moniteur' },
    { key: 'monitorSerial', label: 'Numéro de série du moniteur' },
    { key: 'solarmanAppId', label: 'Solarman App ID', solarman: true },
    { key: 'solarmanAppSecret', label: 'Solarman App Secret', solarman: true, secure: true },
    { key: 'solarmanEmail', label: 'Compte Solarman', solarman: true },
    { key: 'solarmanPassword', label: 'Mot de passe Solarman', solarman: true, secure: true },
    { key: 'solarmanSiteId', label: 'Identifiant du site Solarman', solarman: true },
    { key: 'deyeSerial', label: 'Numéro de série onduleur Deye (SN)', deye: true },
    { key: 'deyeEmail', label: 'Compte Deye Cloud', deye: true },
    { key: 'deyePassword', label: 'Mot de passe Deye Cloud', deye: true, secure: true },
  ];

  return (
    <Screen COLORS={COLORS} title="Nouveau projet" subtitle="Ajouter une centrale solaire et ses informations" back="Projets" onBack={() => router.back()}>
      {error ? <AlertBox COLORS={COLORS}>{error}</AlertBox> : null}
      <Card COLORS={COLORS} title="Informations générales">
        <Field COLORS={COLORS} label="Plateforme cloud / source de données">
          <Select COLORS={COLORS} value={form.cloudSource} onChange={(source) => update('cloudSource', source)} options={[
            { value: 'deye', label: 'Deye Cloud (onduleurs Deye, via API officielle)' },
            { value: 'solarman', label: 'Solarman (onduleurs Solarman/Sofar)' },
            { value: 'esp32', label: 'ESP32 (SCADA direct — Modbus/MQTT, sans cloud)' },
            { value: 'hybride', label: 'Hybride (cloud + ESP32)' },
            { value: 'manual', label: 'Manuel (aucune connexion automatique)' },
          ]} />
          <Text style={{ color: COLORS.muted, fontSize: 10, marginTop: 4 }}>
            {form.cloudSource === 'deye'
              ? 'Les relevés proviendront du cloud Deye via le serveur LUMEN.'
              : form.cloudSource === 'solarman'
                ? 'Les relevés proviendront de l\'API Solarman (champs ci-dessous).'
                : form.cloudSource === 'esp32'
                  ? 'L\'ESP32 enverra les mesures directement au serveur LUMEN (Modbus/MQTT).'
                  : form.cloudSource === 'hybride'
                    ? 'Combinaison cloud Deye/Solarman + ESP32 pour la redondance.'
                    : 'Aucune connexion automatique — saisie manuelle des relevés.'}
          </Text>
        </Field>
        <Field COLORS={COLORS} label="Type d’installation">
          <Select COLORS={COLORS} value={form.type} onChange={(type) => update('type', type)} options={[
            { value: 'isole', label: 'Isolé' },
            { value: 'autonome', label: 'Autonome' },
            { value: 'hybride', label: 'Hybride' },
            { value: 'hybride_ge', label: 'Hybride + GE' },
            { value: 'injection', label: 'Injection' },
          ]} />
        </Field>
        {form.cloudSource === 'esp32' || form.cloudSource === 'hybride' ? (
          <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>
            ⓘ ESP32 sélectionné : renseignez la section SCADA/ESP32 ci-dessous
            (numéro de série, protocole Modbus ou MQTT, Wi-Fi).
          </Text>
        ) : null}
        {fields.map((field) => (
          (field.solarman === true && form.cloudSource === 'solarman') ||
          (field.deye === true && form.cloudSource === 'deye') ||
          (!field.solarman && !field.deye) ? (
          <Field key={field.key} COLORS={COLORS} label={field.label}>
            <Input
              COLORS={COLORS}
              value={form[field.key]}
              onChangeText={(value) => update(field.key, value)}
              keyboardType={field.numeric ? 'decimal-pad' : 'default'}
              multiline={field.key === 'description'}
              secure={field.secure}
              placeholder={field.key === 'capacity' ? 'Ex. 12.5' : undefined}
            />
          </Field>
          ) : null
        ))}
      </Card>
      <Card COLORS={COLORS} title="SCADA / ESP32">
        <Field COLORS={COLORS} label="Connexion SCADA">
          <Select COLORS={COLORS} value={form.scadaEnabled} onChange={(enabled) => update('scadaEnabled', enabled)} options={[
            { value: 'true', label: 'Activée' },
            { value: 'false', label: 'Désactivée' },
          ]} />
        </Field>
        <Field COLORS={COLORS} label="Protocole SCADA">
          <Select COLORS={COLORS} value={form.scadaProtocol} onChange={(protocol) => update('scadaProtocol', protocol)} options={[
            { value: 'modbus', label: 'Modbus' },
            { value: 'mqtt', label: 'MQTT' },
          ]} />
        </Field>
      </Card>
      <Card COLORS={COLORS} title="Équipements">
        {equipment.map((item, index) => (
          <View key={index} style={s.equipment}>
            <Field COLORS={COLORS} label={`Équipement ${index + 1} — type`}>
              <Select COLORS={COLORS} value={item.type} onChange={(type) => setEquipment((current) => current.map((entry, i) => i === index ? { ...entry, type } : entry))} options={[
                { value: 'onduleur', label: 'Onduleur' },
                { value: 'panneau', label: 'Panneau' },
                { value: 'batterie', label: 'Batterie' },
                { value: 'autre', label: 'Autre' },
              ]} />
            </Field>
            {([
              ['brand', 'Marque'],
              ['model', 'Modèle'],
              ['count', 'Quantité'],
              ['capacity', 'Capacité par unité (W)'],
            ] as const).map(([key, label]) => (
              <Field key={key} COLORS={COLORS} label={label}>
                <Input
                  COLORS={COLORS}
                  value={item[key]}
                  onChangeText={(value) => setEquipment((current) => current.map((entry, i) => i === index ? { ...entry, [key]: value } : entry))}
                  keyboardType={key === 'count' || key === 'capacity' ? 'decimal-pad' : 'default'}
                />
              </Field>
            ))}
            {equipment.length > 1 ? (
              <Button COLORS={COLORS} label="Retirer cet équipement" variant="danger" small onPress={() => setEquipment((current) => current.filter((_, i) => i !== index))} />
            ) : null}
          </View>
        ))}
        <Button COLORS={COLORS} label="＋ Ajouter un équipement" variant="outline" onPress={() => setEquipment((current) => [...current, { type: 'panneau', brand: '', model: '', count: '1', capacity: '' }])} />
      </Card>
      <Button COLORS={COLORS} label="Créer la centrale" onPress={() => void submit()} loading={busy} />
    </Screen>
  );
}

type DeviceRow = { id: string; device_name?: string | null; serial_number: string; device_type?: string };

export function ConnectScreen() {
  const COLORS = useLumenPalette();
  const { token, user } = useAuth();
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [siteId, setSiteId] = useState('');
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [name, setName] = useState('');
  const [serial, setSerial] = useState('');
  const [password, setPassword] = useState('');
  const [deviceType, setDeviceType] = useState('esp32');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const allowed = ['admin', 'engineer', 'technician'].includes(user?.role ?? '');

  const loadDevices = useCallback(async (id: string) => {
    if (!id) return setDevices([]);
    const response = await apiRequest<unknown>(`devices/site/${encodeURIComponent(id)}`, { token: authToken(token) });
    setDevices(extractArray(response).map((row) => ({
      id: valueOf(row.id),
      device_name: valueOf(row.device_name) || null,
      serial_number: valueOf(row.serial_number),
      device_type: valueOf(row.device_type),
    })).filter((row) => row.id && row.serial_number));
  }, [token]);

  useEffect(() => {
    let active = true;
    void apiList('sites', authToken(token))
      .then((rows) => {
        if (!active) return;
        const options = normalizeSites(rows);
        setSites(options);
        setSiteId(options[0]?.id ?? '');
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Chargement des centrales impossible.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDevices(siteId).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Chargement des appareils impossible.'));
    }, 0);
    return () => clearTimeout(timer);
  }, [siteId, loadDevices]);

  const addDevice = async () => {
    if (!serial.trim()) return setError('Le numéro de série est obligatoire.');
    setBusy(true);
    setError('');
    try {
      await apiRequest(`devices/site/${encodeURIComponent(siteId)}`, {
        method: 'POST',
        token: authToken(token),
        body: { serial_number: serial.trim(), device_name: name.trim() || undefined, password: password.trim() || undefined, device_type: deviceType },
      });
      setName('');
      setSerial('');
      setPassword('');
      await loadDevices(siteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de relier cet appareil.');
    } finally {
      setBusy(false);
    }
  };

  const removeDevice = async (id: string) => {
    setError('');
    try {
      await apiRequest(`devices/${encodeURIComponent(id)}`, { method: 'DELETE', token: authToken(token) });
      await loadDevices(siteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de supprimer cet appareil.');
    }
  };

  if (loading) return <LoadingScreen COLORS={COLORS} label="Chargement des centrales…" />;
  if (!allowed) return <Screen COLORS={COLORS} title="Relier un appareil"><AlertBox COLORS={COLORS}>Accès réservé à l’équipe de supervision.</AlertBox></Screen>;

  return (
    <Screen COLORS={COLORS} title="Relier un appareil" subtitle="Gérer les appareils SCADA, ESP32 et Deye">
      {error ? <AlertBox COLORS={COLORS}>{error}</AlertBox> : null}
      {sites.length === 0 ? <EmptyState COLORS={COLORS} icon="⌁" message="Aucune centrale disponible." /> : (
        <>
          <Card COLORS={COLORS} title="Centrale">
            <SitePicker COLORS={COLORS} sites={sites} selected={siteId} onChange={setSiteId} />
          </Card>
          <Card COLORS={COLORS} title="Ajouter un appareil">
            <Field COLORS={COLORS} label="Type">
              <Select COLORS={COLORS} value={deviceType} onChange={setDeviceType} options={[
                { value: 'esp32', label: 'ESP32 (MQTT)' },
                { value: 'deye_cloud', label: 'Deye Cloud' },
              ]} />
            </Field>
            <Field COLORS={COLORS} label="Nom de l’appareil"><Input COLORS={COLORS} value={name} onChangeText={setName} /></Field>
            <Field COLORS={COLORS} label="Numéro de série *"><Input COLORS={COLORS} value={serial} onChangeText={setSerial} /></Field>
            <Field COLORS={COLORS} label="Mot de passe (si nécessaire)"><Input COLORS={COLORS} value={password} onChangeText={setPassword} secure /></Field>
            <Button COLORS={COLORS} label="Relier l’appareil" onPress={() => void addDevice()} loading={busy} />
          </Card>
          <Card COLORS={COLORS} title={`Appareils reliés (${devices.length})`}>
            {devices.length === 0 ? <Text style={{ color: COLORS.muted }}>Aucun appareil associé.</Text> : devices.map((device) => (
              <View key={device.id} style={s.row}>
                <View style={s.flex}>
                  <Text style={[s.title, { color: COLORS.text }]}>{device.device_name || device.serial_number}</Text>
                  <Text style={{ color: COLORS.muted, fontSize: 11 }}>{device.device_type} · {device.serial_number}</Text>
                </View>
                <Button COLORS={COLORS} label="Supprimer" variant="danger" small onPress={() => void removeDevice(device.id)} />
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

export function MonitoringIndexScreen() {
  const COLORS = useLumenPalette();
  const router = useRouter();
  const { token } = useAuth();
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void apiList('sites', authToken(token))
      .then((rows) => {
        if (active) setSites(normalizeSites(rows));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Chargement des centrales impossible.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  return (
    <Screen COLORS={COLORS} title="Supervision" subtitle="Choisissez une centrale pour consulter ses mesures détaillées">
      {error ? <AlertBox COLORS={COLORS}>{error}</AlertBox> : null}
      {loading ? <ActivityIndicator color={COLORS.primary} /> : sites.length === 0 ? (
        <EmptyState COLORS={COLORS} icon="◉" message="Aucune centrale disponible." />
      ) : sites.map((site) => (
        <Pressable key={site.id} onPress={() => router.push(`/monitoring/${site.id}`)}>
          <Card COLORS={COLORS}>
            <Text style={[s.title, { color: COLORS.text }]}>{site.name}</Text>
            <Text style={{ color: COLORS.muted, fontSize: 12 }}>{site.location}</Text>
            <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '700' }}>Voir la supervision →</Text>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

type EnergyBucket = {
  key: string;
  label: string;
  production: number;
  consumption: number;
  charged: number;
  discharged: number;
  bought: number;
  injected: number;
};

type EnergyRange = 'month' | 'year' | 'total';

function asEnergyBucket(row: Row, key: string, label: string): EnergyBucket {
  return {
    key,
    label,
    production: numberValue(row.production_kwh) ?? 0,
    consumption: numberValue(row.consumption_kwh) ?? 0,
    charged: numberValue(row.charged_kwh) ?? 0,
    discharged: numberValue(row.discharged_kwh) ?? 0,
    bought: numberValue(row.bought_kwh) ?? 0,
    injected: numberValue(row.injected_kwh) ?? 0,
  };
}

function energyDateKey(timestamp: unknown, length: number): string {
  const value = valueOf(timestamp);
  if (!value) return '';
  if (length === 4) return value.slice(0, 4);
  if (length === 7) return value.slice(0, 7);
  return value.slice(0, 10);
}

function EnergyHistoryCard({
  COLORS,
  siteId,
  deviceId,
  token,
}: {
  COLORS: ReturnType<typeof useLumenPalette>;
  siteId: string;
  deviceId?: string;
  token: string | null;
}) {
  const [range, setRange] = useState<EnergyRange>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [buckets, setBuckets] = useState<EnergyBucket[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!siteId || !token) return;
    let active = true;
    const tokenValue = token;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        let start: Date;
        let end: Date;
        let bucket: 'day' | 'month' | 'year';
        if (range === 'month') {
          start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
          end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
          bucket = 'day';
        } else if (range === 'year') {
          start = new Date(anchor.getFullYear(), 0, 1);
          end = new Date(anchor.getFullYear() + 1, 0, 1);
          bucket = 'month';
        } else {
          start = new Date(anchor.getFullYear() - 5, 0, 1);
          end = new Date(anchor.getFullYear() + 1, 0, 1);
          bucket = 'year';
        }
        const response = await monitoringApi.getEnergyBreakdown(
          siteId,
          start.toISOString(),
          end.toISOString(),
          bucket,
          deviceId,
          tokenValue,
        );
        if (!active) return;
        const sourceRows = extractArray(response);
        const rowsByKey = new Map(
          sourceRows.map((row) => [
            energyDateKey(row.bucket_start, range === 'year' ? 7 : range === 'total' ? 4 : 10),
            row,
          ]),
        );
        let nextBuckets: EnergyBucket[];
        if (range === 'month') {
          const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
          nextBuckets = Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const key = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            return asEnergyBucket(rowsByKey.get(key) ?? {}, key, String(day));
          });
        } else if (range === 'year') {
          const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
          nextBuckets = months.map((label, index) => {
            const key = `${anchor.getFullYear()}-${String(index + 1).padStart(2, '0')}`;
            return asEnergyBucket(rowsByKey.get(key) ?? {}, key, label);
          });
        } else {
          nextBuckets = Array.from({ length: 6 }, (_, index) => {
            const year = anchor.getFullYear() - 5 + index;
            return asEnergyBucket(rowsByKey.get(String(year)) ?? {}, String(year), String(year));
          });
        }
        setBuckets(nextBuckets);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Impossible de charger l’historique énergétique.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [siteId, deviceId, token, range, anchor]);

  const totals = buckets.reduce((sum, row) => ({
    production: sum.production + row.production,
    consumption: sum.consumption + row.consumption,
    charged: sum.charged + row.charged,
    discharged: sum.discharged + row.discharged,
    bought: sum.bought + row.bought,
    injected: sum.injected + row.injected,
  }), { production: 0, consumption: 0, charged: 0, discharged: 0, bought: 0, injected: 0 });
  const hasEnergyData = buckets.some((row) =>
    row.production !== 0 || row.consumption !== 0 || row.charged !== 0
      || row.discharged !== 0 || row.bought !== 0 || row.injected !== 0,
  );
  const maxEnergy = Math.max(1, ...buckets.flatMap((row) => [row.production, row.consumption]));
  const periodLabel = range === 'month'
    ? anchor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : range === 'year'
      ? String(anchor.getFullYear())
      : `${anchor.getFullYear() - 5}–${anchor.getFullYear()}`;

  const shareCsv = async () => {
    setExporting(true);
    setError('');
    try {
      const csv = [
        'Période;Production estimée (kWh);Consommation estimée (kWh);Charge batterie (kWh);Décharge batterie (kWh);Achat réseau (kWh);Injection réseau (kWh)',
        ...buckets.map((row) => [
          row.key,
          row.production.toFixed(2),
          row.consumption.toFixed(2),
          row.charged.toFixed(2),
          row.discharged.toFixed(2),
          row.bought.toFixed(2),
          row.injected.toFixed(2),
        ].join(';')),
      ].join('\n');
      await Share.share({ title: `Historique énergétique - ${periodLabel}`, message: csv });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de partager le résumé énergétique.');
    } finally {
      setExporting(false);
    }
  };

  const shift = (amount: number) => setAnchor((date) => {
    const next = new Date(date);
    if (range === 'month') next.setMonth(next.getMonth() + amount);
    else next.setFullYear(next.getFullYear() + amount);
    return next;
  });

  return (
    <Card COLORS={COLORS} title="Historique de la production">
      {error ? <AlertBox COLORS={COLORS}>{error}</AlertBox> : null}
      <View style={[s.row, { flexWrap: 'wrap' }]}>
        {([
          ['month', 'Mois'],
          ['year', 'Année'],
          ['total', '6 ans'],
        ] as const).map(([value, label]) => (
          <Button
            key={value}
            COLORS={COLORS}
            label={label}
            variant={range === value ? 'primary' : 'outline'}
            small
            onPress={() => setRange(value)}
          />
        ))}
      </View>
      <View style={[s.row, { justifyContent: 'center' }]}>
        <Button COLORS={COLORS} label="‹" variant="outline" small onPress={() => shift(-1)} />
        <Text style={{ color: COLORS.text, fontWeight: '800', minWidth: 130, textAlign: 'center' }}>{periodLabel}</Text>
        <Button
          COLORS={COLORS}
          label="›"
          variant="outline"
          small
          disabled={anchor.getFullYear() >= new Date().getFullYear() && (range !== 'month' || anchor.getMonth() >= new Date().getMonth())}
          onPress={() => shift(1)}
        />
        {loading ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
      </View>
      <View style={s.metricGrid}>
        <View style={[s.metricTile, { borderColor: COLORS.accentProduction }]}>
          <Text style={{ color: COLORS.muted, fontSize: 11 }}>Production estimée</Text>
          <Text style={[s.metricTileValue, { color: COLORS.text }]}>{totals.production.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kWh</Text>
        </View>
        <View style={[s.metricTile, { borderColor: COLORS.accentConsumption }]}>
          <Text style={{ color: COLORS.muted, fontSize: 11 }}>Consommation estimée</Text>
          <Text style={[s.metricTileValue, { color: COLORS.text }]}>{totals.consumption.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kWh</Text>
        </View>
      </View>
      <View style={[s.row, { justifyContent: 'center' }]}>
        <View style={[s.legendDot, { backgroundColor: COLORS.accentProduction }]} />
        <Text style={{ color: COLORS.muted, fontSize: 11 }}>Production</Text>
        <View style={[s.legendDot, { backgroundColor: COLORS.accentConsumption }]} />
        <Text style={{ color: COLORS.muted, fontSize: 11 }}>Consommation</Text>
      </View>
      {hasEnergyData ? (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={s.energyChart}>
            {buckets.map((row) => (
              <View key={row.key} style={s.energyColumn}>
                <View style={s.energyBars}>
                  <View style={[s.energyBar, { height: `${Math.max(row.production > 0 ? 3 : 0, row.production / maxEnergy * 100)}%`, backgroundColor: COLORS.accentProduction }]} />
                  <View style={[s.energyBar, { height: `${Math.max(row.consumption > 0 ? 3 : 0, row.consumption / maxEnergy * 100)}%`, backgroundColor: COLORS.accentConsumption }]} />
                </View>
                <Text style={{ color: COLORS.muted, fontSize: 10 }}>{row.label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : !loading ? (
        <Text style={{ color: COLORS.muted, textAlign: 'center', paddingVertical: 14 }}>
          Aucune donnée énergétique pour cette période.
        </Text>
      ) : null}
      <Button COLORS={COLORS} label={exporting ? 'Préparation du CSV…' : 'Partager le résumé CSV'} variant="outline" small onPress={() => void shareCsv()} loading={exporting} disabled={buckets.length === 0} />
      <Text style={{ color: COLORS.muted, fontSize: 10 }}>
        Énergie estimée à partir des puissances moyennes et de la durée de chaque période.
      </Text>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Panneau « Détails techniques avancés complets » (données brutes Deye)
 * ------------------------------------------------------------------ */
type RawData = Record<string, number | string>;

function Section({ title, COLORS, children }: { title: string; COLORS: ReturnType<typeof useLumenPalette>; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 12 }}>{title}</Text>
      {children}
    </View>
  );
}

function KV({ label, value, unit, COLORS }: { label: string; value: number; unit: string; COLORS: ReturnType<typeof useLumenPalette> }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: COLORS.muted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: COLORS.text, fontSize: 11, fontWeight: '600' }}>
        {value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} {unit}
      </Text>
    </View>
  );
}

function Table({ headers, rows, COLORS }: { headers: string[]; rows: string[][]; COLORS: ReturnType<typeof useLumenPalette> }) {
  return (
    <View style={{ borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', backgroundColor: COLORS.card, paddingVertical: 4 }}>
        {headers.map((h) => (
          <Text key={h} style={{ flex: 1, color: COLORS.muted, fontSize: 10, fontWeight: '600', textAlign: 'center' }}>{h}</Text>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: 'row', paddingVertical: 4, borderTopWidth: 1, borderTopColor: COLORS.border }}>
          {row.map((cell, cellIndex) => (
            <Text key={cellIndex} style={{ flex: 1, color: COLORS.text, fontSize: 10, textAlign: 'center' }}>{cell}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}


function DeyeDetailsPanel({ COLORS, raw }: { COLORS: ReturnType<typeof useLumenPalette>; raw: RawData }) {
  const num = (key: string): number | null => {
    const v = raw[key];
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const pvStrings = Array.from({ length: 12 }, (_, i) => i + 1)
    .map((i) => ({
      index: i,
      voltage: num(`DCVoltagePV${i}`),
      current: num(`DCCurrentPV${i}`),
      power: num(`DCPowerPV${i}`),
    }))
    .filter((str) => str.voltage !== null && str.voltage > 5);
  const maxPvPower = Math.max(1, ...pvStrings.map((str) => str.power ?? 0));
  const gridPhases = ['L1', 'L2', 'L3']
    .map((phase) => ({
      phase,
      voltage: num(`GridVoltage${phase}`),
      current: num(`GridCurrent${phase}`),
      power: num(`GridPower${phase}`),
    }))
    .filter((p) => p.voltage !== null);
  const loadPhases = ['L1', 'L2', 'L3']
    .map((phase) => ({
      phase,
      voltage: num(`LoadVoltage${phase}`),
      power: num(`LoadPower${phase}`),
    }))
    .filter((p) => p.voltage !== null);
  const outputPhases = ['L1', 'L2', 'L3']
    .map((phase) => ({ phase, power: num(`InverterOutputPower${phase}`) }))
    .filter((p) => p.power !== null);
  const externalCT = [1, 2, 3]
    .map((i) => ({ index: i, power: num(`ExternalCT${i}Power`) }))
    .filter((c) => c.power !== null && c.power !== 0);
  const gridPairs = ([
    ['Tension', num('BatteryVoltage'), 'V'],
    ['Courant', num('BatteryCurrent'), 'A'],
    ['Puissance instantanée', num('BatteryPower'), 'W'],
    ['État de charge (SOC)', num('SOC'), '%'],
    ["Énergie chargée aujourd'hui", num('DailyChargingEnergy'), 'kWh'],
    ["Énergie déchargée aujourd'hui", num('DailyDischargingEnergy'), 'kWh'],
  ] as [string, number | null, string][]).filter(([, v]) => v !== null && v !== 0);
  const tempPairs = ([
    ['Température dissipateur', num('AC Temperature') ?? num('RadiatorTemperature'), '°C'],
    ['Température interne (Batterie)', num('Temperature- Battery'), '°C'],
    ['Fréquence du réseau', num('GridFrequency'), 'Hz'],
  ] as [string, number | null, string][]).filter(([, v]) => v !== null && v !== 0);
  const generatorPower = num('TotalGeneratorPower');

  return (
    <View style={{ gap: 14 }}>
      {pvStrings.length > 0 ? (
        <Section COLORS={COLORS} title="Rendement Photovoltaïque (par string)">
          {pvStrings.map((str) => (
            <View key={str.index} style={{ gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: COLORS.muted, fontSize: 11 }}>String PV {str.index}</Text>
                <Text style={{ color: COLORS.text, fontSize: 11, fontWeight: '600' }}>
                  {(str.power ?? 0).toFixed(0)} W
                  <Text style={{ color: COLORS.muted }}> ({(str.voltage ?? 0).toFixed(1)} V · {(str.current ?? 0).toFixed(1)} A)</Text>
                </Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: COLORS.border }}>
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: COLORS.accentProduction,
                    width: `${Math.min(100, ((str.power ?? 0) / maxPvPower) * 100)}%`,
                  }}
                />
              </View>
            </View>
          ))}
        </Section>
      ) : null}
      {gridPhases.length > 0 ? (
        <Section COLORS={COLORS} title="Réseau (JIRAMA)">
          <Table COLORS={COLORS}
            headers={['Phase', 'Tension', 'Courant', 'Puissance']}
            rows={gridPhases.map((p) => [
              p.phase,
              `${(p.voltage ?? 0).toFixed(1)} V`,
              `${(p.current ?? 0).toFixed(1)} A`,
              `${(p.power ?? 0).toFixed(0)} W`,
            ])}
          />
        </Section>
      ) : null}
      {loadPhases.length > 0 ? (
        <Section COLORS={COLORS} title="Consommation des charges">
          <Table COLORS={COLORS}
            headers={['Phase', 'Tension', 'Puissance']}
            rows={loadPhases.map((p) => [
              p.phase,
              `${(p.voltage ?? 0).toFixed(1)} V`,
              `${(p.power ?? 0).toFixed(0)} W`,
            ])}
          />
        </Section>
      ) : null}
      <Section COLORS={COLORS} title="Performances Batterie">
        {gridPairs.map(([label, value, unit]) => (
          <KV COLORS={COLORS} key={label} label={label} value={value as number} unit={unit} />
        ))}
      </Section>
      {outputPhases.length > 0 || externalCT.length > 0 ? (
        <View style={{ gap: 14 }}>
          {outputPhases.length > 0 ? (
            <Section COLORS={COLORS} title="Sortie Onduleur (Inverter)">
              <Table COLORS={COLORS} headers={['Phase', 'Puissance']} rows={outputPhases.map((p) => [p.phase, `${(p.power ?? 0).toFixed(0)} W`])} />
            </Section>
          ) : null}
          {externalCT.length > 0 ? (
            <Section COLORS={COLORS} title="Capteurs de courant (CT)">
              {externalCT.map((c) => (
                <KV COLORS={COLORS} key={c.index} label={`Pince CT${c.index}`} value={c.power as number} unit="W" />
              ))}
            </Section>
          ) : null}
        </View>
      ) : null}
      {generatorPower !== null && generatorPower > 0 ? (
        <Section COLORS={COLORS} title="Groupe électrogène">
          <KV COLORS={COLORS} label="Puissance totale active" value={generatorPower} unit="W" />
        </Section>
      ) : null}
      <Section COLORS={COLORS} title="Températures & Fréquence">
        {tempPairs.map(([label, value, unit]) => (
          <KV COLORS={COLORS} key={label} label={label} value={value as number} unit={unit} />
        ))}
      </Section>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Anneau de ratio (autoconsommation / autonomie)
 * ------------------------------------------------------------------ */
function Ring({ COLORS, label, value, color }: { COLORS: ReturnType<typeof useLumenPalette>; label: string; value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 9, borderColor: color, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 15 }}>{pct.toFixed(0)}%</Text>
      </View>
      <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 6 }}>{label}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Résumé de station + ratio d'autoconsommation (anneaux)
 * ------------------------------------------------------------------ */
function StationSummaryCard({
  COLORS,
  siteId,
  deviceId,
  token,
  live,
}: {
  COLORS: ReturnType<typeof useLumenPalette>;
  siteId: string;
  deviceId?: string;
  token: string | null;
  live: Monitoring | null;
}) {
  const [mode, setMode] = useState<'M' | 'Y' | 'T'>('M');
  const [anchor, setAnchor] = useState(() => new Date());
  const [totals, setTotals] = useState<{ production: number; consumption: number; charged: number; discharged: number; bought: number; injected: number }>({
    production: 0, consumption: 0, charged: 0, discharged: 0, bought: 0, injected: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!siteId || !token) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        let start: Date; let end: Date; let bucket: 'day' | 'month' | 'year';
        if (mode === 'M') {
          start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
          end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
          bucket = 'day';
        } else if (mode === 'Y') {
          start = new Date(anchor.getFullYear(), 0, 1);
          end = new Date(anchor.getFullYear() + 1, 0, 1);
          bucket = 'month';
        } else {
          start = new Date(anchor.getFullYear() - 5, 0, 1);
          end = new Date(anchor.getFullYear() + 1, 0, 1);
          bucket = 'year';
        }
        const rows = extractArray(await monitoringApi.getEnergyBreakdown(
          siteId,
          start.toISOString(),
          end.toISOString(),
          bucket,
          deviceId,
          authToken(token),
        )) as Row[];
        const sum = rows.reduce((acc: { production: number; consumption: number; charged: number; discharged: number; bought: number; injected: number }, row) => ({
          production: acc.production + (numberValue(row.production_kwh) ?? 0),
          consumption: acc.consumption + (numberValue(row.consumption_kwh) ?? 0),
          charged: acc.charged + (numberValue(row.charged_kwh) ?? 0),
          discharged: acc.discharged + (numberValue(row.discharged_kwh) ?? 0),
          bought: acc.bought + (numberValue(row.bought_kwh) ?? 0),
          injected: acc.injected + (numberValue(row.injected_kwh) ?? 0),
        }), { production: 0, consumption: 0, charged: 0, discharged: 0, bought: 0, injected: 0 });
        if (active) setTotals(sum);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [siteId, deviceId, mode, anchor, token]);

  const shift = (dir: 1 | -1) => {
    setAnchor((prev) => {
      const next = new Date(prev);
      if (mode === 'M') next.setMonth(next.getMonth() + dir);
      else if (mode === 'Y') next.setFullYear(next.getFullYear() + dir);
      return next;
    });
  };

  const fmt = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  const periodLabel = mode === 'M'
    ? anchor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : mode === 'Y'
      ? String(anchor.getFullYear())
      : `${anchor.getFullYear() - 5}–${anchor.getFullYear()}`;
  const selfConsumptionRatio = totals.production > 0
    ? Math.min(100, Math.max(0, ((totals.production - totals.injected) / totals.production) * 100))
    : 0;
  const autonomyRatio = totals.consumption > 0
    ? Math.min(100, Math.max(0, ((totals.production - totals.injected) / totals.consumption) * 100))
  : 0;

  return (
    <Card COLORS={COLORS} title="Résumé de station">
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <View style={s.row}>
          {(['M', 'Y', 'T'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: mode === m ? COLORS.primary : 'transparent',
                borderWidth: 1,
                borderColor: mode === m ? COLORS.primary : COLORS.border,
              }}
            >
              <Text style={{ color: mode === m ? '#FFFFFF' : COLORS.muted, fontSize: 11, fontWeight: '600' }}>
                {m === 'M' ? 'M' : m === 'Y' ? 'A' : 'T'}
</Text>
            </Pressable>
          ))}
        </View>
        {mode !== 'T' ? (
          <View style={s.row}>
            <Button COLORS={COLORS} label="‹" variant="outline" small onPress={() => shift(-1)} />
            <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: '600' }}>{periodLabel}</Text>
            <Button COLORS={COLORS} label="›" variant="outline" small onPress={() => shift(1)} />
          </View>
        ) : null}
      </View>
      {error ? <Text style={{ color: COLORS.error, fontSize: 11, marginTop: 8 }}>{error}</Text> : null}
      {loading ? <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 8 }} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        <View style={[s.metricTile, { borderColor: COLORS.border, flexGrow: 1, minWidth: '45%' }]}>
          <Text style={{ color: COLORS.muted, fontSize: 11 }}>Production</Text>
          <Text style={[s.metricTileValue, { color: COLORS.accentProduction }]}>{fmt(totals.production)} kWh</Text>
        </View>
        <View style={[s.metricTile, { borderColor: COLORS.border, flexGrow: 1, minWidth: '45%' }]}>
          <Text style={{ color: COLORS.muted, fontSize: 11 }}>Consommation</Text>
          <Text style={[s.metricTileValue, { color: COLORS.accentConsumption }]}>{fmt(totals.consumption)} kWh</Text>
        </View>
        <View style={[s.metricTile, { borderColor: COLORS.border, flexGrow: 1, minWidth: '45%' }]}>
          <Text style={{ color: COLORS.muted, fontSize: 11 }}>Batterie chargée</Text>
          <Text style={[s.metricTileValue, { color: COLORS.accentBattery }]}>{fmt(totals.charged)} kWh</Text>
        </View>
        <View style={[s.metricTile, { borderColor: COLORS.border, flexGrow: 1, minWidth: '45%' }]}>
          <Text style={{ color: COLORS.muted, fontSize: 11 }}>Batterie déchargée</Text>
          <Text style={[s.metricTileValue, { color: COLORS.text }]}>{fmt(totals.discharged)} kWh</Text>
        </View>
        <View style={[s.metricTile, { borderColor: COLORS.border, flexGrow: 1, minWidth: '45%' }]}>
          <Text style={{ color: COLORS.muted, fontSize: 11 }}>Acheté réseau</Text>
          <Text style={[s.metricTileValue, { color: COLORS.warning }]}>{fmt(totals.bought)} kWh</Text>
        </View>
        <View style={[s.metricTile, { borderColor: COLORS.border, flexGrow: 1, minWidth: '45%' }]}>
          <Text style={{ color: COLORS.muted, fontSize: 11 }}>Injecté réseau</Text>
          <Text style={[s.metricTileValue, { color: COLORS.primary }]}>{fmt(totals.injected)} kWh</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 14, alignItems: 'center' }}>
        <Ring COLORS={COLORS} label="Autoconsommation" value={selfConsumptionRatio} color={COLORS.accentProduction} />
        <Ring COLORS={COLORS} label="Autonomie" value={autonomyRatio} color={COLORS.accentBattery} />
      </View>
    </Card>
  );
}

export function RealtimeScreen() {
  const COLORS = useLumenPalette();
  const { token } = useAuth();
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [siteId, setSiteId] = useState('');
  const [devices, setDevices] = useState<Row[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => localDateInput(new Date()));
  const [reading, setReading] = useState<Monitoring | null>(null);
  const [dayRows, setDayRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async (manual = false) => {
    if (!siteId || !token) return;
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const response = deviceId
        ? await monitoringApi.getLatest(siteId, deviceId, authToken(token))
        : await monitoringApi.getTotal(siteId, authToken(token));
      setReading(normalizeMonitoring(response));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les mesures.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [siteId, deviceId, token]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void apiList('sites', authToken(token))
      .then((rows) => {
        if (!active) return;
        const options = normalizeSites(rows);
        setSites(options);
        setSiteId(options.find((site) => !site.isOffline)?.id ?? options[0]?.id ?? '');
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Chargement des centrales impossible.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!siteId || !token) return;
    let active = true;
    void devicesApi.getBySite(siteId, authToken(token))
      .then((response) => {
        if (!active) return;
        const items = extractArray(response);
        setDevices(items);
        setDeviceId((current) => items.some((device) => valueOf(device.id) === current) ? current : '');
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Chargement des appareils impossible.');
      });
    return () => { active = false; };
  }, [siteId, token]);

  useEffect(() => {
    if (!siteId || !token) return;
    let active = true;
    const loadDay = async () => {
      setHistoryLoading(true);
      try {
        const { start, end } = dateBounds(selectedDate, selectedDate);
        const rows = await fetchMonitoringRows(siteId, deviceId || undefined, start, end, authToken(token));
        if (active) setDayRows(rows);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Chargement de l’historique journalier impossible.');
      } finally {
        if (active) setHistoryLoading(false);
      }
    };
    void loadDay();
    return () => { active = false; };
  }, [siteId, deviceId, selectedDate, token]);

  useEffect(() => {
    if (!siteId) return;
    const firstRefresh = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(true), 30_000);
    return () => {
      clearTimeout(firstRefresh);
      clearInterval(timer);
    };
  }, [siteId, refresh]);

  const metrics = [
    { key: 'production_kw' as const, label: 'Production solaire', unit: 'kW', accent: COLORS.accentProduction },
    { key: 'consumption_kw' as const, label: 'Consommation', unit: 'kW', accent: COLORS.accentConsumption },
    { key: 'battery_level_percent' as const, label: 'Batterie', unit: '%', accent: COLORS.accentBattery },
    { key: 'battery_voltage' as const, label: 'Tension batterie', unit: 'V', accent: COLORS.warning },
    { key: 'temperature_celsius' as const, label: 'Température', unit: '°C', accent: COLORS.accentTemperature },
  ];
  const totalMetrics = [
    { label: 'Production du jour', value: reading?.daily_production_kwh, unit: 'kWh' },
    { label: 'Consommation du jour', value: reading?.daily_consumption_kwh, unit: 'kWh' },
    { label: 'Production totale', value: reading?.total_production_kwh, unit: 'kWh' },
    { label: 'Fréquence réseau', value: reading?.frequency_hz, unit: 'Hz' },
  ].filter((item): item is typeof item & { value: number } => item.value !== null && item.value !== undefined);
  const flowMetrics = [
    { label: 'PV', value: reading?.pv_power_kw, unit: 'kW', color: COLORS.accentProduction },
    { label: 'Générateur', value: reading?.generator_power_kw, unit: 'kW', color: COLORS.warning },
    { label: 'Réseau', value: reading?.grid_power_kw, unit: 'kW', color: COLORS.primary },
    { label: 'Charge batterie', value: reading?.battery_charge_kw, unit: 'kW', color: COLORS.accentBattery },
    { label: 'Décharge batterie', value: reading?.battery_discharge_kw, unit: 'kW', color: COLORS.error },
  ].filter((item): item is typeof item & { value: number } => item.value !== null && item.value !== undefined);
  const chartRows = sampleHistoryRows(
    dayRows.slice().sort((a, b) => Date.parse(valueOf(a.timestamp)) - Date.parse(valueOf(b.timestamp))),
    48,
  );
  const shareDayCsv = async () => {
    if (dayRows.length === 0) return;
    setExporting(true);
    setError('');
    try {
      const csv = [
        'Horodatage;Production (kW);PV (kW);Générateur (kW);Réseau (kW);Consommation (kW);Batterie (%);Tension (V);Température (°C)',
        ...dayRows.map((row) => [
          valueOf(row.timestamp),
          valueOf(row.production_kw),
          valueOf(row.pv_power_kw),
          valueOf(row.generator_power_kw),
          valueOf(row.grid_power_kw),
          valueOf(row.consumption_kw),
          valueOf(row.battery_level_percent),
          valueOf(row.battery_voltage),
          valueOf(row.temperature_celsius),
        ].join(';')),
      ].join('\n');
      await Share.share({ title: `LUMEN - ${selectedDate}`, message: csv });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de partager le CSV journalier.');
    } finally {
      setExporting(false);
    }
  };
  return (
    <Screen COLORS={COLORS} title="Temps réel" subtitle="Mesures actualisées automatiquement toutes les 30 secondes">
      {error ? <AlertBox COLORS={COLORS}>{error}</AlertBox> : null}
      <Card COLORS={COLORS} title="Centrale supervisée">
        <SitePicker COLORS={COLORS} sites={sites} selected={siteId} onChange={(id) => {
          setSiteId(id);
          setDevices([]);
          setDeviceId('');
        }} />
        {devices.length > 0 ? (
          <Field COLORS={COLORS} label="Appareil">
            <Select COLORS={COLORS} value={deviceId} onChange={setDeviceId} options={[
              { value: '', label: 'Total du projet' },
              ...devices.map((device, index) => ({
                value: valueOf(device.id),
                label: valueOf(device.device_name, `Appareil n°${index + 1}`),
              })),
            ]} />
          </Field>
        ) : null}
        <Button COLORS={COLORS} label={refreshing ? 'Actualisation…' : 'Actualiser'} variant="outline" onPress={() => void refresh(true)} loading={refreshing} />
      </Card>
      {loading && !reading ? <ActivityIndicator color={COLORS.primary} /> : reading ? metrics.map((item) => (
        <Card key={item.key} COLORS={COLORS} accent={item.accent}>
          <Text style={{ color: COLORS.muted, fontSize: 12 }}>{item.label}</Text>
          <Text style={[s.metric, { color: COLORS.text }]}>
            {typeof reading[item.key] === 'number' ? Number(reading[item.key]).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '—'}
            {typeof reading[item.key] === 'number' ? ` ${item.unit}` : ''}
          </Text>
        </Card>
      )) : <EmptyState COLORS={COLORS} icon="◉" message="Aucune mesure récente pour cette centrale." />}
      {reading ? (
        <>
          {totalMetrics.length > 0 ? <Card COLORS={COLORS} title="Cumuls et réseau">
            <View style={s.metricGrid}>
              {totalMetrics.map((item) => (
                <View key={item.label} style={[s.metricTile, { borderColor: COLORS.border }]}>
                  <Text style={{ color: COLORS.muted, fontSize: 11 }}>{item.label}</Text>
                  <Text style={[s.metricTileValue, { color: COLORS.text }]}>
                    {Number(item.value).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} {item.unit}
                  </Text>
                </View>
              ))}
            </View>
            {reading.grid_status || reading.energy_source || reading.timestamp ? (
              <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 10 }}>
                {reading.energy_source ? `Source : ${reading.energy_source}` : ''}
                {reading.energy_source && reading.grid_status ? ' · ' : ''}
                {reading.grid_status ? `Réseau : ${reading.grid_status}` : ''}
                {(reading.energy_source || reading.grid_status) && reading.timestamp ? ' · ' : ''}
                {reading.timestamp ? `Relevé : ${new Date(reading.timestamp).toLocaleTimeString('fr-FR')}` : ''}
              </Text>
            ) : null}
          </Card> : null}
          {flowMetrics.length > 0 ? <FlowCard COLORS={COLORS} reading={reading} /> : null}
          {deviceId && reading.raw_data ? (
            <Card COLORS={COLORS} title="Détails techniques avancés complets (Données brutes)">
              <Pressable
                onPress={() => setShowDetails((v) => !v)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '600' }}>
                  {showDetails ? '▲ Masquer les détails' : '▼ Afficher les détails bruts Deye'}
                </Text>
              </Pressable>
              {showDetails ? (
                <View style={{ marginTop: 10 }}>
                  <DeyeDetailsPanel COLORS={COLORS} raw={reading.raw_data} />
                </View>
              ) : null}
            </Card>
          ) : null}
        </>
      ) : null}
      {siteId ? <StationSummaryCard COLORS={COLORS} siteId={siteId} deviceId={deviceId || undefined} token={token} live={reading} /> : null}
      <Card COLORS={COLORS} title="Historique de la journée">
        <View style={s.row}>
          <Button COLORS={COLORS} label="‹ Jour précédent" variant="outline" small onPress={() => setSelectedDate((date) => shiftDateInput(date, -1))} />
          <View style={s.flex}>
            <Input COLORS={COLORS} value={selectedDate} onChangeText={setSelectedDate} placeholder="AAAA-MM-JJ" />
          </View>
          <Button COLORS={COLORS} label="Jour suivant ›" variant="outline" small disabled={selectedDate >= localDateInput(new Date())} onPress={() => setSelectedDate((date) => shiftDateInput(date, 1))} />
        </View>
        <View style={[s.row, { justifyContent: 'center' }]}>
          <View style={[s.legendDot, { backgroundColor: COLORS.accentProduction }]} />
          <Text style={{ color: COLORS.muted, fontSize: 11 }}>Production</Text>
          <View style={[s.legendDot, { backgroundColor: COLORS.accentConsumption }]} />
          <Text style={{ color: COLORS.muted, fontSize: 11 }}>Consommation</Text>
          {historyLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
        </View>
        <Button COLORS={COLORS} label={exporting ? 'Préparation du CSV…' : 'Partager les relevés CSV'} variant="outline" small onPress={() => void shareDayCsv()} loading={exporting} disabled={dayRows.length === 0} />
        {chartRows.length === 0 ? (
          <Text style={{ color: COLORS.muted, textAlign: 'center', paddingVertical: 18 }}>
            Aucune donnée pour cette journée.
          </Text>
        ) : (
          <LineChartCard
            COLORS={COLORS}
            title="Production et consommation de la journée"
            series={[
              {
                key: 'production_kw',
                label: 'Production (kW)',
                color: COLORS.accentProduction,
                values: chartRows.map((row) => numberValue(row.production_kw)),
              },
              {
                key: 'consumption_kw',
                label: 'Consommation (kW)',
                color: COLORS.accentConsumption,
                values: chartRows.map((row) => numberValue(row.consumption_kw)),
              },
            ]}
            labels={chartRows.map((row) => {
              const d = new Date(String(row.timestamp ?? ''));
              return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            })}
            height={200}
            yUnit=" kW"
          />
        )}
        <Text style={{ color: COLORS.muted, fontSize: 10 }}>
          {chartRows.length ? `${dayRows.length} relevé(s) sur la journée · ${chartRows.length} points affichés` : 'Choisissez une date au format AAAA-MM-JJ'}
        </Text>
      </Card>
      {siteId ? <EnergyHistoryCard COLORS={COLORS} siteId={siteId} deviceId={deviceId || undefined} token={token} /> : null}
    </Screen>
  );
}

type HistoryRow = Row & {
  id?: string;
  timestamp?: string;
  production_kw?: number | string | null;
  consumption_kw?: number | string | null;
  battery_level_percent?: number | string | null;
  battery_voltage?: number | string | null;
  temperature_celsius?: number | string | null;
  grid_status?: string | null;
  pv_power_kw?: number | string | null;
  generator_power_kw?: number | string | null;
  grid_power_kw?: number | string | null;
};

type HistoryGrouping = 'none' | 'hour' | 'day' | 'week' | 'month';

type HistorySummary = {
  key: string;
  date: Date;
  count: number;
  production: number[];
  consumption: number[];
};

export function HistoryScreen() {
  const COLORS = useLumenPalette();
  const { token } = useAuth();
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [siteId, setSiteId] = useState('');
  const [from, setFrom] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [groupBy, setGroupBy] = useState<HistoryGrouping>('none');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void apiList('sites', authToken(token)).then((data) => {
      const options = normalizeSites(data);
      setSites(options);
      setSiteId(options.find((site) => !site.isOffline)?.id ?? options[0]?.id ?? '');
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Chargement des centrales impossible.'));
  }, [token]);

  const search = async () => {
    setError('');
    if (!siteId) return setError('Sélectionnez une centrale.');
    if (from > to) return setError('La date de début doit précéder la date de fin.');
    setLoading(true);
    try {
      const { start, end } = dateBounds(from, to);
      const historyRows = await fetchMonitoringRows(siteId, undefined, start, end, authToken(token));
      setRows(historyRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des relevés.');
    } finally {
      setLoading(false);
    }
  };

  const shareCsv = async () => {
    setError('');
    const csv = [
      'Horodatage;Production (kW);Consommation (kW);Batterie (%);Tension batterie (V);Température (°C);Statut réseau',
      ...rows.map((row) => [
        valueOf(row.timestamp),
        valueOf(row.production_kw),
        valueOf(row.consumption_kw),
        valueOf(row.battery_level_percent),
        valueOf(row.battery_voltage),
        valueOf(row.temperature_celsius),
        valueOf(row.grid_status),
      ].join(';')),
    ].join('\n');
    try {
      await Share.share({ title: 'Historique LUMEN', message: csv });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de partager le fichier CSV.');
    }
  };

  const summaryRows: HistorySummary[] = [];
  if (groupBy !== 'none') {
    const buckets = new Map<string, HistorySummary>();
    for (const row of rows) {
      if (!row.timestamp) continue;
      const date = new Date(row.timestamp);
      if (!Number.isFinite(date.getTime())) continue;
      const bucketDate = new Date(date);
      if (groupBy === 'hour') bucketDate.setMinutes(0, 0, 0);
      if (groupBy === 'day') bucketDate.setHours(0, 0, 0, 0);
      if (groupBy === 'week') {
        bucketDate.setHours(0, 0, 0, 0);
        bucketDate.setDate(bucketDate.getDate() - ((bucketDate.getDay() + 6) % 7));
      }
      if (groupBy === 'month') {
        bucketDate.setDate(1);
        bucketDate.setHours(0, 0, 0, 0);
      }
      const key = bucketDate.toISOString();
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { key, date: bucketDate, count: 0, production: [], consumption: [] };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      const production = numberValue(row.production_kw);
      const consumption = numberValue(row.consumption_kw);
      if (production !== null) bucket.production.push(production);
      if (consumption !== null) bucket.consumption.push(consumption);
    }
    summaryRows.push(...Array.from(buckets.values()).sort((a, b) => a.date.getTime() - b.date.getTime()));
  }

  const durationHours = (start: Date, end: Date) => Math.max(0, (end.getTime() - start.getTime()) / 3_600_000);
  const summaryPeriod = (date: Date) => {
    const start = new Date(date);
    const end = new Date(date);
    if (groupBy === 'hour') end.setHours(end.getHours() + 1);
    if (groupBy === 'day') end.setDate(end.getDate() + 1);
    if (groupBy === 'week') end.setDate(end.getDate() + 7);
    if (groupBy === 'month') end.setMonth(end.getMonth() + 1);
    const rangeStart = new Date(`${from}T00:00:00`);
    const [year, month, day] = to.split('-').map(Number);
    const rangeEnd = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
    const clippedStart = start < rangeStart ? rangeStart : start;
    const boundedEnd = end > rangeEnd ? rangeEnd : end;
    const now = new Date();
    const clippedEnd = boundedEnd > now ? now : boundedEnd;
    return durationHours(clippedStart, clippedEnd);
  };

  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const formattedBucketDate = (date: Date) => {
    if (groupBy === 'hour') return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit' });
    if (groupBy === 'month') return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    if (groupBy === 'week') return `Semaine du ${date.toLocaleDateString('fr-FR')}`;
    return date.toLocaleDateString('fr-FR');
  };

  return (
    <Screen COLORS={COLORS} title="Historique et rapports" subtitle="Consulter ou partager les relevés d’une centrale">
      {error ? <AlertBox COLORS={COLORS}>{error}</AlertBox> : null}
      <Card COLORS={COLORS} title="Filtres de recherche">
        <Field COLORS={COLORS} label="Centrale"><SitePicker COLORS={COLORS} sites={sites} selected={siteId} onChange={setSiteId} /></Field>
        <Field COLORS={COLORS} label="Regrouper par">
          <Select COLORS={COLORS} value={groupBy} onChange={(value) => setGroupBy(value as HistoryGrouping)} options={[
            { value: 'none', label: 'Détail' },
            { value: 'hour', label: 'Heure' },
            { value: 'day', label: 'Jour' },
            { value: 'week', label: 'Semaine' },
            { value: 'month', label: 'Mois' },
          ]} />
        </Field>
        <Field COLORS={COLORS} label="Du (AAAA-MM-JJ)"><Input COLORS={COLORS} value={from} onChangeText={setFrom} placeholder="AAAA-MM-JJ" /></Field>
        <Field COLORS={COLORS} label="Au (AAAA-MM-JJ)"><Input COLORS={COLORS} value={to} onChangeText={setTo} placeholder="AAAA-MM-JJ" /></Field>
        <Button COLORS={COLORS} label="Rechercher" onPress={() => void search()} loading={loading} />
      </Card>
      {rows.length > 0 ? (
        <Card COLORS={COLORS} title={groupBy === 'none' ? `${rows.length} relevé(s)` : `Résumé par période (${summaryRows.length})`}>
          <Button COLORS={COLORS} label="Partager en CSV" variant="outline" onPress={() => void shareCsv()} />
          {groupBy !== 'none' ? summaryRows.map((bucket) => {
            const avgProduction = average(bucket.production);
            const avgConsumption = average(bucket.consumption);
            const hours = summaryPeriod(bucket.date);
            return (
              <View key={bucket.key} style={s.historyRow}>
                <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: '800' }}>
                  {formattedBucketDate(bucket.date)} · {bucket.count} relevé(s)
                </Text>
                <Text style={{ color: COLORS.muted, fontSize: 11 }}>
                  Prod. moy. {avgProduction.toFixed(2)} kW · Conso. moy. {avgConsumption.toFixed(2)} kW
                </Text>
                <Text style={{ color: COLORS.text, fontSize: 11 }}>
                  Énergie estimée : { (avgProduction * hours).toFixed(1) } kWh produite · { (avgConsumption * hours).toFixed(1) } kWh consommée
                </Text>
              </View>
            );
          }) : rows.slice(0, 100).map((row, index) => (
            <View key={valueOf(row.id, `${valueOf(row.timestamp)}-${index}`)} style={s.historyRow}>
              <Text style={{ color: COLORS.muted, fontSize: 11 }}>{row.timestamp ? new Date(row.timestamp).toLocaleString('fr-FR') : 'Date inconnue'}</Text>
              <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: '700' }}>
                ☀ {valueOf(row.production_kw, '—')} kW · ⌂ {valueOf(row.consumption_kw, '—')} kW · ◉ {valueOf(row.battery_level_percent, '—')} %
              </Text>
              <Text style={{ color: COLORS.muted, fontSize: 11 }}>
                {valueOf(row.battery_voltage, '—')} V · {valueOf(row.temperature_celsius, '—')} °C · Réseau : {valueOf(row.grid_status, 'N/A')}
              </Text>
            </View>
          ))}
          {groupBy === 'none' && rows.length > 100 ? <Text style={{ color: COLORS.muted }}>Les 100 relevés les plus récents sont affichés. Le partage CSV contient tous les relevés chargés.</Text> : null}
          {groupBy !== 'none' ? <Text style={{ color: COLORS.muted, fontSize: 10 }}>Énergie estimée à partir de la puissance moyenne × la durée de la période, limitée aux dates recherchées.</Text> : null}
        </Card>
      ) : !loading ? <EmptyState COLORS={COLORS} icon="◷" message="Aucun relevé chargé. Choisissez une période puis recherchez." /> : null}
    </Screen>
  );
}

type CompareRow = {
  id: string;
  name: string;
  location?: string;
  status?: string;
  is_offline?: boolean;
  today_production_kwh?: number;
  active_alerts?: number;
  critical_alerts?: number;
  last_communication?: string | null;
};

export function CompareScreen() {
  const COLORS = useLumenPalette();
  const { token } = useAuth();
  const [sites, setSites] = useState<CompareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiRequest<unknown>('sites/compare', { token: authToken(token) });
      setSites((extractArray(response) as CompareRow[]).sort((a, b) => Number(b.today_production_kwh ?? 0) - Number(a.today_production_kwh ?? 0)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de comparer les centrales.');
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  const maxProduction = Math.max(1, ...sites.map((site) => Number(site.today_production_kwh ?? 0)));
  return (
    <Screen COLORS={COLORS} title="Comparaison des centrales" subtitle="Production, alertes et communication">
      {error ? <AlertBox COLORS={COLORS}>{error}</AlertBox> : null}
      {!loading && sites.length > 0 ? (
        <Card COLORS={COLORS} title="Production du jour (kWh)">
          <View style={{ gap: 8 }}>
            {sites.map((site) => {
              const value = Number(site.today_production_kwh ?? 0);
              const pct = Math.round((value / maxProduction) * 100);
              return (
                <View key={site.id} style={{ gap: 3 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: COLORS.text, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                      {site.name}
                    </Text>
                    <Text style={{ color: COLORS.muted, fontSize: 11 }}>{value.toFixed(1)} kWh</Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: COLORS.border, overflow: 'hidden' }}>
                    <View
                      style={{
                        height: '100%',
                        width: `${Math.max(pct, value > 0 ? 4 : 0)}%`,
                        borderRadius: 4,
                        backgroundColor: COLORS.accentProduction,
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}
      {loading ? <ActivityIndicator color={COLORS.primary} /> : sites.length === 0 ? <EmptyState COLORS={COLORS} icon="⇄" message="Aucune centrale à comparer." /> : sites.map((site) => (
        <Card key={site.id} COLORS={COLORS}>
          <View style={s.row}>
            <View style={s.flex}>
              <Text style={[s.title, { color: COLORS.text }]}>{site.name}</Text>
              <Text style={{ color: COLORS.muted, fontSize: 11 }}>{site.location || 'Emplacement non renseigné'}</Text>
            </View>
            <Badge COLORS={COLORS} label={site.is_offline ? 'Hors ligne' : site.status || 'En ligne'} tone={site.is_offline ? 'error' : 'success'} />
          </View>
          <View style={s.row}><Text style={{ color: COLORS.muted }}>Production du jour</Text><Text style={[s.title, { color: COLORS.text }]}>{Number(site.today_production_kwh ?? 0).toFixed(1)} kWh</Text></View>
          <View style={s.row}><Text style={{ color: COLORS.muted }}>Alertes actives</Text><Text style={[s.title, { color: Number(site.critical_alerts) > 0 ? COLORS.error : COLORS.text }]}>{Number(site.active_alerts ?? 0)}</Text></View>
          <Text style={{ color: COLORS.muted, fontSize: 11 }}>Dernière communication : {site.last_communication ? new Date(site.last_communication).toLocaleString('fr-FR') : 'Non renseignée'}</Text>
        </Card>
      ))}
    </Screen>
  );
}

type ConfigurationRow = {
  id: string;
  parameter_name: string;
  parameter_value: string;
  unit?: string | null;
  description?: string | null;
  min_value?: number | null;
  max_value?: number | null;
};

export function ConfigurationScreen() {
  const COLORS = useLumenPalette();
  const { token, user } = useAuth();
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [siteId, setSiteId] = useState('');
  const [configs, setConfigs] = useState<ConfigurationRow[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [auditRows, setAuditRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canEdit = user?.role === 'admin' || user?.role === 'engineer';

  useEffect(() => {
    void apiList('sites', authToken(token)).then((rows) => {
      const options = normalizeSites(rows);
      setSites(options);
      setSiteId(options[0]?.id ?? '');
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Chargement des centrales impossible.'));
  }, [token]);

  const loadConfigs = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const response = await apiRequest<unknown>(`configurations/site/${encodeURIComponent(id)}`, { token: authToken(token) });
      const rows = extractArray(response) as ConfigurationRow[];
      setConfigs(rows);
      setValues(Object.fromEntries(rows.map((row) => [row.id, valueOf(row.parameter_value)])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement des paramètres impossible.');
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    if (!canEdit) return;
    const timer = setTimeout(() => void loadConfigs(siteId), 0);
    return () => clearTimeout(timer);
  }, [canEdit, siteId, loadConfigs]);

  useEffect(() => {
    if (!canEdit || !siteId) return;
    const params = new URLSearchParams({ site_id: siteId, limit: '50' });
    void apiList(`audit?${params.toString()}`, authToken(token))
      .then(setAuditRows)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Chargement du journal d’audit impossible.'));
  }, [canEdit, siteId, token]);

  const save = async (config: ConfigurationRow) => {
    const value = (values[config.id] ?? '').trim();
    if ((config.min_value != null || config.max_value != null) && !Number.isFinite(Number(value))) {
      setError(`« ${config.parameter_name} » doit être une valeur numérique.`);
      return;
    }
    if (config.min_value != null && Number(value) < config.min_value) return setError(`Minimum requis : ${config.min_value} ${config.unit ?? ''}`);
    if (config.max_value != null && Number(value) > config.max_value) return setError(`Maximum autorisé : ${config.max_value} ${config.unit ?? ''}`);
    setError('');
    try {
      await apiRequest(`configurations/${encodeURIComponent(config.id)}`, { method: 'PATCH', token: authToken(token), body: { value } });
      await loadConfigs(siteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  };

  if (!canEdit) {
    return <Screen COLORS={COLORS} title="Configuration"><AlertBox COLORS={COLORS}>Accès réservé aux administrateurs et ingénieurs.</AlertBox></Screen>;
  }

  return (
    <Screen COLORS={COLORS} title="Configuration" subtitle="Paramètres des centrales">
      {error ? <AlertBox COLORS={COLORS}>{error}</AlertBox> : null}
      <Card COLORS={COLORS} title="Centrale"><SitePicker COLORS={COLORS} sites={sites} selected={siteId} onChange={setSiteId} /></Card>
      {loading ? <ActivityIndicator color={COLORS.primary} /> : configs.length === 0 ? <EmptyState COLORS={COLORS} icon="⚙" message="Aucun paramètre disponible." /> : configs.map((config) => (
        <Card key={config.id} COLORS={COLORS}>
          <Field COLORS={COLORS} label={`${config.parameter_name}${config.unit ? ` (${config.unit})` : ''}`}>
            <Input COLORS={COLORS} value={values[config.id] ?? ''} onChangeText={(value) => setValues((current) => ({ ...current, [config.id]: value }))} disabled={!canEdit} />
          </Field>
          {config.description ? <Text style={{ color: COLORS.muted }}>{config.description}</Text> : null}
          {canEdit ? <Button COLORS={COLORS} label="Enregistrer" small onPress={() => void save(config)} /> : null}
        </Card>
      ))}
      <Card COLORS={COLORS} title="Journal d’audit">
        {auditRows.length === 0 ? <Text style={{ color: COLORS.muted }}>Aucune activité récente.</Text> : auditRows.map((row, index) => (
          <View key={valueOf(row.id, `${valueOf(row.created_at)}-${index}`)} style={s.historyRow}>
            <Text style={[s.title, { color: COLORS.text }]}>{valueOf(row.action)} · {valueOf(row.entity_type)}</Text>
            <Text style={{ color: COLORS.muted, fontSize: 11 }}>
              {valueOf(row.username, 'Utilisateur')} · {row.created_at ? new Date(String(row.created_at)).toLocaleString('fr-FR') : 'Date inconnue'}
            </Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

type UserRow = { id: string; username: string; email?: string | null; full_name?: string | null; role: string };
const roleOptions = [
  { value: 'admin', label: 'Administrateur' },
  { value: 'engineer', label: 'Ingénieur' },
  { value: 'technician', label: 'Technicien' },
  { value: 'client', label: 'Client' },
];

export function UsersScreen() {
  const COLORS = useLumenPalette();
  const { token, user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [busyId, setBusyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const allowed = user?.role === 'admin';

  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const tokenValue = authToken(token);
      const [userRows, siteRows] = await Promise.all([apiList('users', tokenValue), apiList('sites', tokenValue)]);
      const normalized = userRows.flatMap((row) => {
        const id = valueOf(row.id);
        const username = valueOf(row.username);
        return id && username ? [{ id, username, email: valueOf(row.email) || null, full_name: valueOf(row.full_name) || null, role: valueOf(row.role, 'client') }] : [];
      });
      const assignedRows = await Promise.all(normalized.map(async (item) => {
        const response = await apiRequest<unknown>(`users/${encodeURIComponent(item.id)}/sites`, { token: tokenValue });
        return [item.id, extractArray(response).map((row) => valueOf(row.id ?? row.site_id)).filter(Boolean)] as const;
      }));
      setUsers(normalized);
      setSites(normalizeSites(siteRows));
      setUserRoles(Object.fromEntries(normalized.map((item) => [item.id, item.role])));
      setAssignments(Object.fromEntries(assignedRows));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les utilisateurs.');
    } finally {
      setLoading(false);
    }
  }, [allowed, token]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const save = async (item: UserRow) => {
    setBusyId(item.id);
    setError('');
    try {
      const tokenValue = authToken(token);
      await apiRequest(`users/${encodeURIComponent(item.id)}/role`, { method: 'PATCH', token: tokenValue, body: { role: userRoles[item.id] ?? item.role } });
      await apiRequest(`users/${encodeURIComponent(item.id)}/sites`, { method: 'PUT', token: tokenValue, body: { site_ids: assignments[item.id] ?? [] } });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement des autorisations impossible.');
    } finally {
      setBusyId('');
    }
  };

  if (!allowed) return <Screen COLORS={COLORS} title="Gestion des utilisateurs"><AlertBox COLORS={COLORS}>Seuls les administrateurs peuvent gérer les comptes.</AlertBox></Screen>;
  return (
    <Screen COLORS={COLORS} title="Gestion des utilisateurs" subtitle="Rôles et attribution des centrales">
      {error ? <AlertBox COLORS={COLORS}>{error}</AlertBox> : null}
      {loading ? <ActivityIndicator color={COLORS.primary} /> : users.length === 0 ? <EmptyState COLORS={COLORS} icon="♙" message="Aucun utilisateur disponible." /> : users.map((item) => {
        const assigned = assignments[item.id] ?? [];
        return (
          <Card key={item.id} COLORS={COLORS}>
            <Text style={[s.title, { color: COLORS.text }]}>{item.full_name || item.username}</Text>
            <Text style={{ color: COLORS.muted, fontSize: 11 }}>{item.email || item.username}</Text>
            <Field COLORS={COLORS} label="Rôle">
              <Select COLORS={COLORS} value={userRoles[item.id] ?? item.role} onChange={(role) => setUserRoles((current) => ({ ...current, [item.id]: role }))} options={roleOptions} />
            </Field>
            <Text style={[s.fieldLabel, { color: COLORS.text }]}>Centrales attribuées</Text>
            <View style={s.chips}>
              {sites.map((site) => {
                const checked = assigned.includes(site.id);
                return (
                  <Pressable key={site.id} onPress={() => setAssignments((current) => ({
                    ...current,
                    [item.id]: checked ? assigned.filter((id) => id !== site.id) : [...assigned, site.id],
                  }))} style={[s.chip, { borderColor: checked ? COLORS.primary : COLORS.border, backgroundColor: checked ? COLORS.mutedBg : 'transparent' }]}>
                    <Text style={{ color: checked ? COLORS.primary : COLORS.muted, fontSize: 11 }}>{site.name}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Button COLORS={COLORS} label="Enregistrer" onPress={() => void save(item)} loading={busyId === item.id} />
          </Card>
        );
      })}
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 14, fontWeight: '800' },
  subtitle: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  metric: { fontSize: 24, fontWeight: '900', marginTop: 4 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricTile: { flexBasis: '48%', flexGrow: 1, borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
  metricTileValue: { fontSize: 16, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  flex: { flex: 1, gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '700' },
  historyRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#8792A2', paddingTop: 10, gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  chart: { height: 120, flexDirection: 'row', alignItems: 'stretch', gap: 2, paddingTop: 6 },
  chartColumn: { flex: 1, justifyContent: 'flex-end' },
  chartBars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  chartBar: { flex: 1, minHeight: 2, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  energyChart: { height: 150, flexDirection: 'row', alignItems: 'stretch', gap: 8, paddingTop: 6 },
  energyColumn: { width: 34, alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  energyBars: { height: 120, width: '100%', flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  energyBar: { flex: 1, minHeight: 0, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7 },
  equipment: { gap: 10, paddingBottom: 12 },
});

/* ------------------------------------------------------------------ *
 * Graphique de flux : PV → Onduleur → Réseau / Batterie / Charges
 * ------------------------------------------------------------------ */
function FlowNode({ COLORS, label, value, unit, color, sub }: { COLORS: ReturnType<typeof useLumenPalette>; label: string; value: string; unit: string; color: string; sub?: string }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 76 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: color, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.card }}>
        <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: '800' }}>{value}</Text>
        <Text style={{ color: COLORS.muted, fontSize: 9 }}>{unit}</Text>
      </View>
      <Text style={{ color: COLORS.text, fontSize: 10, fontWeight: '600', marginTop: 4 }}>{label}</Text>
      {sub ? <Text style={{ color: COLORS.muted, fontSize: 9 }}>{sub}</Text> : null}
    </View>
  );
}

function FlowArrow({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1, paddingHorizontal: 2 }}>
      <View style={{ height: 3, borderRadius: 2, backgroundColor: color, width: '100%' }} />
      <Text style={{ color: color, fontSize: 9, fontWeight: '700', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function FlowCard({ COLORS, reading }: { COLORS: ReturnType<typeof useLumenPalette>; reading: Monitoring }) {
  const pv = reading.pv_power_kw ?? 0;
  const gen = reading.generator_power_kw ?? 0;
  const grid = reading.grid_power_kw ?? 0; // >0 = import, <0 = export
  const charge = reading.battery_charge_kw ?? 0;
  const discharge = reading.battery_discharge_kw ?? 0;
  const consumption = reading.consumption_kw ?? 0;
  const soc = reading.battery_level_percent;
  const production = pv + gen;
  return (
    <Card COLORS={COLORS} title="Graphique de flux">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <FlowNode COLORS={COLORS} label="PV" value={pv.toFixed(2)} unit="kW" color={COLORS.accentProduction} />
        <FlowArrow label="→" color={COLORS.accentProduction} />
        <FlowNode COLORS={COLORS} label="Onduleur"
          value={(production).toFixed(2)}
          unit="kW"
          color={COLORS.primary}
          sub={gen > 0 ? `+ Gen ${gen.toFixed(1)} kW` : undefined}
        />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 }}>
        <FlowNode COLORS={COLORS} label="Réseau"
          value={Math.abs(grid).toFixed(2)}
          unit={grid > 0 ? 'kW import' : 'kW export'}
          color={grid > 0 ? COLORS.warning : COLORS.primary}
        />
        <FlowArrow label="↔" color={grid > 0 ? COLORS.warning : COLORS.primary} />
        <FlowNode COLORS={COLORS} label="Batterie"
          value={(charge > 0 ? charge : discharge).toFixed(2)}
          unit={charge > 0 ? 'kW charge' : 'kW décharge'}
          color={charge > 0 ? COLORS.accentBattery : COLORS.error}
          sub={soc !== null ? `${soc.toFixed(0)}% SOC` : undefined}
        />
        <FlowArrow label="→" color={COLORS.accentConsumption} />
        <FlowNode COLORS={COLORS} label="Charges" value={consumption.toFixed(2)} unit="kW" color={COLORS.accentConsumption} />
      </View>
      {reading.energy_source ? (
        <Text style={{ color: COLORS.muted, fontSize: 10, marginTop: 10 }}>
          Source active : {reading.energy_source}
        </Text>
      ) : null}
    </Card>
  );
}
