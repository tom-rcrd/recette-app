import { router } from 'expo-router';
import { Body, Button, Card, H1, Muted, Screen } from '@/components/ui';
import { useData } from '@/lib/data';
import { supabase } from '@/lib/supabase';

const LINKS = [
  { href: '/import', title: 'Importer une recette', hint: 'URL, Instagram, TikTok, YouTube, photo, texte' },
  { href: '/ingredients', title: 'Ingrédients', hint: 'Produits de base et produits du commerce, nutrition, saisons, prix' },
  { href: '/techniques', title: 'Techniques', hint: 'Vidéos et photos de gestes : découpes, cuissons…' },
  { href: '/stats', title: 'Statistiques', hint: 'Repas cuisinés, argent économisé, aliments sauvés' },
] as const;

export default function More() {
  const { household, ingredients, recipes } = useData();
  return (
    <Screen>
      <H1>Plus</H1>
      <Muted>{household?.name} · {recipes.length} recettes · {ingredients.length} ingrédients</Muted>
      {LINKS.map((l) => (
        <Card key={l.href} onPress={() => router.push(l.href)}>
          <Body style={{ fontWeight: '700' }}>{l.title}</Body>
          <Muted>{l.hint}</Muted>
        </Card>
      ))}
      <Button label="Se déconnecter" variant="secondary" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
