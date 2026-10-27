/**
 * Kit UI partagé pour les écrans LUMEN Android.
 * Reproduit le rendu des composants shadcn/ui du Web
 * (Card, Badge, Button, Input, Label, Select, Alert).
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch as RNSwitch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLumenPalette, type LumenPalette } from '@/constants/lumen-colors';

export function useLumenPalette(): LumenPalette {
  return getLumenPalette(useColorScheme() as 'light' | 'dark' | null);
}

export type Palette = LumenPalette;

/* ------------------------------------------------------------------ */
/* Squelette d'écran                                                   */
/* ------------------------------------------------------------------ */
export function Screen({
  COLORS,
  title,
  subtitle,
  back,
  onBack,
  children,
  scroll = true,
}: {
  COLORS: Palette;
  title: string;
  subtitle?: string;
  back?: string;
  onBack?: () => void;
  children: ReactNode;
  scroll?: boolean;
}) {
  const body = (
    <>
      {back && onBack ? (
        <Pressable onPress={onBack}>
          <Text style={s.backText}>← {back}</Text>
        </Pressable>
      ) : null}
      <Text style={[s.title, { color: COLORS.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[s.subtitle, { color: COLORS.muted }]}>{subtitle}</Text>
      ) : null}
      {children}
    </>
  );
  return (
    <SafeAreaView
      style={[s.safe, { backgroundColor: COLORS.background }]}
      edges={['top', 'left', 'right']}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          {body}
        </ScrollView>
      ) : (
        <View style={s.flex}>{body}</View>
      )}
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Chargement / erreur / vide                                          */
/* ------------------------------------------------------------------ */
export function LoadingScreen({ COLORS, label = 'Chargement...' }: { COLORS: Palette; label?: string }) {
  return (
    <SafeAreaView style={[s.safe, s.center, { backgroundColor: COLORS.background }]} edges={['top', 'left', 'right']}>
      <ActivityIndicator size="large" color={COLORS.success} />
      <Text style={[s.centerText, { color: COLORS.muted }]}>{label}</Text>
    </SafeAreaView>
  );
}

export function Card({
  COLORS,
  title,
  description,
  children,
  accent,
  style,
}: {
  COLORS: Palette;
  title?: string;
  description?: string;
  children?: ReactNode;
  accent?: string;
  style?: object;
}) {
  return (
    <View
      style={[
        s.card,
        { backgroundColor: COLORS.card, borderColor: COLORS.border },
        accent ? { borderTopWidth: 4, borderTopColor: accent } : null,
        style,
      ]}
    >
      {title ? <Text style={[s.cardTitle, { color: COLORS.text }]}>{title}</Text> : null}
      {description ? (
        <Text style={[s.cardDesc, { color: COLORS.muted }]}>{description}</Text>
      ) : null}
      {children}
    </View>
  );
}

