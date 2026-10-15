import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EQUIVALENTS, IMPACT_SOURCE, REFERENCE_MEATS, impactSummary, recipeImpact, type ReferenceMeat,
} from '@recette/core';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { FlowerIcon, ImpactGarden, type FlowerKind } from '@/components/ImpactGarden';
import { Chip, Empty, Loading, Muted, Row, Screen } from '@/components/ui';
import { useData } from '@/lib/data';
import { FONTS, useTheme } from '@/lib/theme';

const PERIODS = [['week', 'Cette semaine'], ['month', 'Ce mois-ci'], ['all', 'Depuis le début']] as const;
type Period = (typeof PERIODS)[number][0];
const REF_KEY = 'impact.referenceMeat';

const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function periodStart(p: Period): string | undefined {
  const d = new Date();
  if (p === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  else if (p === 'month') d.setDate(1);
  else return undefined;
  return localISO(d);
}

const nf = (n: number, digits = 1) => n.toLocaleString('fr-FR', { maximumFractionDigits: n < 10 ? digits : 0 });

export default function ImpactScreen() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const { loading, history, recipes, catalog } = useData();
  const [period, setPeriod] = useState<Period>('month');
  const [ref, setRef] = useState<ReferenceMeat>('poultry');
  const [help, setHelp] = useState(false);

  // Viande de comparaison mémorisée sur l'appareil
  useEffect(() => {
    AsyncStorage.getItem(REF_KEY).then((v) => { if (v && REFERENCE_MEATS.some((m) => m.key === v)) setRef(v as ReferenceMeat); }).catch(() => {});
  }, []);
  const chooseRef = (r: ReferenceMeat) => { setRef(r); AsyncStorage.setItem(REF_KEY, r).catch(() => {}); };

  const sum = useMemo(
    () => impactSummary(history, recipes, catalog, { ref, since: periodStart(period) }),
    [history, recipes, catalog, ref, period],
  );

  if (loading) return <Loading />;

  const gardenWidth = Math.min(width, 1100) - 40 - 40;
  const maxSaved = Math.max(0.001, ...sum.perMeal.map((m) => m.saved.co2));
  const flowers = sum.perMeal
    .filter((m) => m.saved.co2 > 0.01)
    .map((m, i) => ({ key: `${m.recipe.id}-${m.eaten_on}-${i}`, size: Math.sqrt(m.saved.co2 / maxSaved) }));
  const pct = (saved: number, conv: number) => (conv > 0 ? saved / conv : 0);

  const rows: { kind: FlowerKind; label: string; value: string; hint: string; ratio: number }[] = [
    {
      kind: 'rosette', label: 'CO₂ évité', value: `${nf(sum.saved.co2)} kg`,
      hint: `≈ ${nf(sum.saved.co2 / EQUIVALENTS.carKgPerKm, 0)} km en voiture`,
      ratio: pct(sum.saved.co2, sum.conventional.co2),
    },
    {
      kind: 'loops', label: 'Surface agricole préservée', value: `${nf(sum.saved.land)} m²`,
      hint: `≈ ${nf((sum.saved.land / EQUIVALENTS.tennisCourtM2) * 100, 0)} % d’un terrain de tennis · moins de pression sur les forêts`,
      ratio: pct(sum.saved.land, sum.conventional.land),
    },
    {
      kind: 'daisy', label: 'Eau économisée', value: `${nf(sum.saved.water, 0)} L`,
      hint: `≈ ${nf(sum.saved.water / EQUIVALENTS.showerLiters, 0)} douche${sum.saved.water / EQUIVALENTS.showerLiters >= 2 ? 's' : ''} de 5 minutes`,
      ratio: pct(sum.saved.water, sum.conventional.water),
    },
    {
      kind: 'rosette', label: 'Repas végétaux', value: `${sum.plantMeals} / ${sum.meals}`,
      hint: 'sans viande ni poisson', ratio: sum.meals ? sum.plantMeals / sum.meals : 0,
    },
  ];

  return (
    <Screen>
      <Row wrap>
        {PERIODS.map(([k, label]) => <Chip key={k} label={label} active={period === k} onPress={() => setPeriod(k)} />)}
      </Row>

      {/* Le jardin */}
      <View style={{ borderWidth: 1.5, borderColor: t.text, borderRadius: 24, padding: 20, gap: 8, backgroundColor: t.card }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flexShrink: 1, gap: 4 }}>
            <Text style={{ fontFamily: FONTS.serif, fontSize: 28, color: t.text }}>Ton jardin</Text>
            <Muted>
              {flowers.length
                ? `${flowers.length} fleur${flowers.length > 1 ? 's' : ''} : une par repas qui a évité des émissions. Plus elle est grande, plus l’économie est importante.`
                : 'Chaque repas végétal cuisiné fera pousser une fleur.'}
            </Muted>
          </View>
          <Pressable onPress={() => setHelp(!help)} accessibilityLabel="Comment c’est calculé ?"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: FONTS.semibold, fontSize: 18, color: t.text }}>{help ? '✕' : '?'}</Text>
          </Pressable>
        </View>
        <ImpactGarden flowers={flowers} width={gardenWidth} height={Math.max(240, Math.min(380, gardenWidth * 0.55))} />
      </View>

      {help ? (
        <View style={{ backgroundColor: t.surface, borderRadius: 20, padding: 18, gap: 10 }}>
          <Text style={{ fontFamily: FONTS.serif, fontSize: 22, color: t.text }}>Comment c’est calculé</Text>
          <Muted>
            Pour chaque repas cuisiné (« J’ai cuisiné ça » ou mode cuisine), l’app compare ton plat à sa version « classique » :
            les ingrédients que tu remplaces (lait → boisson végétale) reprennent leur forme d’origine, et les protéines végétales
            (lentilles, pois chiches, tofu…) sont remplacées par de la viande apportant autant de protéines. La différence, c’est ce que tu as évité.
          </Muted>
          <Muted>
            Données : {IMPACT_SOURCE}. Moyennes mondiales, de la ferme au magasin. La surface agricole est utilisée ici comme
            indicateur de la pression sur les forêts : l’étude ne mesure pas la déforestation directement. Les huiles, épices et sauces ne sont pas comptées.
            Ce sont des ordres de grandeur, pas une mesure exacte.
          </Muted>
          <Text style={{ fontFamily: FONTS.medium, fontSize: 15, color: t.text }}>Comparer à :</Text>
          <Row wrap>
            {REFERENCE_MEATS.map((m) => <Chip key={m.key} label={m.label} active={ref === m.key} onPress={() => chooseRef(m.key)} />)}
          </Row>
          <Muted style={{ fontSize: 12 }}>Le poulet donne l’estimation la plus prudente ; le bœuf, la plus élevée.</Muted>
        </View>
      ) : null}

      {/* Indicateurs, façon maquette : icône, libellé, barre */}
      <View>
        {rows.map((r, i) => (
          <View key={r.label} style={{
            flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16,
            borderTopWidth: i ? 1 : 0, borderColor: t.border,
          }}>
            <FlowerIcon kind={r.kind} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: FONTS.semibold, fontSize: 17, color: t.text }}>{r.label}</Text>
              <Muted style={{ fontSize: 13 }}>{r.hint}</Muted>
            </View>
            <View style={{ width: 150, gap: 6, alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: FONTS.serif, fontSize: 22, color: t.text }}>{r.value}</Text>
              <View style={{ width: '100%', height: 10, borderRadius: 5, backgroundColor: t.surface, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(Math.min(1, r.ratio) * 100)}%`, height: 10, borderRadius: 5, backgroundColor: t.green }} />
              </View>
              {i < 3 ? <Muted style={{ fontSize: 12 }}>−{Math.round(r.ratio * 100)} % vs classique</Muted> : null}
            </View>
          </View>
        ))}
      </View>

      {/* Détail des repas */}
      <Text style={{ fontFamily: FONTS.serif, fontSize: 24, color: t.text, marginTop: 8 }}>Repas cuisinés</Text>
      {!sum.perMeal.length ? (
        <Empty title="Aucun repas sur la période" hint="Utilise « J’ai cuisiné ça » ou le mode cuisine pour faire pousser ton jardin." />
      ) : sum.perMeal.slice(0, 30).map((m, i) => {
        const swaps = recipeImpact(m.recipe, catalog, ref).swaps;
        return (
          <Pressable key={`${m.recipe.id}-${m.eaten_on}-${i}`} onPress={() => router.push(`/recipe/${m.recipe.id}`)}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: t.border }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: FONTS.medium, fontSize: 16, color: t.text }}>{m.recipe.title}</Text>
              <Muted style={{ fontSize: 13 }}>
                {new Date(m.eaten_on).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                {swaps.length ? ` · ${swaps.map((s) => `${s.to} au lieu de ${s.from}`).join(', ')}` : ''}
              </Muted>
            </View>
            <Text style={{ fontFamily: FONTS.semibold, fontSize: 15, color: m.saved.co2 > 0.01 ? t.green : t.muted }}>
              {m.saved.co2 > 0.01 ? `−${nf(m.saved.co2)} kg CO₂` : '—'}
            </Text>
          </Pressable>
        );
      })}
    </Screen>
  );
}
