import type { Session } from '@supabase/supabase-js';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Loading } from '@/components/ui';
import { DataProvider } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import Login from '@/components/Login';

export default function RootLayout() {
  const t = useTheme();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <Loading />;
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
        <Stack.Screen name="recipe/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="recipe/[id]/cook" options={{ title: 'Mode cuisine', presentation: 'fullScreenModal' }} />
        <Stack.Screen name="import" options={{ title: 'Importer une recette' }} />
        <Stack.Screen name="ingredients/index" options={{ title: 'Ingrédients' }} />
        <Stack.Screen name="ingredients/[id]" options={{ title: 'Ingrédient' }} />
        <Stack.Screen name="techniques" options={{ title: 'Techniques' }} />
        <Stack.Screen name="stats" options={{ title: 'Statistiques' }} />
      </Stack>
    </DataProvider>
  );
}