export function Badge({
  COLORS,
  label,
  tone = 'muted',
}: {
  COLORS: Palette;
  label: string;
  tone?: 'muted' | 'success' | 'warning' | 'error' | 'primary' | 'outline';
}) {
  const tones: Record<string, { bg: string; border: string; fg: string }> = {
    muted: { bg: COLORS.mutedBg, border: COLORS.border, fg: COLORS.muted },
    success: { bg: COLORS.successBg, border: COLORS.successBorder, fg: COLORS.success },
    warning: { bg: COLORS.warningBg, border: COLORS.warningBorder, fg: COLORS.warning },
    error: { bg: COLORS.errorBg, border: COLORS.errorBorder, fg: COLORS.error },
    primary: { bg: COLORS.primary, border: COLORS.primary, fg: COLORS.onPrimary },
    outline: { bg: 'transparent', border: COLORS.border, fg: COLORS.muted },
  };
  const t = tones[tone] ?? tones.muted;
  return (
    <View style={[s.badge, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text style={[s.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function Button({
  COLORS,
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  small,
}: {
  COLORS: Palette;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
}) {
  const variants: Record<string, { bg: string; border: string; fg: string }> = {
    primary: { bg: COLORS.primary, border: COLORS.primary, fg: COLORS.onPrimary },
    outline: { bg: 'transparent', border: COLORS.border, fg: COLORS.text },
    ghost: { bg: 'transparent', border: 'transparent', fg: COLORS.success },
    danger: { bg: COLORS.errorBg, border: COLORS.errorBorder, fg: COLORS.error },
  };
  const v = variants[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        s.button,
        small ? s.buttonSmall : null,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: disabled || loading ? 0.55 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : (
        <Text style={[s.buttonText, { color: v.fg }, small ? s.buttonTextSmall : null]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Champs de formulaire                                                */
/* ------------------------------------------------------------------ */
export function Field({
  COLORS,
  label,
  children,
  hint,
}: {
  COLORS: Palette;
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <View style={s.field}>
      <Text style={[s.fieldLabel, { color: COLORS.text }]}>{label}</Text>
      {children}
      {hint ? (
        <Text style={[s.fieldHint, { color: COLORS.muted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Input({
  COLORS,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  multiline,
  disabled,
}: {
  COLORS: Palette;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'decimal-pad';
  multiline?: boolean;
  disabled?: boolean;
}) {
  return (
    <TextInput
      style={[
        s.input,
        {
          backgroundColor: COLORS.mutedBg,
          borderColor: COLORS.border,
          color: COLORS.text,
        },
        multiline ? s.inputMultiline : null,
      ]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.muted}
      secureTextEntry={secure}
      keyboardType={keyboardType ?? 'default'}
      multiline={multiline}
      editable={!disabled}
      autoCapitalize="none"
    />
  );
}

export function Select({
  COLORS,
  value,
  options,
  onChange,
  disabled,
}: {
  COLORS: Palette;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <View
      style={[
        s.select,
        {
          backgroundColor: COLORS.mutedBg,
          borderColor: COLORS.border,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={[s.chip, active && { backgroundColor: COLORS.primary }]}
            >
              <Text
                style={[
                  s.chipText,
                  { color: active ? COLORS.onPrimary : COLORS.muted },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function Switch({
  COLORS,
  checked,
  onChange,
  disabled,
}: {
  COLORS: Palette;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <RNSwitch
      value={checked}
      onValueChange={onChange}
      disabled={disabled}
      trackColor={{
        false: COLORS.track,
        true: COLORS.success,
      }}
      thumbColor={COLORS.card}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Alertes                                                             */
/* ------------------------------------------------------------------ */
export function AlertBox({
  COLORS,
  tone = 'error',
  children,
}: {
  COLORS: Palette;
  tone?: 'error' | 'warning' | 'success';
  children: ReactNode;
}) {
  const map = {
    error: { bg: COLORS.errorBg, border: COLORS.errorBorder, fg: COLORS.error },
    warning: { bg: COLORS.warningBg, border: COLORS.warningBorder, fg: COLORS.warning },
    success: { bg: COLORS.successBg, border: COLORS.successBorder, fg: COLORS.success },
  } as const;
  const t = map[tone];
  return (
    <View style={[s.alertBox, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text style={[s.alertText, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

export function EmptyState({ COLORS, icon, message }: { COLORS: Palette; icon: string; message: string }) {
  return (
    <Card COLORS={COLORS}>
      <View style={s.empty}>
        <Text style={{ fontSize: 40, color: COLORS.muted }}>{icon}</Text>
        <Text style={[s.emptyText, { color: COLORS.muted }]}>{message}</Text>
      </View>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */
const s = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1, padding: 20, gap: 14, paddingBottom: 36 },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerText: { fontSize: 13, marginTop: 4 },
  backText: { color: '#38D9A9', fontSize: 12, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 12, lineHeight: 18, marginTop: -8 },
  card: {
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
  },
  cardTitle: { fontSize: 14, fontWeight: '800' },
  cardDesc: { fontSize: 11, lineHeight: 16, marginTop: -6 },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '800' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: 12 },
  buttonText: { fontSize: 13, fontWeight: '800' },
  buttonTextSmall: { fontSize: 11 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700' },
  fieldHint: { fontSize: 10, lineHeight: 15 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  select: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 6,
    gap: 6,
  },
  chip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginHorizontal: 2,
    backgroundColor: 'transparent',
  },
  chipText: { fontSize: 11, fontWeight: '700' },
  alertBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  alertText: { fontSize: 12, lineHeight: 18 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  emptyText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
