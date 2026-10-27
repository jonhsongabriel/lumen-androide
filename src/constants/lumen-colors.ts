/**
 * Palette LUMEN harmonisée avec le projet LUMEN Web
 * (D:\Sauvegarde projet Lumaine prod\Lumensolaire\src\index.css).
 *
 * Les valeurs HSL du Web ont été converties en hexadécimal :
 *  light  --background 210 40% 98%  -> #F8FAFC
 *  light  --foreground 215 25% 15%  -> #1D2530
 *  light  --card 0 0% 100%          -> #FFFFFF
 *  light  --primary 210 85% 45%     -> #1163D4
 *  light  --muted-foreground 215 15% 45% -> #627084
 *  light  --border 214 25% 88%      -> #D9DFE8
 *  light  --muted 210 30% 95%       -> #EFF2F6
 *  light  --success 150 60% 50%     -> #33CC80
 *  light  --warning 45 95% 55%      -> #F9C31F
 *  light  --error 0 84% 60%         -> #EF4343
 *  dark   --background 215 30% 12%  -> #151D28
 *  dark   --foreground 215 25% 95%? -> --foreground 210 30% 95% -> #EDF1F5
 *  dark   --card 215 28% 16%        -> #1D2734
 *  dark   --primary 210 85% 55%     -> #2B7CEE
 *  dark   --muted 215 25% 20%       -> #263140
 *  dark   --muted-foreground 215 15% 65% -> #98A4B3
 *  dark   --border 215 20% 25%      -> #333E4D
 */

export type LumenPalette = {
  background: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  mutedBg: string;
  primary: string;
  success: string;
  warning: string;
  error: string;
  onPrimary: string;
  // Surfaces dérivées (badges, notes, pistes de progression)
  successBg: string;
  successBorder: string;
  errorBg: string;
  errorBorder: string;
  warningBg: string;
  warningBorder: string;
  track: string;
  // Couleurs de statut exactes de la carte Web (SiteMap.tsx)
  statusOnline: string;
  statusAlert: string;
  statusOffline: string;
  statusUnknown: string;
  // Couleurs de cartes indicateurs (MonitoringPage : border-t-4)
  accentProduction: string;
  accentConsumption: string;
  accentBattery: string;
  accentTemperature: string;
};

export const LIGHT: LumenPalette = {
  background: '#F8FAFC',
  card: '#FFFFFF',
  border: '#D9DFE8',
  text: '#1D2530',
  muted: '#627084',
  mutedBg: '#EFF2F6',
  primary: '#1163D4',
  success: '#33CC80',
  warning: '#F9C31F',
  error: '#EF4343',
  onPrimary: '#FFFFFF',
  successBg: '#E6F7EF',
  successBorder: '#B4E8CC',
  errorBg: '#FDECEC',
  errorBorder: '#F5BDBD',
  warningBg: '#FEF6E0',
  warningBorder: '#F5DFA0',
  track: '#E2E8F0',
  statusOnline: '#16A34A',
  statusAlert: '#F59E0B',
  statusOffline: '#DC2626',
  statusUnknown: '#6B7280',
  // Couleurs de cartes indicateurs (MonitoringPage : border-t-4)
  accentProduction: '#F59E0B', // amber-500
  accentConsumption: '#3B82F6', // blue-500
  accentBattery: '#10B981', // emerald-500
  accentTemperature: '#14B8A6', // teal-500
};

export const DARK: LumenPalette = {
  background: '#151D28',
  card: '#1D2734',
  border: '#333E4D',
  text: '#EDF1F5',
  muted: '#98A4B3',
  mutedBg: '#263140',
  primary: '#2B7CEE',
  success: '#33CC80',
  warning: '#F9C31F',
  error: '#EF4343',
  onPrimary: '#0B1220',
  successBg: '#173327',
  successBorder: '#22563F',
  errorBg: '#3A1D20',
  errorBorder: '#5A2A2E',
  warningBg: '#33290F',
  warningBorder: '#57451A',
  track: '#263140',
  statusOnline: '#16A34A',
  statusAlert: '#F59E0B',
  statusOffline: '#DC2626',
  statusUnknown: '#6B7280',
  accentProduction: '#F59E0B',
  accentConsumption: '#3B82F6',
  accentBattery: '#10B981',
  accentTemperature: '#14B8A6',
};

/** Renvoie la palette LUMEN Web selon le schéma de couleurs. */
export function getLumenPalette(
  scheme: 'light' | 'dark' | 'unspecified' | null | undefined,
): LumenPalette {
  return scheme === 'dark' ? DARK : LIGHT;
}
