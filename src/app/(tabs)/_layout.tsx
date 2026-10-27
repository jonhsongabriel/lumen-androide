import { Tabs } from 'expo-router';
import { StyleSheet, Text, useColorScheme, type ColorValue } from 'react-native';
import { getLumenPalette } from '@/constants/lumen-colors';
import { TopNav } from '@/components/top-nav';

function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={[styles.icon, { color }]}>{glyph}</Text>;
}

export default function TabsLayout() {
  const COLORS = getLumenPalette(useColorScheme() as 'light' | 'dark' | null);
  return (
    <Tabs
      screenOptions={{
        header: () => <TopNav />,
        tabBarActiveTintColor: COLORS.success,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: styles.label,
        sceneStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tableau de bord',
          tabBarIcon: ({ color }) => (
            <TabIcon glyph="◧" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sites"
        options={{
          title: 'Mes centrales',
          tabBarIcon: ({ color }) => <TabIcon glyph="⚡" color={color} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alertes',
          tabBarIcon: ({ color }) => <TabIcon glyph="⚠" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <TabIcon glyph="◉" color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Plus',
          tabBarIcon: ({ color }) => <TabIcon glyph="•••" color={color} />,
        }}
      />
      <Tabs.Screen
        name="monitoring/[siteId]"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      {[
        'projects/index',
        'projects/add',
        'add-site',
        'connect',
        'deye',
        'realtime',
        'compare',
        'history',
        'configuration',
        'users',
        'notifications',
        'monitoring/index',
        'contact',
        'messages',
      ].map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            href: null,
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 20 },
  label: { fontSize: 10, fontWeight: '600' },
});
