import { formatQuantity } from '@recette/core';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Chip, Field, Loading, Muted, Row } from '@/components/ui';
import { notify } from '@/lib/alert';
import { addNote, logMeal, setRating, useData } from '@/lib/data';
import { useTheme } from '@/lib/theme';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Minuterie d'une étape ; continue de tourner si on change d'étape. */
function useTimer() {
  const [timers, setTimers] = useState<Record<number, { remaining: number; running: boolean }>>({});
  const ref = useRef(timers);
  ref.current = timers;

  useEffect(() => {
    const iv = setInterval(() => {
      const cur = ref.current;
      if (!Object.values(cur).some((x) => x.running)) return;
      const next = { ...cur };
      for (const [k, v] of Object.entries(cur)) {
        if (!v.running) continue;
        const remaining = v.remaining - 1;
        next[Number(k)] = { remaining: Math.max(0, remaining), running: remaining > 0 };
        if (remaining === 0) {
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          notify('⏱ Minuterie terminée', `Étape ${Number(k) + 1}`);
        }
      }
      setTimers(next);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  return {
    timers,
    start: (step: number, seconds: number) =>
      setTimers((t) => ({ ...t, [step]: { remaining: t[step]?.remaining || seconds, running: true } })),
    pause: (step: number) => setTimers((t) => ({ ...t, [step]: { ...t[step]!, running: false } })),
    reset: (step: number) => setTimers((t) => { const { [step]: _, ...rest } = t; return rest; }),
  };
}

export default function CookMode() {
  useKeepAwake(); // l'écran reste allumé pendant la cuisine
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household, recipes, catalog, pantry, refresh } = useData();
  const recipe = recipes.find((r) => r.id === id);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [showIngredients, setShowIngredients] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [stars, setStars] = useState(0);
  const { timers, start, pause, reset } = useTimer();

  if (!recipe || !household) return <Loading />;
  const steps = recipe.steps;
  const finished = index >= steps.length;
  const step = steps[index];
  const timer = timers[index];

  async function finish() {
    if (!recipe || !household) return;
    try {
      await logMeal(household.id, recipe, catalog, pantry);
      if (feedback.trim()) await addNote(recipe.id, 'cook_feedback', feedback.trim());
      if (stars) await setRating(recipe.id, stars);
      await refresh();
      router.back();
    } catch (e) { notify('Erreur', (e as Error).message); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* Progression */}
      <View style={{ flexDirection: 'row', gap: 4, padding: 16 }}>
        {steps.map((_, i) => (
          <Pressable key={i} onPress={() => setIndex(i)} style={{ flex: 1, height: 6, borderRadius: 3,
            backgroundColor: done.has(i) ? t.green : i === index ? t.accent : t.border }} />
        ))}
      </View>

      <Row style={{ paddingHorizontal: 20, justifyContent: 'space-between' }}>
        <Muted>{finished ? 'Terminé' : `Étape ${index + 1} / ${steps.length}`}</Muted>
        <Row>
          <Chip label={showIngredients ? 'Masquer les ingrédients' : 'Ingrédients'} onPress={() => setShowIngredients(!showIngredients)} />
          {/* Plein écran sans barre de navigation : seule sortie possible */}
          <Chip tone="neutral" label="✕ Quitter" onPress={() => (router.canGoBack() ? router.back() : router.replace(`/recipe/${recipe.id}`))} />
        </Row>
      </Row>

      <View style={{ flex: 1, flexDirection: 'row' }}>
        <ScrollView contentContainerStyle={{ padding: 28, gap: 24, maxWidth: 900, alignSelf: 'center', width: '100%' }} style={{ flex: 1 }}>
          {!finished && step ? (
            <>
              <Text style={{ color: t.text, fontSize: 30, lineHeight: 42, fontWeight: '500' }}>{step.text}</Text>
              {step.timer_seconds ? (
                <View style={{ alignItems: 'center', gap: 12, padding: 20, borderRadius: 16, backgroundColor: t.amberSoft }}>
                  <Text style={{ fontSize: 56, fontWeight: '700', color: t.amber, fontVariant: ['tabular-nums'] }}>
                    {fmt(timer?.remaining ?? step.timer_seconds)}
                  </Text>
                  <Row>
                    {timer?.running
                      ? <Button label="Pause" variant="secondary" onPress={() => pause(index)} />
                      : <Button label={timer ? 'Reprendre' : 'Lancer la minuterie'} onPress={() => start(index, step.timer_seconds!)} />}
                    {timer ? <Button label="Réinitialiser" variant="secondary" onPress={() => reset(index)} /> : null}
                  </Row>
                </View>
              ) : null}
              {step.technique_id ? <Chip label="Voir la technique" onPress={() => router.push(`/techniques?id=${step.technique_id}`)} /> : null}
            </>
          ) : (
            <View style={{ gap: 16 }}>
              <Text style={{ color: t.text, fontSize: 30, fontWeight: '700' }}>Bon appétit !</Text>
              <Muted>Comment c’était ?</Muted>
              <Row gap={4}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setStars(n)}>
                    <Text style={{ fontSize: 40, color: stars >= n ? t.amber : t.border }}>★</Text>
                  </Pressable>
                ))}
              </Row>
              <Field label="Notes pour la prochaine fois" value={feedback} onChangeText={setFeedback} multiline
                placeholder="Un peu trop salé, doubler l’ail, cuisson 5 min de moins…" style={{ minHeight: 100 }} />
              <Button label="Terminer et enregistrer" onPress={finish} />
            </View>
          )}
        </ScrollView>

        {showIngredients ? (
          <ScrollView style={{ width: 300, flexGrow: 0, borderLeftWidth: 1, borderColor: t.border }} contentContainerStyle={{ padding: 16, gap: 6 }}>
            {recipe.ingredients.map((l, i) => (
              <Body key={i}>
                {l.quantity != null ? `${formatQuantity(l.quantity, l.unit)} ` : ''}
                {(l.ingredient_id && catalog.get(l.ingredient_id)?.name) || l.raw_text}
              </Body>
            ))}
          </ScrollView>
        ) : null}
      </View>

      {!finished ? (
        <Row style={{ padding: 20, justifyContent: 'space-between' }}>
          <Button label="← Précédente" variant="secondary" onPress={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} />
          <Button
            label={index === steps.length - 1 ? 'Valider et terminer ✓' : 'Valider l’étape ✓'}
            onPress={() => { setDone(new Set(done).add(index)); setIndex(index + 1); }}
          />
        </Row>
      ) : null}
    </View>
  );
}
