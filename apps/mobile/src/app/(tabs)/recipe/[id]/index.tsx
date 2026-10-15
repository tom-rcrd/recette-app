import {
  completenessScore, computeRecipeNutrition, durationClass, estimateRecipeCost, formatQuantity, nutritionMessages,
  isInSeason, substitutionSuggestions, suggestRecipes, totalMinutes,
} from '@recette/core';
import { router, Tabs, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { confirm, notify } from '@/lib/alert';
import { NutritionMessageList } from '@/components/NutritionMessages';
import { RecipeCard } from '@/components/RecipeCard';
import { Body, Button, Card, Chip, Field, H1, H2, Loading, Muted, Row, Screen, Tag } from '@/components/ui';
import { addNote, deleteRecipe, fetchNotes, logMeal, saveSubstitution, setRating, setTags, today, useData } from '@/lib/data';
import { DURATION_LABELS, EQUIPMENT_LABELS, MEAL_TYPE_LABELS, useTheme } from '@/lib/theme';

const NOTE_KINDS = { note: 'Note', improvement: 'À améliorer', variant: 'Variante', cook_feedback: 'Après cuisson' } as const;
type NoteKind = keyof typeof NOTE_KINDS;

export default function RecipeDetail() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, household, recipes, catalog, pantry, history, refresh } = useData();
  const recipe = recipes.find((r) => r.id === id);
  const [servings, setServings] = useState<number | null>(null);
  const [notes, setNotes] = useState<{ id: string; kind: string; body: string; created_at: string }[]>([]);
  const [noteKind, setNoteKind] = useState<NoteKind>('note');
  const [noteText, setNoteText] = useState('');

  const loadNotes = useCallback(() => { if (id) fetchNotes(id).then(setNotes).catch(() => {}); }, [id]);
  useEffect(loadNotes, [loadNotes]);

  const nutrition = useMemo(() => (recipe ? computeRecipeNutrition(recipe, catalog) : null), [recipe, catalog]);

  // Accompagnements : recettes "accompagnement/entrée" les mieux classées dans le contexte actuel
  const sides = useMemo(() => {
    if (!recipe || recipe.dish_type !== 'plat') return [];
    return suggestRecipes(recipes.filter((r) => r.id !== recipe.id), { catalog, pantry, history, today: today() },
      { dishTypes: ['accompagnement', 'entree'] }).slice(0, 3);
  }, [recipe, recipes, catalog, pantry, history]);
  const pairingIngredients = useMemo(() => {
    if (!recipe) return [];
    const ids = new Set(recipe.ingredients.flatMap((l) => (l.ingredient_id ? catalog.get(l.ingredient_id)?.pairs_with ?? [] : [])));
    return [...ids].map((i) => catalog.get(i)?.name).filter(Boolean) as string[];
  }, [recipe, catalog]);

  if (loading || !household) return <Loading />;
  if (!recipe || !nutrition) return <Screen><Muted>Recette introuvable.</Muted></Screen>;

  const factor = (servings ?? recipe.servings) / recipe.servings;
  const have = new Set(pantry.map((p) => p.ingredient_id));
  const month = new Date().getMonth() + 1;
  const ps = nutrition.perServing;
  const score = completenessScore(ps, recipe, catalog);
  const messages = nutritionMessages(ps, recipe, catalog);
  const cost = estimateRecipeCost(recipe, catalog);
  const dc = durationClass(recipe);
  let currentGroup: string | null | undefined;

  async function cooked() {
    if (!recipe || !household) return;
    try {
      await logMeal(household.id, recipe, catalog, pantry, { servings: servings ?? recipe.servings });
      await refresh();
      notify('Noté !', 'Ce plat descendra dans les suggestions des prochains jours.');
    } catch (e) { notify('Erreur', (e as Error).message); }
  }

  async function submitNote() {
    if (!noteText.trim() || !recipe) return;
    await addNote(recipe.id, noteKind, noteText.trim());
    setNoteText('');
    loadNotes();
  }

  return (
    <Screen>
      <Tabs.Screen options={{ title: recipe.title }} />
      {recipe.image_url ? <Image source={{ uri: recipe.image_url }} style={{ width: '100%', height: 260, borderRadius: 14 }} /> : null}
      <H1>{recipe.title}</H1>
      {recipe.description ? <Body>{recipe.description}</Body> : null}

      <Row wrap gap={6}>
        <Tag label={`${DURATION_LABELS[dc]} · ${totalMinutes(recipe)} min`} tone={dc === 'rapide' ? 'green' : dc === 'moyen' ? 'amber' : 'accent'} />
        <Tag label={`Prépa ${recipe.prep_min} min`} />
        {recipe.cook_min ? <Tag label={`Cuisson ${recipe.cook_min} min`} /> : null}
        {recipe.rest_min ? <Tag label={`Repos ${recipe.rest_min} min`} /> : null}
        {recipe.meal_types.map((m) => <Tag key={m} label={MEAL_TYPE_LABELS[m] ?? m} tone="accent" />)}
        {recipe.equipment.map((e) => <Tag key={e} label={EQUIPMENT_LABELS[e] ?? e} />)}
        {recipe.tags.map((tg) => <Tag key={tg} label={tg.replace(/_/g, ' ')} tone="green" />)}
      </Row>

      {/* Ingrédients d'origine animale à remplacer (lait…) */}
      {substitutionSuggestions(recipe, catalog).map((sug) => (
        <Card key={sug.from.id} style={{ backgroundColor: t.amberSoft, borderColor: t.amber }}>
          <Body style={{ fontWeight: '700' }}>🥛 Cette recette contient du lait d’origine animale (« {sug.from.name} »)</Body>
          {sug.candidates.length ? (
            <>
              <Muted>Le remplacer automatiquement dans toutes tes recettes par :</Muted>
              <Row wrap>
                {sug.candidates.map((c) => (
                  <Chip key={c.id} tone="green" label={c.name} onPress={async () => {
                    try {
                      await saveSubstitution(household.id, { from_ingredient_id: sug.from.id, to_ingredient_id: c.id, ratio: 1, active: true, note: null });
                      await refresh();
                    } catch (e) { notify('Erreur', (e as Error).message); }
                  }} />
                ))}
              </Row>
              <Muted style={{ fontSize: 12 }}>Soja : le plus proche du lait en protéines · Avoine : plus doux, idéal en porridge et pâtisserie · Amande : plus léger.</Muted>
            </>
          ) : <Muted>Ajoute une boisson végétale à tes ingrédients pour pouvoir la proposer ici.</Muted>}
        </Card>
      ))}
      {recipe.ingredients.some((l) => l.substituted_from) ? (
        <Row wrap>
          <Muted>
            🌱 {recipe.ingredients.filter((l) => l.substituted_from).map((l) =>
              `${catalog.get(l.substituted_from!.ingredient_id)?.name ?? '?'} → ${catalog.get(l.ingredient_id ?? '')?.name ?? '?'}`).join(', ')}
            {' '}· les étapes peuvent encore citer l’ingrédient d’origine.
          </Muted>
          <Chip label="Gérer mes remplacements" onPress={() => router.push('/substitutions')} />
        </Row>
      ) : null}

      <Row wrap>
        <Button label="▶  Cuisiner" onPress={() => router.push(`/recipe/${recipe.id}/cook`)} />
        <Button label="J’ai cuisiné ça" variant="secondary" onPress={cooked} />
        <Row gap={2}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={async () => { await setRating(recipe.id, n); refresh(); }} hitSlop={6}>
              <Text style={{ fontSize: 26, color: (recipe.rating ?? 0) >= n ? t.amber : t.border }}>★</Text>
            </Pressable>
          ))}
        </Row>
        <Chip tone="amber" label="Plat plaisir" active={recipe.tags.includes('plaisir')} onPress={async () => {
          await setTags(recipe.id, recipe.tags.includes('plaisir') ? recipe.tags.filter((x) => x !== 'plaisir') : [...recipe.tags, 'plaisir']);
          refresh();
        }} />
      </Row>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        {/* Ingrédients */}
        <Card style={{ flexBasis: 340, flexGrow: 1 }}>
          <H2 right={
            <Row>
              <Chip label="−" onPress={() => setServings(Math.max(1, (servings ?? recipe.servings) - 1))} />
              <Muted>{servings ?? recipe.servings} pers.</Muted>
              <Chip label="+" onPress={() => setServings((servings ?? recipe.servings) + 1)} />
            </Row>
          }>Ingrédients</H2>
          {recipe.ingredients.map((l, i) => {
            const ing = l.ingredient_id ? catalog.get(l.ingredient_id) : undefined;
            const header = l.group_label !== currentGroup && l.group_label ? l.group_label : null;
            currentGroup = l.group_label;
            return (
              <View key={l.id ?? i}>
                {header ? <Muted style={{ fontWeight: '700', marginTop: 8 }}>{header}</Muted> : null}
                <Row wrap style={{ paddingVertical: 3 }}>
                  <Text style={{ color: have.has(l.ingredient_id ?? '') ? t.green : t.border, fontSize: 16 }}>●</Text>
                  <Body>
                    {l.quantity != null ? `${formatQuantity(l.quantity * factor, l.unit)} ` : ''}
                    {ing?.name ?? l.raw_text}
                    {l.substituted_from ? (
                      <Text style={{ color: t.green }}> (au lieu de {catalog.get(l.substituted_from.ingredient_id)?.name.toLowerCase() ?? '?'})</Text>
                    ) : null}
                    {l.note ? <Text style={{ color: t.muted }}> ({l.note})</Text> : null}
                  </Body>
                  {l.optional ? <Tag label="optionnel" /> : null}
                  {ing?.season_months.length ? (
                    <Tag label={isInSeason(ing, month) ? 'de saison' : 'hors saison'} tone={isInSeason(ing, month) ? 'green' : 'amber'} />
                  ) : null}
                </Row>
              </View>
            );
          })}
          <Muted>● vert = déjà au frigo</Muted>
        </Card>

        {/* Nutrition */}
        <Card style={{ flexBasis: 300, flexGrow: 1 }}>
          <H2>Nutrition <Muted>par portion</Muted></H2>
          <Row wrap gap={14}>
            {[
              ['Calories', `${Math.round(ps.kcal)} kcal`], ['Protéines', `${ps.protein_g.toFixed(1)} g`],
              ['Glucides', `${ps.carbs_g.toFixed(1)} g`], ['Lipides', `${ps.fat_g.toFixed(1)} g`],
              ['Fibres', `${ps.fiber_g.toFixed(1)} g`], ['Sel', `${ps.salt_g.toFixed(1)} g`],
            ].map(([k, v]) => (
              <View key={k} style={{ minWidth: 90 }}>
                <Muted>{k}</Muted>
                <Body style={{ fontWeight: '700' }}>{v}</Body>
              </View>
            ))}
          </Row>
          <Row>
            <Muted>Complétude</Muted>
            <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: t.border, overflow: 'hidden' }}>
              <View style={{ width: `${score}%`, height: 8, backgroundColor: t.green }} />
            </View>
            <Body style={{ fontWeight: '700' }}>{score}</Body>
          </Row>
          <NutritionMessageList messages={messages} />
          {nutrition.coverage < 1 ? (
            <Muted style={{ fontSize: 12 }}>
              Calcul partiel ({Math.round(nutrition.coverage * 100)} % des ingrédients). Manquent : {nutrition.missing.join(', ')}.
            </Muted>
          ) : null}
          {cost.coverage >= 0.7 ? <Muted>Coût estimé : {cost.perServing.toFixed(2)} € / portion</Muted> : null}
        </Card>
      </View>

      {/* Étapes */}
      <Card>
        <H2>Étapes</H2>
        {recipe.steps.map((s, i) => (
          <Row key={s.id ?? i} style={{ alignItems: 'flex-start', paddingVertical: 4 }}>
            <Text style={{ color: t.accent, fontWeight: '700', fontSize: 16, width: 24 }}>{i + 1}</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Body>{s.text}</Body>
              <Row wrap>
                {s.timer_seconds ? <Tag label={`⏱ ${Math.round(s.timer_seconds / 60)} min`} tone="amber" /> : null}
                {s.technique_id ? <Chip label="Voir la technique" onPress={() => router.push(`/techniques?id=${s.technique_id}`)} /> : null}
              </Row>
            </View>
          </Row>
        ))}
      </Card>

      {sides.length || pairingIngredients.length ? (
        <>
          <H2>Pour accompagner</H2>
          {pairingIngredients.length ? <Muted>Va bien avec : {pairingIngredients.join(', ')}</Muted> : null}
          <Row wrap gap={14}>{sides.map((s) => <RecipeCard key={s.recipe.id} recipe={s.recipe} reasons={s.reasons} />)}</Row>
        </>
      ) : null}

      {/* Notes & variantes */}
      <Card>
        <H2>Notes & variantes</H2>
        <Row wrap>
          {(Object.keys(NOTE_KINDS) as NoteKind[]).map((k) => (
            <Chip key={k} label={NOTE_KINDS[k]} active={noteKind === k} onPress={() => setNoteKind(k)} />
          ))}
        </Row>
        <Field placeholder="Moins de sel, ajouter du citron, version végé avec tofu…" value={noteText} onChangeText={setNoteText} multiline />
        <Button label="Ajouter" variant="secondary" onPress={submitNote} disabled={!noteText.trim()} />
        {notes.map((n) => (
          <View key={n.id} style={{ paddingVertical: 6, gap: 2 }}>
            <Row><Tag label={NOTE_KINDS[n.kind as NoteKind] ?? n.kind} tone="amber" /><Muted>{new Date(n.created_at).toLocaleDateString('fr-FR')}</Muted></Row>
            <Body>{n.body}</Body>
          </View>
        ))}
      </Card>

      <Row wrap>
        {recipe.source_url ? <Button label="Source" variant="secondary" onPress={() => Linking.openURL(recipe.source_url!)} /> : null}
        <Button label="Supprimer" variant="danger" onPress={async () => {
          if (!(await confirm('Supprimer la recette ?', recipe.title, 'Supprimer'))) return;
          await deleteRecipe(recipe.id); await refresh(); router.back();
        }} />
      </Row>
    </Screen>
  );
}
