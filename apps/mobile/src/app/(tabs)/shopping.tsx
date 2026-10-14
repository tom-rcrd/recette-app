import { AISLE_ORDER, buildShoppingList, formatQuantity, normalizeText } from '@recette/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Body, Button, Card, Chip, Empty, Field, H1, H2, Loading, Muted, Row, Screen } from '@/components/ui';
import { useData } from '@/lib/data';
import { notify } from '@/lib/alert';
import { supabase } from '@/lib/supabase';
import { INGREDIENT_CATEGORIES, useTheme } from '@/lib/theme';

interface ListItem { id: string; label: string; quantity: number | null; unit: string | null; category: string | null; checked: boolean }

export default function Shopping() {
  const t = useTheme();
  const { loading, household, recipes, catalog, pantry } = useData();
  const [selected, setSelected] = useState<Record<string, number>>({}); // recipeId → portions
  const [search, setSearch] = useState('');
  const [listId, setListId] = useState<string | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [saving, setSaving] = useState(false);

  const loadLatest = useCallback(async () => {
    const { data: list } = await supabase.from('shopping_lists').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!list) return;
    setListId(list.id);
    const { data } = await supabase.from('shopping_list_items').select('*').eq('list_id', list.id);
    setItems((data ?? []).map((i: any) => ({ ...i, quantity: i.quantity == null ? null : Number(i.quantity) })));
  }, []);
  useEffect(() => { loadLatest(); }, [loadLatest]);

  const preview = useMemo(() => buildShoppingList(
    Object.entries(selected).map(([id, servings]) => ({ recipe: recipes.find((r) => r.id === id)!, servings })).filter((p) => p.recipe),
    catalog, pantry,
  ), [selected, recipes, catalog, pantry]);

  if (loading || !household) return <Loading />;

  const matching = search.trim().length >= 2
    ? recipes.filter((r) => normalizeText(r.title).includes(normalizeText(search))).slice(0, 10)
    : [];

  async function generate() {
    if (!household) return;
    setSaving(true);
    try {
      const { data: list, error } = await supabase.from('shopping_lists')
        .insert({ household_id: household.id, name: `Courses du ${new Date().toLocaleDateString('fr-FR')}` })
        .select('id').single();
      if (error) throw error;
      const rows = preview.map((i) => ({
        list_id: list.id, ingredient_id: i.ingredient_id, label: i.label, quantity: i.quantity == null ? null : Math.round(i.quantity * 10) / 10,
        unit: i.unit, category: i.category, from_recipe_ids: i.from_recipe_ids,
      }));
      if (rows.length) {
        const { error: e2 } = await supabase.from('shopping_list_items').insert(rows);
        if (e2) throw e2;
      }
      setSelected({});
      await loadLatest();
    } catch (e) { notify('Erreur', (e as Error).message); }
    setSaving(false);
  }

  async function toggleItem(item: ListItem) {
    setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)));
    await supabase.from('shopping_list_items').update({ checked: !item.checked }).eq('id', item.id);
  }

  const grouped = AISLE_ORDER.map((cat) => [cat, items.filter((i) => (i.category ?? 'autre') === cat)] as const).filter(([, l]) => l.length);

  return (
    <Screen>
      <H1>Courses</H1>

      <Card>
        <Body style={{ fontWeight: '700' }}>1. Choisis les plats</Body>
        <Field placeholder="Ajouter un plat…" value={search} onChangeText={setSearch} />
        <Row wrap>
          {matching.map((r) => (
            <Chip key={r.id} label={r.title} onPress={() => { setSelected({ ...selected, [r.id]: r.servings }); setSearch(''); }} />
          ))}
        </Row>
        {Object.entries(selected).map(([id, servings]) => {
          const r = recipes.find((x) => x.id === id);
          if (!r) return null;
          return (
            <Row key={id} style={{ justifyContent: 'space-between' }}>
              <Body>{r.title}</Body>
              <Row>
                <Chip label="−" onPress={() => setSelected({ ...selected, [id]: Math.max(1, servings - 1) })} />
                <Muted>{servings} pers.</Muted>
                <Chip label="+" onPress={() => setSelected({ ...selected, [id]: servings + 1 })} />
                <Pressable onPress={() => { const { [id]: _, ...rest } = selected; setSelected(rest); }} hitSlop={10}>
                  <Text style={{ color: t.muted, fontSize: 18 }}>✕</Text>
                </Pressable>
              </Row>
            </Row>
          );
        })}
        {preview.length ? <Muted>{preview.length} article{preview.length > 1 ? 's' : ''} à acheter (le frigo est déjà déduit)</Muted> : null}
        <Button label="2. Générer la liste" onPress={generate} disabled={!preview.length} loading={saving} />
      </Card>

      <H2 right={listId ? <Muted>{items.filter((i) => i.checked).length}/{items.length}</Muted> : null}>Liste en cours</H2>
      {!items.length ? <Empty title="Pas de liste" hint="Sélectionne des plats ci-dessus." /> : null}
      {grouped.map(([cat, list]) => (
        <Card key={cat}>
          <Muted style={{ fontWeight: '700' }}>{INGREDIENT_CATEGORIES[cat] ?? cat}</Muted>
          {list.map((i) => (
            <Pressable key={i.id} onPress={() => toggleItem(i)}>
              <Row style={{ paddingVertical: 4 }}>
                <Text style={{ fontSize: 20, color: i.checked ? t.green : t.muted }}>{i.checked ? '☑' : '☐'}</Text>
                <Body style={{ textDecorationLine: i.checked ? 'line-through' : 'none', opacity: i.checked ? 0.5 : 1 }}>
                  {i.label}{i.quantity != null ? ` — ${formatQuantity(i.quantity, i.unit)}` : ''}
                </Body>
              </Row>
            </Pressable>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
