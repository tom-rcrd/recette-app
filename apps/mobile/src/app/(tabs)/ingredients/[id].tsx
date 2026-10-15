import { MONTHS_FR, type Ingredient } from '@recette/core';
import { router, Tabs, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { IngredientPicker } from '@/components/IngredientPicker';
import { ProductScoreCard } from '@/components/ProductScore';
import { Body, Button, Card, Chip, Field, H2, Loading, Muted, Row, Screen, Tag } from '@/components/ui';
import { confirm, notify } from '@/lib/alert';
import { saveIngredient, useData } from '@/lib/data';
import { lookupBarcode } from '@/lib/off';
import { supabase } from '@/lib/supabase';
import { INGREDIENT_CATEGORIES } from '@/lib/theme';

const NUTRITION: [keyof Ingredient, string][] = [
  ['kcal', 'kcal'], ['protein_g', 'Protéines (g)'], ['carbs_g', 'Glucides (g)'], ['sugars_g', 'dont sucres (g)'],
  ['fat_g', 'Lipides (g)'], ['sat_fat_g', 'dont saturés (g)'], ['fiber_g', 'Fibres (g)'], ['salt_g', 'Sel (g)'],
];
const ALLERGENS = ['gluten', 'lait', 'oeuf', 'arachide', 'fruits_a_coque', 'soja', 'poisson', 'crustaces', 'celeri', 'moutarde', 'sesame', 'sulfites', 'lupin', 'mollusques'];

const blank: Partial<Ingredient> = {
  name: '', aliases: [], kind: 'base', category: 'autre', season_months: [], allergens: [], pairs_with: [],
  is_vegan: false, is_vegetarian: true, contains_lactose: false, contains_gluten: false,
};

export default function IngredientEditor() {
  const { id, barcode } = useLocalSearchParams<{ id: string; barcode?: string }>();
  const { loading, household, ingredients, catalog, refresh } = useData();
  const existing = id !== 'new' ? catalog.get(id) : undefined;
  const [ing, setIng] = useState<Partial<Ingredient>>(existing ?? blank);
  const [aliases, setAliases] = useState((existing?.aliases ?? []).join(', '));
  const [saving, setSaving] = useState(false);
  const [offStatus, setOffStatus] = useState<string | null>(null);
  const [offBusy, setOffBusy] = useState(false);

  /** Récupère le produit sur Open Food Facts. À la mise à jour, on garde ce que l'utilisateur a saisi lui-même. */
  async function fetchOff(code: string, mode: 'create' | 'refresh') {
    setOffBusy(true);
    setOffStatus(null);
    try {
      const off = await lookupBarcode(code);
      if (!off) {
        setIng((x) => ({ ...x, barcode: code, kind: 'product' }));
        setOffStatus('Produit absent d’Open Food Facts : complète la fiche à la main (tu peux aussi l’ajouter sur openfoodfacts.org).');
      } else {
        setIng((x) => {
          const merged: Partial<Ingredient> = { ...x, ...off };
          if (mode === 'refresh') {
            // Nom, catégorie et rayon choisis par l'utilisateur prioritaires
            merged.name = x.name || off.name;
            merged.category = x.category && x.category !== 'autre' ? x.category : off.category;
          }
          return merged;
        });
        setOffStatus(mode === 'create' ? 'Fiche remplie depuis Open Food Facts : vérifie et enregistre.' : 'Données Open Food Facts mises à jour.');
      }
    } catch (e) {
      setOffStatus((e as Error).message);
    }
    setOffBusy(false);
  }

  useEffect(() => {
    if (!existing && barcode) fetchOff(barcode, 'create');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcode]);

  if (loading || !household) return <Loading />;
  const set = <K extends keyof Ingredient>(k: K, v: Ingredient[K] | null) => setIng((x) => ({ ...x, [k]: v }));
  const numField = (k: keyof Ingredient, label: string) => (
    <Field key={k} label={label} keyboardType="decimal-pad" style={{ width: 120 }}
      value={ing[k] == null ? '' : String(ing[k])}
      onChangeText={(v) => set(k, (v.trim() === '' ? null : Number(v.replace(',', '.'))) as never)} />
  );

  async function save() {
    if (!household || !ing.name?.trim()) return;
    setSaving(true);
    try {
      const { id: _id, ...rest } = ing as Ingredient;
      await saveIngredient(household.id, {
        ...rest, ...(existing ? { id: existing.id } : {}), name: ing.name.trim(),
        aliases: aliases.split(',').map((a) => a.trim()).filter(Boolean),
      });
      await refresh();
      router.back();
    } catch (e) { notify('Erreur', (e as Error).message); setSaving(false); }
  }

  async function remove() {
    if (!existing || !(await confirm('Supprimer cet ingrédient ?', 'Les recettes garderont le texte d’origine.', 'Supprimer'))) return;
    await supabase.from('ingredients').delete().eq('id', existing.id);
    await refresh();
    router.back();
  }

  const months = ing.season_months ?? [];
  const pairs = ing.pairs_with ?? [];

  return (
    <Screen>
      <Tabs.Screen options={{ title: existing?.name ?? (barcode ? 'Produit scanné' : 'Nouvel ingrédient') }} />
      {offBusy ? <Muted>Recherche sur Open Food Facts…</Muted> : null}
      {offStatus ? <Muted>{offStatus}</Muted> : null}
      {ing.kind === 'product' && (ing.barcode || ing.nutriscore_grade) ? (
        <ProductScoreCard ingredient={{ id: 'draft', aliases: [], season_months: [], allergens: [], ...ing } as Ingredient} criteria={household.score_criteria} />
      ) : null}
      <Card>
        <Row wrap>
          <Field label="Nom" value={ing.name ?? ''} onChangeText={(v) => set('name', v)} />
          <Field label="Marque (produit du commerce)" value={ing.brand ?? ''} onChangeText={(v) => set('brand', v || null)} />
        </Row>
        {ing.kind === 'product' ? (
          <Row>
            <Field label="Code-barres" value={ing.barcode ?? ''} onChangeText={(v) => set('barcode', v.trim() || null)} keyboardType="number-pad" />
            <Button label={offBusy ? '…' : 'Actualiser depuis Open Food Facts'} variant="secondary" disabled={!ing.barcode || offBusy}
              onPress={() => fetchOff(ing.barcode!, existing ? 'refresh' : 'create')} />
          </Row>
        ) : null}
        <Field label="Autres noms (séparés par des virgules) — aident à reconnaître l’ingrédient à l’import" value={aliases} onChangeText={setAliases} />
        <Row wrap>
          <Chip label="Produit de base" active={ing.kind === 'base'} onPress={() => set('kind', 'base')} />
          <Chip label="Produit du commerce (transformé, emballé)" active={ing.kind === 'product'} onPress={() => set('kind', 'product')} />
        </Row>
        <Row wrap>
          {Object.entries(INGREDIENT_CATEGORIES).map(([k, l]) => (
            <Chip key={k} tone="neutral" label={l} active={ing.category === k} onPress={() => set('category', k)} />
          ))}
        </Row>
      </Card>

      <Card>
        <H2>Saison</H2>
        <Muted>Aucun mois sélectionné = disponible toute l’année.</Muted>
        <Row wrap>
          {MONTHS_FR.map((m, i) => (
            <Chip key={m} tone="green" label={m} active={months.includes(i + 1)}
              onPress={() => set('season_months', months.includes(i + 1) ? months.filter((x) => x !== i + 1) : [...months, i + 1].sort((a, b) => a - b))} />
          ))}
        </Row>
      </Card>

      <Card>
        <H2>Nutrition <Muted>pour 100 g</Muted></H2>
        <Row wrap>{NUTRITION.map(([k, l]) => numField(k, l))}</Row>
        <H2>Conversions</H2>
        <Row wrap>
          {numField('grams_per_piece', 'Poids d’une pièce (g)')}
          {numField('density', 'Densité (g/ml)')}
        </Row>
        <Muted>Ex. 1 oignon ≈ 150 g, huile ≈ 0,92 g/ml. Sert au calcul nutritionnel et à la liste de courses.</Muted>
      </Card>

      <Card>
        <H2>Régimes & allergènes</H2>
        <Row wrap>
          <Chip tone="green" label="Végétarien" active={!!ing.is_vegetarian} onPress={() => set('is_vegetarian', !ing.is_vegetarian)} />
          <Chip tone="green" label="Vegan" active={!!ing.is_vegan} onPress={() => set('is_vegan', !ing.is_vegan)} />
          <Chip tone="amber" label="Contient du lactose" active={!!ing.contains_lactose} onPress={() => set('contains_lactose', !ing.contains_lactose)} />
          <Chip tone="amber" label="Contient du gluten" active={!!ing.contains_gluten} onPress={() => set('contains_gluten', !ing.contains_gluten)} />
        </Row>
        <Row wrap>
          {ALLERGENS.map((a) => {
            const list = ing.allergens ?? [];
            return <Chip key={a} tone="neutral" label={a.replace(/_/g, ' ')} active={list.includes(a)}
              onPress={() => set('allergens', list.includes(a) ? list.filter((x) => x !== a) : [...list, a])} />;
          })}
        </Row>
      </Card>

      <Card>
        <H2>Prix indicatif</H2>
        <Row wrap>
          {numField('price', 'Prix (€)')}
          {numField('price_quantity', 'pour quantité')}
          <Field label="unité" value={ing.price_unit ?? ''} onChangeText={(v) => set('price_unit', v || null)} placeholder="g, ml, pièce" style={{ width: 120 }} />
        </Row>
        <Muted>Ex. 2,50 € pour 1000 g. Sert au coût par portion et aux statistiques.</Muted>
      </Card>

      <Card>
        <H2>Va bien avec</H2>
        <Row wrap>
          {pairs.map((p) => (
            <Chip key={p} label={`${catalog.get(p)?.name ?? '?'} ✕`} onPress={() => set('pairs_with', pairs.filter((x) => x !== p))} />
          ))}
          {!pairs.length ? <Muted>Suggestions d’accompagnement affichées sur les recettes.</Muted> : null}
        </Row>
        <IngredientPicker catalog={ingredients.filter((x) => x.id !== existing?.id)}
          onPick={(p) => !pairs.includes(p.id) && set('pairs_with', [...pairs, p.id])} />
      </Card>

      <Row wrap>
        <Button label="Enregistrer" onPress={save} loading={saving} disabled={!ing.name?.trim()} />
        {existing ? <Button label="Supprimer" variant="danger" onPress={remove} /> : null}
      </Row>
      {existing?.kind === 'product' ? <Body><Tag label="Astuce" /> Les valeurs nutritionnelles sont sur l’étiquette du produit.</Body> : null}
    </Screen>
  );
}
