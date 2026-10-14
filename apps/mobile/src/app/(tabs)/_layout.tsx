import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { useTheme } from '@/lib/theme';

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => <Text style={{ fontSize: 20, color }}>{glyph}</Text>;

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTitleStyle: { color: t.text },
        headerShadowVisible: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Aujourd’hui', tabBarIcon: icon('☀︎') }} />
      <Tabs.Screen name="recipes" options={{ title: 'Recettes', tabBarIcon: icon('▤') }} />
      <Tabs.Screen name="fridge" options={{ title: 'Frigo', tabBarIcon: icon('❄︎') }} />
      <Tabs.Screen name="shopping" options={{ title: 'Courses', tabBarIcon: icon('✓') }} />
      <Tabs.Screen name="more" options={{ title: 'Plus', tabBarIcon: icon('⋯') }} />
    </Tabs>
  );
}
