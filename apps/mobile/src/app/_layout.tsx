import type { Session } from '@supabase/supabase-js';
import { Stack } from 'expo-router';
// Imports par graisse : seules les polices utilisées sont embarquées
import { Outfit_400Regular } from '@expo-google-fonts/outfit/400Regular';
import { Outfit_500Medium } from '@expo-google-fonts/outfit/500Medium';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { Outfit_700Bold } from '@expo-google-fonts/outfit/700Bold';
import { YoungSerif_400Regular } from '@expo-google-fonts/young-serif/400Regular';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { Loading } from '@/components/ui';
import { DataProvider } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import Login from '@/components/Login';

export default function RootLayout() {
  const t = useTheme();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [fontsLoaded, fontError] = useFonts({ YoungSerif_400Regular, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Sans polices (erreur réseau…), on continue avec les polices système plutôt que de bloquer
  if (session === undefined || (!fontsLoaded && !fontError)) return <Loading />;
  if (!session) return <Login />;

  return (
    <DataProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.accent,
          headerTitleStyle: { color: t.text },
          contentStyle: { backgroundColor: t.bg },
          headerBackTitle: 'Retour',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="recipe/[id]/cook" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      </Stack>
    </DataProvider>
  );
}
