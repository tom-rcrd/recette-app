import { DEFAULT_CRITERIA, formatAdditive, scoreProduct, type ScoreCriteria } from '@recette/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScoreBadge } from '@/components/ProductScore';
import { Body, Button, Card, Chip, Field, H2, Loading, Muted, Row, Screen } from '@/components/ui';
import { notify } from '@/lib/alert';
import { saveCriteria, useData } from '@/lib/data';

const WEIGHT_STEPS: [string, number][] = [['Ignoré', 0], ['Un peu', 10], ['Moyen', 25], ['Beaucoup', 50]];
const PARTS: { key: keyof ScoreCriteria['weights']; label: string; hint: string }[] = [
  { key: 'nutrition', label: 'Qualité nutritionnelle', hint: 'Nutri-Score (sucre, sel, gras saturés, fibres, protéines…)' },
  { key: 'processing', label: 'Transformation', hint: 'Groupe NOVA : du brut (1) à l’ultra-transformé (4)' },
  { key: 'additives', label: 'Additifs', hint: 'Moins il y en a, mieux c’est' },
  { key: 'organic', label: 'Bio', hint: 'Label bio officiel' },
];
const ALLERGENS = ['gluten', 'lait', 'oeuf', 'arachide', 'fruits_a_coque', 'soja', 'poisson', 'crustaces', 'celeri', 'moutarde', 'sesame', 'sulfites', 'lupin', 'mollusques'];

// La valeur la plus proche parmi les crans proposés
const nearestStep = (w: number) => WEIGHT_STEPS.reduce((best, s) => (Math.abs(s[1] - w) < Math.abs(best[1] - w) ? s : best))[1];
const parseAdditives = (s: string) =>
  [...new Set(s.split(/[\s,;]+/).map((x) => x.trim().toLowerCase().replace(/^e/, '')).filter((x) => /^\d{3,4}[a-z]?$/.test(x)).map((x) => `en:e${x}`))];
const toNum = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));

export default function Criteria() {
  const { loading, household, ingredients, refresh } = useData();
  const [c, setC] = useState<ScoreCriteria | null>(household?.score_criteria ?? null);
  const [additivesText, setAdditivesText] = useState((household?.score_criteria.avoidAdditives ?? []).map(formatAdditive).join(', '));
  const [sugar, setSugar] = useState(household?.score_criteria.maxSugars100g?.toString() ?? '');
  const [salt, setSalt] = useState(household?.score_criteria.maxSalt100g?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  const current: ScoreCriteria | null = c && {
    ...c, avoidAdditives: parseAdditives(additivesText), maxSugars100g: toNum(sugar), maxSalt100g: toNum(salt),
  };

  // Aperçu en direct sur les produits du catalogue
  const preview = useMemo(() => !current ? [] : ingredients
    .map((i) => ({ i, s: scoreProduct(i, current) }))
    .filter((x) => x.s)
    .sort((a, b) => b.s!.score - a.s!.score), [ingredients, current]);

  if (loading || !household || !c || !current) return <Loading />;

  async function save() {
    if (!household || !current) return;
    setSaving(true);
    try {
      await saveCriteria(household.id, current);
      await refresh();
      router.back();
    } catch (e) { notify('Erreur', (e as Error).message); setSaving(false); }
  }

  return (
    <Screen>
      <Muted>Ta note perso des produits du commerce, calculée à partir des données Open Food Facts selon ce qui compte pour toi.</Muted>

      <Card>
        <H2>Ce qui compte</H2>
        {PARTS.map((p) => (
          <Row key={p.key} wrap style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
            <Body style={{ minWidth: 220 }}>{p.label}{'\n'}<Muted>{p.hint}</Muted></Body>
            <Row wrap gap={6}>
              {WEIGHT_STEPS.map(([label, w]) => (
                <Chip key={label} label={label} active={nearestStep(c.weights[p.key]) === w}
                  onPress={() => setC({ ...c, weights: { ...c.weights, [p.key]: w } })} />
              ))}
            </Row>
          </Row>
        ))}
      </Card>

      <Card>
        <H2>Mes interdits</H2>
        <Row wrap>
          <Chip tone="amber" label="Pas d’huile de palme" active={c.avoidPalmOil} onPress={() => setC({ ...c, avoidPalmOil: !c.avoidPalmOil })} />
          <Chip tone="green" label="Végétarien uniquement" active={c.vegetarianOnly} onPress={() => setC({ ...c, vegetarianOnly: !c.vegetarianOnly })} />
        </Row>
        <Muted>Allergènes à exclure (note à 0) :</Muted>
        <Row wrap>
          {ALLERGENS.map((a) => (
            <Chip key={a} tone="neutral" label={a.replace(/_/g, ' ')} active={c.avoidAllergens.includes(a)}
              onPress={() => setC({ ...c, avoidAllergens: c.avoidAllergens.includes(a) ? c.avoidAllergens.filter((x) => x !== a) : [...c.avoidAllergens, a] })} />
          ))}
        </Row>
        <Field label="Additifs à éviter (forte pénalité)" placeholder="E250, E621, E171…" value={additivesText} onChangeText={setAdditivesText} autoCapitalize="characters" />
        <Row wrap>
          <Field label="Sucres max (g/100 g)" value={sugar} onChangeText={setSugar} keyboardType="decimal-pad" placeholder="aucun" style={{ width: 160 }} />
          <Field label="Sel max (g/100 g)" value={salt} onChangeText={setSalt} keyboardType="decimal-pad" placeholder="aucun" style={{ width: 160 }} />
        </Row>
      </Card>

      <Row wrap>
        <Button label="Enregistrer" onPress={save} loading={saving} />
        <Button label="Valeurs par défaut" variant="secondary" onPress={() => {
          setC(DEFAULT_CRITERIA); setAdditivesText(''); setSugar(''); setSalt('');
        }} />
      </Row>

      <H2>Aperçu sur tes produits</H2>
      {preview.length ? preview.map(({ i, s }) => (
        <Card key={i.id} onPress={() => router.push(`/ingredients/${i.id}`)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Body style={{ fontWeight: '700' }}>{i.name}{i.brand ? ` · ${i.brand}` : ''}</Body>
            <ScoreBadge ingredient={i} criteria={current} />
          </Row>
          <Muted>{s!.reasons.slice(0, 3).join(' · ')}</Muted>
        </Card>
      )) : <Muted>Scanne des produits dans l’onglet Ingrédients pour les voir notés ici.</Muted>}
    </Screen>
  );
}
