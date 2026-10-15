import { formatQuantity, type Ingredient } from '@recette/core';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { IngredientPicker } from '@/components/IngredientPicker';
import { Body, Button, Card, Chip, Empty, Field, H1, H2, Loading, Muted, Row, Screen, Tag } from '@/components/ui';
import { deletePantryItem, saveIngredient, upsertPantryItem, today, useData } from '@/lib/data';
import { notify } from '@/lib/alert';
import { PANTRY_LOCATIONS, useTheme } from '@/lib/theme';

const addDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export default function Fridge() {
  const t = useTheme();
  const { loading, household, ingredients, catalog, pantry, refresh } = useData();
  const [location, setLocation] = useState('frigo');
  const [picked, setPicked] = useState<Ingredient | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [expires, setExpires] = useState<string | null>(null);
  const [staple, setStaple] = useState(false);

  if (loading || !household) return <Loading />;

  async function add() {
    if (!picked || !household) return;
    try {
      await upsertPantryItem(household.id, {
        ingredient_id: picked.id, location, quantity: quantity ? Number(quantity.replace(',', '.')) : null,
        unit: unit || null, expires_on: expires, is_staple: staple,
      });
      setPicked(null); setQuantity(''); setUnit(''); setExpires(null); setStaple(false);
      await refresh();
    } catch (e) { notify('Erreur', (e as Error).message); }
  }

  async function createAndPick(name: string) {
    if (!household) return;
    await saveIngredient(household.id, { name, category: 'autre', kind: 'base' });
    await refresh();
  }

  const now = today();
  const soon = addDays(3);

  return (
    <Screen>
      <H1>Le frigo</H1>
      <Muted>Ce que tu as sous la main : frigo, placards, étagère à épices, huiles… Les suggestions s’en servent.</Muted>

      <Card>
        <Body style={{ fontWeight: '700' }}>Ajouter</Body>
        <Row wrap>
          {Object.entries(PANTRY_LOCATIONS).map(([k, label]) => (
            <Chip key={k} label={label} active={location === k} onPress={() => setLocation(k)} />
          ))}
        </Row>
        {picked ? (
          <Row wrap>
            <Tag label={picked.name} tone="accent" />
            <Pressable onPress={() => setPicked(null)}><Muted>changer</Muted></Pressable>
          </Row>
        ) : (
          <IngredientPicker catalog={ingredients} onPick={setPicked} onCreate={createAndPick} />
        )}
        <Row wrap>
          <Field label="Quantité (optionnel)" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" style={{ minWidth: 120 }} />
          <Field label="Unité" value={unit} onChangeText={setUnit} placeholder="g, ml, pièce…" style={{ minWidth: 120 }} />
        </Row>
        <Row wrap>
          <Muted>Péremption :</Muted>
          {[['aucune', null], ['demain', addDays(1)], ['3 j', addDays(3)], ['1 sem.', addDays(7)], ['1 mois', addDays(30)]].map(([label, v]) => (
            <Chip key={label as string} tone="amber" label={label as string} active={expires === v} onPress={() => setExpires(v)} />
          ))}
          <Chip tone="green" label="Toujours là (sel, huile…)" active={staple} onPress={() => setStaple(!staple)} />
        </Row>
        <Button label="Ajouter au frigo" onPress={add} disabled={!picked} />
      </Card>

      {pantry.length === 0 ? <Empty title="Le frigo est vide" hint="Ajoute ce que tu as pour des suggestions « avec ce que j’ai »." /> : null}
      {Object.entries(PANTRY_LOCATIONS).map(([loc, label]) => {
        const items = pantry
          .filter((p) => p.location === loc)
          .sort((a, b) => (a.expires_on ?? '9999').localeCompare(b.expires_on ?? '9999'));
        if (!items.length) return null;
        return (
          <Card key={loc}>
            <H2>{label}</H2>
            {items.map((p) => {
              const ing = catalog.get(p.ingredient_id);
              const expired = p.expires_on && p.expires_on < now;
              const expSoon = p.expires_on && p.expires_on <= soon;
              return (
                <Row key={p.id} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Row wrap>
                    <Body>{ing?.name ?? '?'}</Body>
                    {p.quantity != null ? <Muted>{formatQuantity(p.quantity, p.unit)}</Muted> : null}
                    {p.is_staple ? <Tag label="toujours là" tone="green" /> : null}
                    {expSoon ? <Tag label={expired ? 'périmé' : `avant le ${p.expires_on!.slice(8)}/${p.expires_on!.slice(5, 7)}`} tone={expired ? 'danger' : 'amber'} /> : null}
                  </Row>
                  <Pressable onPress={async () => { await deletePantryItem(p.id); await refresh(); }} hitSlop={10}>
                    <Text style={{ color: t.muted, fontSize: 18 }}>✕</Text>
                  </Pressable>
                </Row>
              );
            })}
          </Card>
        );
      })}
    </Screen>
  );
}
