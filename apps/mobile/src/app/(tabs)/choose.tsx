import {
  durationClass, matchesFilters, mergeFilters, QUICK_FILTERS, suggestRecipes, totalMinutes,
  type MealType, type RecipeFilters, type Suggestion,
} from '@recette/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { RecipeCard } from '@/components/RecipeCard';
import { BigButton, Stepper, Tile } from '@/components/Tile';
import { Empty, Loading, Muted, Row, Tag } from '@/components/ui';
import { today, useData } from '@/lib/data';
import { interactive, lifted, useHover } from '@/lib/hover';
import { DURATION_LABELS, FONTS, MEAL_TYPE_LABELS, useTheme } from '@/lib/theme';

const MEAL_ICONS: Record<MealType, string> = { petit_dejeuner: '☕', dejeuner: '🥗', diner: '🌙', gouter: '🍪', snack: '🍎' };
const FILTER_ICONS: Record<string, string> = {
  frigo: '🧊', presque: '🛒', moins30: '⏱️', sans_four: '🚫', une_poele: '🍳',
  vegetarien: '🥦', batch: '📦', plaisir: '🍕', quotidien: '🥘',
};
const STEPS = ['Repas', 'Envies', 'Suggestions'];

function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 10) return 'petit_dejeuner';
  if (h < 14) return 'dejeuner';
  if (h < 18) return 'gouter';
  return 'diner';
}

export default function ChoosePlate() {
  const t = useTheme();
  const { loading, error, recipes, catalog, pantry, history } = useData();
  const [step, setStep] = useState(0);
  const [mealType, setMealType] = useState<MealType>(defaultMealType());
  const [quick, setQuick] = useState<string[]>([]);

  const ctx = { catalog, pantry };
  const filtersFor = (meal: MealType, keys: string[]): RecipeFilters => mergeFilters(
    { mealTypes: [meal] },
    ...QUICK_FILTERS.filter((q) => keys.includes(q.key)).map((q) => q.filters),
  );
  const count = (f: RecipeFilters) => recipes.filter((r) => matchesFilters(r, f, ctx)).length;

  const suggestions = useMemo(
    () => suggestRecipes(recipes, { catalog, pantry, history, today: today() }, filtersFor(mealType, quick)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recipes, catalog, pantry, history, mealType, quick],
  );

  const soon = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const expiring = pantry
    .filter((p) => p.expires_on && p.expires_on <= soon)
    .map((p) => catalog.get(p.ingredient_id)?.name)
    .filter(Boolean);

  if (loading) return <Loading />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: 12, paddingBottom: 64 }}>
      <View style={{ width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: 24, gap: 28 }}>

        {error ? <Muted style={{ color: '#B3261E' }}>{error}</Muted> : null}

        {expiring.length ? (
          <View style={{ backgroundColor: t.amberSoft, borderRadius: 16, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 24 }}>⏳</Text>
            <Text style={{ color: t.amber, fontSize: 16, flexShrink: 1 }}>
              <Text style={{ fontWeight: '700' }}>À finir bientôt : </Text>{expiring.join(', ')}
            </Text>
          </View>
        ) : null}

        <Stepper steps={STEPS} current={step} onSelect={setStep} />

        {/* Étape 1 : le repas */}
        {step === 0 ? (
          <View style={{ gap: 20 }}>
            <StepTitle title="Pour quel repas ?" subtitle="On a pré-sélectionné celui de l’heure." />
            <Row wrap gap={14} style={{ alignItems: 'stretch' }}>
              {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((m) => {
                const n = count({ mealTypes: [m] });
                return (
                  <Tile key={m} icon={MEAL_ICONS[m]} label={MEAL_TYPE_LABELS[m]!} hint={`${n} recette${n > 1 ? 's' : ''}`}
                    active={mealType === m} onPress={() => { setMealType(m); setStep(1); }} />
                );
              })}
            </Row>
            <Row><BigButton label="Continuer →" onPress={() => setStep(1)} /></Row>
          </View>
        ) : null}

        {/* Étape 2 : envies et contraintes (facultatif) */}
        {step === 1 ? (
          <View style={{ gap: 20 }}>
            <StepTitle title="Des envies ou des contraintes ?" subtitle="Facultatif : choisis-en autant que tu veux, ou passe directement." />
            <Row wrap gap={14} style={{ alignItems: 'stretch' }}>
              {QUICK_FILTERS.map((q) => {
                const selected = quick.includes(q.key);
                const n = count(filtersFor(mealType, selected ? quick : [...quick, q.key]));
                return (
                  <Tile key={q.key} icon={FILTER_ICONS[q.key] ?? '✨'} label={q.label}
                    hint={`${n} recette${n > 1 ? 's' : ''}`} active={selected}
                    onPress={() => setQuick(selected ? quick.filter((k) => k !== q.key) : [...quick, q.key])} />
                );
              })}
            </Row>
            <Row wrap gap={12}>
              <BigButton label={`Voir ${suggestions.length} suggestion${suggestions.length > 1 ? 's' : ''} →`} onPress={() => setStep(2)} />
              {quick.length ? <BigButton label="Tout effacer" variant="ghost" onPress={() => setQuick([])} /> : null}
            </Row>
          </View>
        ) : null}

        {/* Étape 3 : suggestions */}
        {step === 2 ? (
          <View style={{ gap: 20 }}>
            <StepTitle
              title={`${MEAL_ICONS[mealType]} ${MEAL_TYPE_LABELS[mealType]}`}
              subtitle={quick.length ? QUICK_FILTERS.filter((q) => quick.includes(q.key)).map((q) => q.label).join(' · ') : 'Sans filtre'}
            />
            {suggestions.length === 0 ? (
              <View style={{ gap: 16 }}>
                <Empty
                  title={recipes.length ? 'Aucune recette ne correspond' : 'Ta bibliothèque est vide'}
                  hint={recipes.length ? 'Retire une envie ou ajoute des produits au frigo.' : 'Crée ta première recette avec le bouton « Nouvelle recette ».'}
                />
                <Row wrap gap={12} style={{ justifyContent: 'center' }}>
                  {recipes.length
                    ? <BigButton label="← Modifier mes envies" variant="ghost" onPress={() => setStep(1)} />
                    : <BigButton label="+ Nouvelle recette" onPress={() => router.push('/import')} />}
                </Row>
              </View>
            ) : (
              <>
                <HeroSuggestion s={suggestions[0]!} />
                {suggestions.length > 1 ? (
                  <>
                    <Text style={{ fontSize: 24, fontFamily: FONTS.serif, color: t.text }}>Autres idées</Text>
                    <Row wrap gap={14} style={{ alignItems: 'stretch' }}>
                      {suggestions.slice(1, 13).map((s) => (
                        <RecipeCard key={s.recipe.id} recipe={s.recipe} reasons={s.reasons} missing={s.missingIngredientIds.length} />
                      ))}
                    </Row>
                  </>
                ) : null}
                <Row wrap gap={12}>
                  <BigButton label="← Modifier mes envies" variant="ghost" onPress={() => setStep(1)} />
                  <BigButton label="Recommencer" variant="ghost" onPress={() => { setQuick([]); setStep(0); }} />
                </Row>
              </>
            )}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function StepTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 30, fontFamily: FONTS.serif, color: t.text }}>{title}</Text>
      {subtitle ? <Text style={{ fontSize: 16, color: t.muted }}>{subtitle}</Text> : null}
    </View>
  );
}

