
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { getLumenPalette } from '@/constants/lumen-colors';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = getLumenPalette(
    scheme as 'light' | 'dark' | null,
  );

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.successBg}
      labelStyle={{
        selected: { color: colors.primary },
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>
          Tableau de bord
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>
          Mes centrales
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}