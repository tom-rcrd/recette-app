import { Tabs } from 'expo-router';
import { Text, useWindowDimensions, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS, useTheme } from '@/lib/theme';

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => <Text style={{ fontSize: 18, lineHeight: 20, color }}>{glyph}</Text>;

// Écrans secondaires : dans la navigation par onglets (le menu reste visible) mais absents de la barre
const HIDDEN: { name: string; title: string }[] = [
  { name: 'choose', title: 'Choisir un plat' },
  { name: 'import', title: 'Nouvelle recette' },
  { name: 'recipe/[id]/index', title: 'Recette' },
  { name: 'ingredients/[id]', title: 'Ingrédient' },
  { name: 'ingredients/scan', title: 'Scanner un produit' },
  { name: 'criteria', title: 'Mes critères' },
  { name: 'substitutions', title: 'Mes remplacements' },
  { name: 'techniques', title: 'Techniques' },
  { name: 'stats', title: 'Statistiques' },
];

export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const narrow = useWindowDimensions().width < 600;
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTitleStyle: { color: t.text, fontFamily: FONTS.serif, fontSize: 22 },
        headerShadowVisible: false,
        // Même marge que le contenu des pages (Screen : padding 20)
        headerTitleAlign: 'left',
        headerTitleContainerStyle: { paddingLeft: 20 },
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        // Hauteur explicite : icône + libellé + zone sûre (barre d'accueil iPad/iPhone)
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border, height: 70 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom + 6 },
        // Un onglet fait 49 px de haut sur le web : icône (22) + libellé (14) doivent y tenir
        tabBarIconStyle: { height: 22 },
        tabBarLabelStyle: { fontFamily: FONTS.medium, fontSize: narrow ? 10 : 12, lineHeight: 14, marginTop: 2 },
        tabBarLabelPosition: 'below-icon',
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: icon('☀︎'), headerShown: false }} />
      <Tabs.Screen name="recipes" options={{ title: 'Recettes', tabBarIcon: icon('▤') }} />
      <Tabs.Screen name="ingredients" options={{ title: 'Ingrédients', tabBarIcon: icon('✿') }} />
      <Tabs.Screen name="fridge" options={{ title: 'Frigo', tabBarIcon: icon('❄︎') }} />
      <Tabs.Screen name="shopping" options={{ title: 'Courses', tabBarIcon: icon('✓') }} />
      <Tabs.Screen name="impact" options={{ title: 'Impact', tabBarIcon: icon('❀') }} />
      <Tabs.Screen name="more" options={{ title: 'Plus', tabBarIcon: icon('⋯') }} />
      {HIDDEN.map((s) => <Tabs.Screen key={s.name} name={s.name} options={{ title: s.title, href: null }} />)}
    </Tabs>
  );
}