/** La meilleure suggestion, mise en avant. */
function HeroSuggestion({ s }: { s: Suggestion }) {
  const t = useTheme();
  const r = s.recipe;
  const dc = durationClass(r);
  const { hovered, hoverProps } = useHover();
  return (
    <Pressable onPress={() => router.push(`/recipe/${r.id}`)} {...hoverProps}
      style={({ pressed }) => [{
        borderRadius: 24, overflow: 'hidden', backgroundColor: t.surface, borderWidth: 1, borderColor: hovered ? t.muted : t.surface,
        flexDirection: 'row', flexWrap: 'wrap', opacity: pressed ? 0.9 : 1,
      }, interactive, hovered && lifted]}>
      {r.image_url ? (
        <Image source={{ uri: r.image_url }} style={{ flexBasis: 320, flexGrow: 1, minHeight: 240, backgroundColor: t.border }} />
      ) : (
        <View style={{ flexBasis: 320, flexGrow: 1, minHeight: 200, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 72 }}>🍽️</Text>
        </View>
      )}
      <View style={{ flexBasis: 320, flexGrow: 1, padding: 24, gap: 12, justifyContent: 'center' }}>
        <Text style={{ fontSize: 12, fontFamily: FONTS.medium, color: t.muted, letterSpacing: 1.4, textTransform: 'uppercase' }}>Notre suggestion</Text>
        <Text style={{ fontSize: 32, fontFamily: FONTS.serif, color: t.text }}>{r.title}</Text>
        <Row wrap gap={6}>
          <Tag label={`${DURATION_LABELS[dc]} · ${totalMinutes(r)} min`} tone={dc === 'rapide' ? 'green' : dc === 'moyen' ? 'amber' : 'accent'} />
          {r.rating ? <Tag label={'★'.repeat(r.rating)} tone="amber" /> : null}
          {s.missingIngredientIds.length === 0 ? <Tag label="Tout au frigo" tone="green" /> : null}
        </Row>
        {s.reasons.length ? <Text style={{ fontSize: 16, color: t.muted }}>{s.reasons.join(' · ')}</Text> : null}
        <Row wrap gap={12} style={{ marginTop: 8 }}>
          <BigButton label="▶  Cuisiner" onPress={() => router.push(`/recipe/${r.id}/cook`)} />
          <BigButton label="Voir la recette" variant="ghost" onPress={() => router.push(`/recipe/${r.id}`)} />
        </Row>
      </View>
    </Pressable>
  );
}
