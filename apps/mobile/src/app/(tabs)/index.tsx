import { suggestRecipes, totalMinutes, type MealType, type Suggestion } from '@recette/core';
import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DoodleName } from '@/assets/doodles';
import { Doodle } from '@/components/Doodle';
import { Eyebrow, Loading, Muted, Pill } from '@/components/ui';
import { useData } from '@/lib/data';
import { interactive, lifted, useHover } from '@/lib/hover';
import { supabase } from '@/lib/supabase';
import { FONTS, MEAL_TYPE_LABELS, useTheme } from '@/lib/theme';

const MEAL_DOODLES: Record<MealType, DoodleName> = { petit_dejeuner: 'coffee', dejeuner: 'sitting', diner: 'chilling', gouter: 'iceCream', snack: 'iceCream' };
const MEAL_FOR: Record<MealType, string> = {
  petit_dejeuner: 'Pour le petit-déjeuner', dejeuner: 'Pour le déjeuner', diner: 'Pour le dîner', gouter: 'Pour le goûter', snack: 'Pour une petite faim',
};
const DAY_LETTERS = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];

/** Date locale au format AAAA-MM-JJ (et non UTC : 0 h 30 à Paris reste le bon jour). */
const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function mealTypeAt(h: number): MealType {
  if (h < 10) return 'petit_dejeuner';
  if (h < 14) return 'dejeuner';
  if (h < 18) return 'gouter';
  return 'diner';
}

/** Prénom : métadonnées du compte, sinon début de l'e-mail (tom.ricouard@… → Tom). */
function useFirstName() {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      const meta = (u?.user_metadata?.first_name ?? u?.user_metadata?.name) as string | undefined;
      const raw = meta ?? u?.email?.split('@')[0]?.split(/[._-]/)[0] ?? '';
      setName(raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : null);
    });
  }, []);
  return name;
}

