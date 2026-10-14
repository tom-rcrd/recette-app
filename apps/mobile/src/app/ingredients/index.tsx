import { formatSeason, isInSeason, normalizeText } from '@recette/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Body, Button, Card, Chip, Field, Loading, Muted, Row, Screen, Tag } from '@/components/ui';
import { useData } from '@/lib/data';
import { INGREDIENT_CATEGORIES } from '@/lib/theme';

export default function Ingredients() {
  const { loading, ingredients } = useData();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | 'base' | 'product'>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [seasonal, setSeasonal] = useState(false);
  const month = new Date().getMonth() + 1;

  const list = useMemo(() => ingredients.filter((i) =>
    (kind === 'all' || i.kind === kind)
    && (!category || i.category === category)
    && (!seasonal || (i.season_months.length > 0 && isInSeason(i, month)))
    && (!q || normalizeText(`${i.name} ${i.brand ?? ''} ${i.aliases.join(' ')}`).includes(normalizeText(q))),
  ), [ingredients, q, kind, category, seasonal, month]);

  if (loading) return <Loading />;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Muted>{list.length} ingrédient{list.length > 1 ? 's' : ''}</Muted>
        <Button label="+ Nouvel ingrédient" onPress={() => router.push('/ingredients/new')} />
      </Row>
      <Field placeholder="Rechercher…" value={q} onChangeText={setQ} />
      <Row wrap>
        <Chip label="Tous" active={kind === 'all'} onPress={() => setKind('all')} />
        <Chip label="Produits de base" active={kind === 'base'} onPress={() => setKind('base')} />
        <Chip label="Produits du commerce" active={kind === 'product'} onPress={() => setKind('product')} />
        <Chip label="De saison ce mois-ci" tone="green" active={seasonal} onPress={() => setSeasonal(!seasonal)} />
      </Row>
      <Row wrap>
        {Object.entries(INGREDIENT_CATEGORIES).map(([k, l]) => (
          <Chip key={k} tone="neutral" label={l} active={category === k} onPress={() => setCategory(category === k ? null : k)} />
        ))}
      </Row>
      <Row wrap gap={10} style={{ alignItems: 'stretch' }}>
        {list.map((i) => (
          <Card key={i.id} onPress={() => router.push(`/ingredients/${i.id}`)} style={{ flexBasis: 240, flexGrow: 1, maxWidth: 360 }}>
            <Body style={{ fontWeight: '700' }}>{i.name}{i.brand ? ` · ${i.brand}` : ''}</Body>
            <Row wrap gap={6}>
              <Tag label={INGREDIENT_CATEGORIES[i.category] ?? i.category} />
              {i.kind === 'product' ? <Tag label="commerce" tone="accent" /> : null}
              {i.season_months.length ? <Tag label={formatSeason(i.season_months)} tone={isInSeason(i, month) ? 'green' : 'amber'} /> : null}
              {i.kcal == null ? <Tag label="nutrition à compléter" tone="amber" /> : <Tag label={`${Math.round(i.kcal)} kcal/100 g`} />}
            </Row>
          </Card>
        ))}
      </Row>
    </Screen>
  );
}
