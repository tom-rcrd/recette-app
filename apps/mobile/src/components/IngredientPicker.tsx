import { matchIngredient, type Ingredient } from '@recette/core';
import { useMemo, useState } from 'react';
import { Chip, Field, Muted, Row } from './ui';

/** Recherche dans le catalogue ; propose aussi de créer l'ingrédient s'il n'existe pas. */
export function IngredientPicker({ catalog, onPick, onCreate, placeholder = 'Chercher un ingrédient…' }: {
  catalog: Ingredient[];
  onPick: (ingredient: Ingredient) => void;
  onCreate?: (name: string) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const results = useMemo(() => (q.trim().length < 2 ? [] : matchIngredient(q, catalog, 8)), [q, catalog]);
  return (
    <>
      <Field placeholder={placeholder} value={q} onChangeText={setQ} autoCorrect={false} />
      {q.trim().length >= 2 ? (
        <Row wrap>
          {results.map((m) => (
            <Chip key={m.ingredient.id} label={m.ingredient.brand ? `${m.ingredient.name} (${m.ingredient.brand})` : m.ingredient.name}
              onPress={() => { onPick(m.ingredient); setQ(''); }} />
          ))}
          {onCreate ? <Chip tone="green" label={`+ Créer « ${q.trim()} »`} onPress={() => { onCreate(q.trim()); setQ(''); }} /> : null}
          {!results.length && !onCreate ? <Muted>Aucun résultat</Muted> : null}
        </Row>
      ) : null}
    </>
  );
}
