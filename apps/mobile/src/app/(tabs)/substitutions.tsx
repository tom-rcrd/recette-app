import { isAnimalMilk, plantMilks, type Ingredient } from '@recette/core';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { IngredientPicker } from '@/components/IngredientPicker';
import { Body, Button, Card, Chip, Empty, Field, H2, Loading, Muted, Row, Screen, Tag } from '@/components/ui';
import { confirm, notify } from '@/lib/alert';
import { deleteSubstitution, saveSubstitution, useData } from '@/lib/data';
import { useTheme } from '@/lib/theme';

export default function Substitutions() {
  const t = useTheme();
  const { loading, household, ingredients, catalog, recipes, substitutions, refresh } = useData();
  const [from, setFrom] = useState<Ingredient | null>(null);
  const [to, setTo] = useState<Ingredient | null>(null);
  const [ratio, setRatio] = useState('1');
  const [note, setNote] = useState('');

  if (loading || !household) return <Loading />;

  // Nombre de recettes concernées par chaque remplacement
  const usage = (fromId: string) => recipes.filter((r) => r.ingredients.some((l) => l.substituted_from?.ingredient_id === fromId)).length;

  async function run(fn: () => Promise<void>) {
    try { await fn(); await refresh(); } catch (e) { notify('Erreur', (e as Error).message); }
  }

  async function add() {
    if (!from || !to || !household) return;
    await run(() => saveSubstitution(household.id, {
      from_ingredient_id: from.id, to_ingredient_id: to.id, ratio: Number(ratio.replace(',', '.')) || 1, active: true, note: note.trim() || null,
    }));
    setFrom(null); setTo(null); setRatio('1'); setNote('');
  }

  // Raccourci : lait animal du catalogue non encore remplacé
  const replaced = new Set(substitutions.map((s) => s.from_ingredient_id));
  const milks = ingredients.filter((i) => isAnimalMilk(i) && !replaced.has(i.id));
  const plants = plantMilks(ingredients);

  return (
    <Screen>
      <Muted>
        Un remplacement s’applique automatiquement à toutes tes recettes : affichage, nutrition, frigo, liste de courses et mode cuisine.
        Les recettes d’origine ne sont pas modifiées.
      </Muted>

      {milks.length && plants.length ? (
        <Card style={{ backgroundColor: t.greenSoft, borderColor: t.green }}>
          <Body style={{ fontWeight: '700' }}>🥛 Remplacer le lait animal par une boisson végétale</Body>
          {milks.map((m) => (
            <Row key={m.id} wrap>
              <Muted>« {m.name} » →</Muted>
              {plants.map((p) => (
                <Chip key={p.id} tone="green" label={p.name}
                  onPress={() => run(() => saveSubstitution(household.id, { from_ingredient_id: m.id, to_ingredient_id: p.id, ratio: 1, active: true, note: null }))} />
              ))}
            </Row>
          ))}
        </Card>
      ) : null}

      <H2>Mes remplacements</H2>
      {!substitutions.length ? <Empty title="Aucun remplacement" hint="Ajoute-en un ci-dessous, ou depuis une recette qui contient du lait." /> : null}
      {substitutions.map((s) => {
        const n = usage(s.from_ingredient_id);
        return (
          <Card key={s.id}>
            <Row style={{ justifyContent: 'space-between' }} wrap>
              <Row wrap>
                <Body style={{ fontWeight: '700', opacity: s.active ? 1 : 0.5 }}>
                  {catalog.get(s.from_ingredient_id)?.name ?? '?'} → {catalog.get(s.to_ingredient_id)?.name ?? '?'}
                </Body>
                {s.ratio !== 1 ? <Tag label={`× ${String(s.ratio).replace('.', ',')}`} /> : null}
                <Tag label={s.active ? `${n} recette${n > 1 ? 's' : ''}` : 'désactivé'} tone={s.active ? 'green' : 'neutral'} />
              </Row>
              <Row>
                <Chip label={s.active ? 'Désactiver' : 'Activer'} onPress={() => run(() => saveSubstitution(household.id, { ...s, active: !s.active }))} />
                <Pressable hitSlop={10} onPress={async () => {
                  if (await confirm('Supprimer ce remplacement ?', 'Les recettes afficheront à nouveau l’ingrédient d’origine.', 'Supprimer')) run(() => deleteSubstitution(s.id));
                }}>
                  <Text style={{ color: t.muted, fontSize: 18 }}>✕</Text>
                </Pressable>
              </Row>
            </Row>
            {s.note ? <Muted>{s.note}</Muted> : null}
          </Card>
        );
      })}

      <Card>
        <H2>Ajouter un remplacement</H2>
        <Muted>Remplacer…</Muted>
        {from ? <Row><Tag label={from.name} tone="accent" /><Pressable onPress={() => setFrom(null)}><Muted>changer</Muted></Pressable></Row>
          : <IngredientPicker catalog={ingredients} onPick={setFrom} placeholder="Ex. crème fraîche" />}
        <Muted>…par</Muted>
        {to ? <Row><Tag label={to.name} tone="green" /><Pressable onPress={() => setTo(null)}><Muted>changer</Muted></Pressable></Row>
          : <IngredientPicker catalog={ingredients.filter((i) => i.id !== from?.id)} onPick={setTo} placeholder="Ex. crème de soja" />}
        <Row wrap>
          <Field label="Quantité (× l’originale)" value={ratio} onChangeText={setRatio} keyboardType="decimal-pad" style={{ width: 160 }} />
          <Field label="Note (optionnel)" value={note} onChangeText={setNote} placeholder="Ex. ajouter 1 c. à café de citron" />
        </Row>
        <Button label="Ajouter" onPress={add} disabled={!from || !to} />
      </Card>
    </Screen>
  );
}