/** L'heure, rafraîchie toutes les 30 s. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const firstName = useFirstName();
  const { loading, error, recipes, ingredients, catalog, pantry, history } = useData();
  const { width } = useWindowDimensions();
  const columns = width >= 1100 ? 4 : width >= 600 ? 2 : 1;
  // Largeur d'une colonne : contenu (max 1100, marges 24) moins les espacements de 14 px
  const colWidth = Math.floor((Math.min(width, 1100) - 48 - 14 * (columns - 1)) / columns);

  const today = localISO(now);
  const mealType = mealTypeAt(now.getHours());

  const top: Suggestion | undefined = useMemo(
    () => suggestRecipes(recipes, { catalog, pantry, history, today }, { mealTypes: [mealType] })[0],
    [recipes, catalog, pantry, history, today, mealType],
  );

  if (loading) return <Loading />;

  // Semaine en cours (lundi → dimanche), avec les jours où l'on a cuisiné
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = localISO(d);
    return { iso, letter: DAY_LETTERS[d.getDay()]!, day: d.getDate(), cooked: history.filter((h) => h.eaten_on === iso).length };
  });
  const cookedThisWeek = week.reduce((n, d) => n + d.cooked, 0);

  // Petit message perso, du plus utile au plus général
  const soon = new Date(now);
  soon.setDate(now.getDate() + 3);
  const expiring = pantry
    .filter((p) => p.expires_on && p.expires_on <= localISO(soon))
    .map((p) => catalog.get(p.ingredient_id)?.name)
    .filter((n): n is string => !!n);
  const cookedToday = week.find((d) => d.iso === today)?.cooked ?? 0;
  const message = expiring.length
    ? `${expiring.slice(0, 2).join(' et ')}${expiring.length > 2 ? ` (+${expiring.length - 2})` : ''} à finir dans les prochains jours.`
    : cookedToday
      ? `Déjà ${cookedToday} repas cuisiné${cookedToday > 1 ? 's' : ''} aujourd’hui. Bien joué.`
      : cookedThisWeek
        ? `${cookedThisWeek} repas maison cette semaine. On continue ?`
        : ({ petit_dejeuner: 'Un bon petit-déjeuner pour bien démarrer ?', dejeuner: 'C’est bientôt l’heure du déjeuner.', gouter: 'Petite faim ? Un goûter maison ?', diner: 'Le dîner approche.', snack: '' } as const)[mealType];

  const dateLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeLabel = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: 64 }}>
      <View style={{ width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: 24, gap: 28 }}>

        {/* Date, heure, accès au menu Plus */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: FONTS.medium, fontSize: 15, color: t.muted }}>
            {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} · {timeLabel}
          </Text>
          <RoundButton label={firstName?.charAt(0) ?? '⋯'} onPress={() => router.push('/more')} />
        </View>

        {/* Accueil */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: FONTS.medium, fontSize: 18, color: t.muted }}>Hey {firstName ?? 'toi'} 👋</Text>
          <Text style={{ fontFamily: FONTS.serif, fontSize: width < 600 ? 38 : 46, lineHeight: width < 600 ? 44 : 54, color: t.text }}>Qu’est-ce qu’on mange ?</Text>
          {message ? <Text style={{ fontFamily: FONTS.regular, fontSize: 17, color: t.muted }}>{message}</Text> : null}
        </View>
        {error ? <Muted style={{ color: t.danger }}>{error}</Muted> : null}

        {/* Suggestion du moment (façon « Today's mission ») */}
        <HeroCard top={top} mealType={mealType} hasRecipes={recipes.length > 0} />

        {/* Raccourcis (façon « Daily habits ») */}
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Text style={{ fontFamily: FONTS.serif, fontSize: 26, color: t.text }}>Raccourcis</Text>
            <View style={{ borderWidth: 1, borderColor: t.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
              <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: t.muted }}>{recipes.length} recettes · {ingredients.length} ingrédients</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            <Shortcut width={colWidth} title="Choisir un plat" doodle="sittingReading" subtitle="Repas, envies, suggestions" meta="Pas à pas" href="/choose" />
            <Shortcut width={colWidth} title="Nouvelle recette" doodle="reading" subtitle="Ingrédients, étapes, minuteries" meta="Saisie manuelle" href="/import" />
            <Shortcut width={colWidth} title="Ingrédient" doodle="plant" subtitle="Ajouter au catalogue" meta="Produit de base ou du commerce" href="/ingredients/new" />
            <Shortcut width={colWidth} title="Scanner" doodle="unboxing" subtitle="Un produit du commerce" meta="Fiche remplie par Open Food Facts" href="/ingredients/scan" />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function RoundButton({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  const { hovered, hoverProps } = useHover();
  return (
    <Pressable onPress={onPress} {...hoverProps} accessibilityLabel="Plus"
      style={[{ width: 48, height: 48, borderRadius: 24, backgroundColor: hovered ? t.surface : t.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.border }, interactive]}>
      <Text style={{ fontFamily: FONTS.serif, fontSize: 20, color: t.text }}>{label}</Text>
    </Pressable>
  );
}

function HeroCard({ top, mealType, hasRecipes }: { top?: Suggestion; mealType: MealType; hasRecipes: boolean }) {
  const t = useTheme();
  const narrow = useWindowDimensions().width < 600;
  const { hovered, hoverProps } = useHover();
  const r = top?.recipe;
  return (
    <Pressable
      onPress={() => router.push(r ? `/recipe/${r.id}` : hasRecipes ? '/choose' : '/import')}
      {...hoverProps}
      style={[{
        backgroundColor: t.surface, borderRadius: 32, padding: narrow ? 22 : 28, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20, minHeight: 190,
      }, interactive, hovered && lifted]}
    >
      <View style={{ flexBasis: 260, flexGrow: 1, flexShrink: 1, gap: 12 }}>
        <Eyebrow>{r ? MEAL_FOR[mealType] : hasRecipes ? MEAL_TYPE_LABELS[mealType] : 'Pour commencer'}</Eyebrow>
        <Text style={{ fontFamily: FONTS.serif, fontSize: narrow ? 28 : 34, lineHeight: narrow ? 34 : 40, color: t.text }}>
          {r ? r.title : hasRecipes ? 'Aucune idée pour ce repas' : 'Ajoute ta première recette'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {r ? <Pill label={`⏱  ${totalMinutes(r)} min`} /> : <Pill label={hasRecipes ? 'Choisir un plat →' : 'Nouvelle recette →'} />}
          {top?.reasons[0] ? (
            <View style={{ borderRadius: 999, borderWidth: 1, borderColor: t.border, paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: t.muted }}>{top.reasons[0]}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={{ alignSelf: 'center', marginHorizontal: 'auto' }}>
        <Doodle name={MEAL_DOODLES[mealType]} width={narrow ? 180 : 220} accent={t.card} />
      </View>
    </Pressable>
  );
}

/** Carte de raccourci : titre serif + illustration, trait, sous-titre et méta. */
function Shortcut({ width, title, doodle, subtitle, meta, href }: { width: number; title: string; doodle: DoodleName; subtitle: string; meta: string; href: Href }) {
  const t = useTheme();
  const { hovered, hoverProps } = useHover();
  return (
    <Pressable onPress={() => router.push(href)} {...hoverProps}
      style={({ pressed }) => [{
        // Largeur calculée dans Home (4 / 2 / 1 colonnes)
        width, backgroundColor: t.card, borderRadius: 28, padding: 22, gap: 14,
        borderWidth: 1, borderColor: hovered ? t.border : t.card, opacity: pressed ? 0.85 : 1,
      }, interactive, hovered && lifted]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <Text style={{ fontFamily: FONTS.serif, fontSize: 26, lineHeight: 32, color: t.text, flexShrink: 1 }}>{title}</Text>
        <Doodle name={doodle} width={104} />
      </View>
      <View style={{ height: 1, backgroundColor: t.border }} />
      <View style={{ gap: 4 }}>
        <Text style={{ fontFamily: FONTS.medium, fontSize: 16, color: t.text }}>{subtitle}</Text>
        <Text style={{ fontFamily: FONTS.regular, fontSize: 13, color: t.muted }}>{meta}</Text>
      </View>
    </Pressable>
  );
}
