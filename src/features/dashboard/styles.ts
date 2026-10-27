import { StyleSheet } from 'react-native';
import type { LumenPalette } from '@/constants/lumen-colors';
import { LIGHT } from '@/constants/lumen-colors';

/**
 * Styles partagés du tableau de bord. Créé une fois par palette
 * (light/dark) puis mémoïsé dans l'écran.
 */
export const createDashboardStyles = (COLORS: LumenPalette) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    header: {
      minHeight: 76,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    brand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
    },
    logo: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: COLORS.success,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoText: {
      color: COLORS.background,
      fontSize: 27,
      fontWeight: '900',
    },
    brandName: {
      color: COLORS.text,
      fontSize: 19,
      fontWeight: '800',
      letterSpacing: 2,
    },
    brandSubtitle: {
      color: COLORS.muted,
      fontSize: 8,
      letterSpacing: 1.2,
      marginTop: 3,
    },
    demoBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    badgeConnected: {
      borderColor: COLORS.successBorder,
      backgroundColor: COLORS.successBg,
    },
    badgeError: {
      borderColor: COLORS.errorBorder,
      backgroundColor: COLORS.errorBg,
    },
    demoDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    demoText: {
      fontSize: 9,
      fontWeight: '800',
    },
    content: {
      padding: 20,
      paddingBottom: 30,
      gap: 16,
    },
    greeting: {
      color: COLORS.text,
      fontSize: 27,
      fontWeight: '800',
    },
    subtitle: {
      color: COLORS.muted,
      fontSize: 13,
      marginTop: -10,
    },
    notice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 13,
      backgroundColor: COLORS.mutedBg,
      borderColor: COLORS.border,
      borderWidth: 1,
      borderRadius: 12,
    },
    noticeIcon: {
      color: COLORS.primary,
      fontSize: 18,
    },
    noticeContent: {
      flex: 1,
      gap: 10,
    },
    noticeText: {
      flex: 1,
      color: COLORS.text,
      opacity: 0.9,
      fontSize: 12,
      lineHeight: 18,
    },
    retryButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: COLORS.successBg,
      borderRadius: 9,
    },
    retryText: {
      color: COLORS.success,
      fontSize: 12,
      fontWeight: '800',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    sectionTitle: {
      color: COLORS.text,
      fontSize: 17,
      fontWeight: '700',
    },
    period: {
      color: COLORS.muted,
      fontSize: 9,
      letterSpacing: 0.8,
    },
    heroCard: {
      backgroundColor: COLORS.card,
      borderRadius: 18,
      padding: 19,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    heroTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    heroLabel: {
      color: COLORS.muted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
    },
    heroIcon: {
      fontSize: 25,
      color: COLORS.warning,
    },
    powerRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      marginTop: 12,
    },
    powerValue: {
      color: COLORS.text,
      fontSize: 43,
      fontWeight: '800',
    },
    powerUnit: {
      color: COLORS.muted,
      fontSize: 16,
    },
    heroFoot: {
      color: COLORS.muted,
      fontSize: 12,
      marginTop: 2,
    },
    progressTrack: {
      height: 6,
      borderRadius: 4,
      backgroundColor: COLORS.track,
      marginTop: 22,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: COLORS.success,
    },
    progressLabel: {
      color: COLORS.muted,
      fontSize: 10,
      marginTop: 8,
    },
    dashboardStatsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    dashboardStatCardWide: {
      width: '23.5%',
      flexGrow: 0,
      flexBasis: '23.5%',
    },
    metricCardWide: {
      width: '23.5%',
      flexGrow: 0,
      flexBasis: '23.5%',
    },
    dashboardStatCard: {
      width: '48%',
      flexGrow: 1,
      flexBasis: '42%',
      minHeight: 150,
      padding: 14,
      borderRadius: 15,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    dashboardStatTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    dashboardStatIcon: {
      fontSize: 22,
      fontWeight: '800',
    },
    dashboardStatLabel: {
      color: COLORS.muted,
      fontSize: 11,
      minHeight: 28,
    },
    dashboardStatValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 5,
      marginTop: 3,
    },
    dashboardStatValue: {
      color: COLORS.text,
      fontSize: 24,
      fontWeight: '800',
    },
    dashboardStatFoot: {
      color: COLORS.muted,
      fontSize: 9,
      lineHeight: 13,
      marginTop: 8,
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    metricCard: {
      width: '48%',
      flexGrow: 1,
      flexBasis: '42%',
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 15,
      padding: 14,
      minHeight: 139,
    },
    metricTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 13,
    },
    metricIcon: {
      fontSize: 23,
      fontWeight: '700',
    },
    metricIndicator: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    metricLabel: {
      color: COLORS.muted,
      fontSize: 11,
    },
    metricValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 5,
      marginTop: 5,
    },
    metricValue: {
      color: COLORS.text,
      fontSize: 25,
      fontWeight: '800',
    },
    metricUnit: {
      color: COLORS.muted,
      fontSize: 12,
    },
    metricFoot: {
      color: COLORS.muted,
      fontSize: 9,
      marginTop: 8,
      opacity: 0.9,
    },
    count: {
      color: COLORS.muted,
      fontSize: 10,
    },
    siteCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 14,
      borderRadius: 15,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    siteIcon: {
      width: 43,
      height: 43,
      borderRadius: 12,
      backgroundColor: COLORS.mutedBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    siteIconText: {
      color: COLORS.success,
      fontSize: 24,
      fontWeight: '700',
    },
    siteInfo: {
      flex: 1,
      gap: 4,
    },
    siteName: {
      color: COLORS.text,
      fontSize: 14,
      fontWeight: '700',
    },
    siteLocation: {
      color: COLORS.muted,
      fontSize: 11,
    },
    siteType: {
      color: COLORS.primary,
      fontSize: 11,
      marginTop: 2,
    },
    siteStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 5,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    siteStatusText: {
      color: COLORS.success,
      fontSize: 10,
    },
    siteMetrics: {
      marginTop: 9,
      gap: 5,
    },
    siteMetricText: {
      color: COLORS.text,
      fontSize: 11,
      opacity: 0.85,
    },
    siteWarning: {
      color: COLORS.warning,
      fontSize: 10,
      lineHeight: 16,
      marginTop: 5,
    },
    chevron: {
      color: COLORS.muted,
      fontSize: 25,
    },
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
    stateText: {
      color: COLORS.muted,
      fontSize: 12,
    },
    emptyCard: {
      padding: 18,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 14,
      gap: 9,
    },
    footerCard: {
      backgroundColor: COLORS.successBg,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: COLORS.successBorder,
      padding: 16,
      gap: 8,
    },
    footerTitle: {
      color: COLORS.success,
      fontSize: 14,
      fontWeight: '700',
    },
    footerText: {
      color: COLORS.muted,
      fontSize: 12,
      lineHeight: 19,
    },
    refreshButton: {
      alignSelf: 'flex-start',
      marginTop: 5,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 9,
      backgroundColor: COLORS.successBg,
    },
    refreshButtonText: {
      color: COLORS.success,
      fontSize: 11,
      fontWeight: '800',
    },
  });

export type DashboardStyles = ReturnType<typeof createDashboardStyles>;

/** Styles par défaut (palette LIGHT), utilisés par les cartes. */
export const dashboardStyles: DashboardStyles = createDashboardStyles(LIGHT);
