import { draftIngredientsFromLines, resolveDraftIngredients, type DraftIngredient, type MealType, type RecipeDraft } from '@recette/core';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { IngredientPicker } from '@/components/IngredientPicker';
import { Body, Button, Card, Chip, Field, H1, H2, Muted, Row, Screen, Tag } from '@/components/ui';
import { notify } from '@/lib/alert';
import { importFromImage, importFromText, importFromUrl, type ImportResult } from '@/lib/api';
import { saveDraft, useData, type IngredientDecision } from '@/lib/data';
import { EQUIPMENT_LABELS, INGREDIENT_CATEGORIES, MEAL_TYPE_LABELS, useTheme } from '@/lib/theme';

type Mode = 'url' | 'text' | 'photo';
const DISH_TYPES = ['entree', 'plat', 'accompagnement', 'dessert', 'sauce', 'boisson', 'pain'];
const TAGS = ['batch_cooking', 'une_seule_poele', 'sans_cuisson', 'plaisir'];
const toggle = <T,>(l: T[], v: T) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);

const emptyDraft = (): RecipeDraft => ({ title: '', ingredients: [], steps: [], source_type: 'manual', servings: 2, prep_min: 10, cook_min: 0 });

// Import automatique (lien, texte, photo) mis de côté pour l'instant : passer à true pour le réactiver.
// Le code (ImportPanel ci-dessous, apps/server) reste en place.
const IMPORT_ENABLED = false;

export default function NewRecipe() {
  const [draft, setDraft] = useState<RecipeDraft>(emptyDraft);
  // Change à chaque nouveau brouillon pour réinitialiser le formulaire
  const [draftKey, setDraftKey] = useState(0);
  const [imported, setImported] = useState(false);

  function load(next: RecipeDraft, fromImport: boolean) {
    setDraft(next);
    setImported(fromImport);
    setDraftKey((k) => k + 1);
  }
  const reset = () => load(emptyDraft(), false);

  return (
    <DraftEditor
      key={draftKey}
      draft={draft}
      header={(
        <>
          <H1>Nouvelle recette</H1>
          {imported
            ? <Muted>Recette importée : vérifie les ingrédients et les étapes avant d’enregistrer.</Muted>
            : IMPORT_ENABLED ? <ImportPanel onDraft={(d) => load(d, true)} /> : null}
        </>
      )}
      onSaved={reset}
      onCancel={() => { reset(); router.back(); }}
    />
  );
}

/** Encart « Remplir automatiquement » : lien, texte collé ou photo. */
function ImportPanel({ onDraft }: { onDraft: (d: RecipeDraft) => void }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(fn: () => Promise<ImportResult>) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fn();
      if (res.draft) onDraft(res.draft);
      else {
        setMessage(res.error ?? 'Rien trouvé.');
        if (res.needsText) setMode('text');
      }
    } catch (e) {
      setMessage(`Service d’import injoignable : ${(e as Error).message}`);
    }
    setBusy(false);
  }

  async function pickPhoto(camera: boolean) {
    if (camera && Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return notify('Accès à la caméra refusé');
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.6 };
    const res = camera && Platform.OS !== 'web' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]?.base64) return;
    const asset = res.assets[0];
    await run(() => importFromImage(asset.base64!, asset.mimeType ?? 'image/jpeg'));
  }

  return (
    <Card>
      <Body style={{ fontWeight: '700' }}>Remplir automatiquement depuis…</Body>
      <Row wrap>
        <Chip label="Un lien (site, YouTube, Insta, TikTok)" active={mode === 'url'} onPress={() => setMode(mode === 'url' ? null : 'url')} />
        <Chip label="Un texte collé" active={mode === 'text'} onPress={() => setMode(mode === 'text' ? null : 'text')} />
        <Chip label="Une photo (livre, fiche)" active={mode === 'photo'} onPress={() => setMode(mode === 'photo' ? null : 'photo')} />
      </Row>

      {mode === 'url' ? (
        <>
          <Field placeholder="https://…" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />
          <Muted>Les sites de recettes sont lus directement (rapide, gratuit). Pour les vidéos, la recette est extraite de la description.</Muted>
          <Button label="Importer" onPress={() => run(() => importFromUrl(url.trim()))} loading={busy} disabled={!/^https?:\/\//.test(url.trim())} />
        </>
      ) : null}

      {mode === 'text' ? (
        <>
          <Field placeholder="Colle ici la légende Instagram, un message, une recette tapée…" value={text} onChangeText={setText}
            multiline style={{ minHeight: 180, textAlignVertical: 'top' }} />
          <Button label="Extraire la recette" onPress={() => run(() => importFromText(text, url || undefined))} loading={busy} disabled={text.trim().length < 20} />
        </>
      ) : null}

      {mode === 'photo' ? (
        <>
          <Muted>Photographie une page de livre ou une fiche manuscrite, bien à plat et lumineuse.</Muted>
          <Row wrap>
            {Platform.OS !== 'web' ? <Button label="Prendre une photo" onPress={() => pickPhoto(true)} loading={busy} /> : null}
            <Button label="Choisir une image" variant="secondary" onPress={() => pickPhoto(false)} disabled={busy} />
          </Row>
        </>
      ) : null}

      {mode ? <Muted style={{ fontSize: 12 }}>L’import remplace ce qui est déjà saisi ci-dessous.</Muted> : null}
      {message ? <Body style={{ color: '#B3261E' }}>{message}</Body> : null}
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Relecture du brouillon : chaque ingrédient est relié au catalogue ou créé
// -----------------------------------------------------------------------------

function initialDecision(i: DraftIngredient): IngredientDecision {
  if (i.match?.ingredient_id) return { kind: 'existing', ingredient_id: i.match.ingredient_id };
  return { kind: 'new', name: i.name, category: 'autre', ingredientKind: 'base' };
}

function DraftEditor({ draft: initial, header, onSaved, onCancel }: {
  draft: RecipeDraft; header: ReactNode; onSaved: () => void; onCancel: () => void;
}) {
  const t = useTheme();
  const { household, ingredients, catalog, refresh } = useData();
  const [draft, setDraft] = useState(initial);
  const [decisions, setDecisions] = useState<IngredientDecision[]>(initial.ingredients.map(initialDecision));
  const [mealTypes, setMealTypes] = useState<MealType[]>(initial.meal_types?.length ? initial.meal_types : ['dejeuner', 'diner']);
  const [dishType, setDishType] = useState<string | null>(initial.dish_type ?? 'plat');
  const [equipment, setEquipment] = useState<string[]>(initial.equipment ?? []);
  const [tags, setTags] = useState<string[]>(initial.tags ?? []);
  const [saving, setSaving] = useState(false);
  const [newLine, setNewLine] = useState('');

  const set = <K extends keyof RecipeDraft>(k: K, v: RecipeDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setDecision = (i: number, d: IngredientDecision) => setDecisions((cur) => cur.map((x, j) => (j === i ? d : x)));
  const updateIng = (i: number, patch: Partial<DraftIngredient>) =>
    set('ingredients', draft.ingredients.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')) || 0);

  async function save() {
    if (!household || !draft.title.trim()) return;
    setSaving(true);
    try {
      const id = await saveDraft(household.id, draft, decisions, { meal_types: mealTypes, dish_type: dishType, equipment, tags });
      await refresh();
      onSaved(); // le formulaire repart vide la prochaine fois
      router.replace(`/recipe/${id}`);
    } catch (e) {
      notify('Erreur', (e as Error).message);
      setSaving(false);
    }
  }

  const toCreate = decisions.filter((d) => d.kind === 'new').length;

  return (
    <Screen>
      {header}
      {draft.source_url ? <Row wrap><Tag label={`Source : ${draft.source_type}`} tone="accent" /><Muted>{draft.source_url}</Muted></Row> : null}
      <Field label="Titre" value={draft.title} onChangeText={(v) => set('title', v)} />
      <Field label="Description" value={draft.description ?? ''} onChangeText={(v) => set('description', v)} multiline />
      <Row wrap>
        <Field label="Portions" value={String(draft.servings ?? '')} onChangeText={(v) => set('servings', num(v))} keyboardType="decimal-pad" />
        <Field label="Prépa (min)" value={String(draft.prep_min ?? '')} onChangeText={(v) => set('prep_min', num(v))} keyboardType="number-pad" />
        <Field label="Cuisson (min)" value={String(draft.cook_min ?? '')} onChangeText={(v) => set('cook_min', num(v))} keyboardType="number-pad" />
        <Field label="Repos (min)" value={String(draft.rest_min ?? '')} onChangeText={(v) => set('rest_min', num(v))} keyboardType="number-pad" />
      </Row>

      <Row wrap>
        {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((m) => (
          <Chip key={m} label={MEAL_TYPE_LABELS[m]!} active={mealTypes.includes(m)} onPress={() => setMealTypes(toggle(mealTypes, m))} />
        ))}
      </Row>
      <Row wrap>
        {DISH_TYPES.map((d) => <Chip key={d} tone="amber" label={d} active={dishType === d} onPress={() => setDishType(dishType === d ? null : d)} />)}
      </Row>
      <Row wrap>
        {Object.entries(EQUIPMENT_LABELS).map(([k, l]) => <Chip key={k} tone="neutral" label={l} active={equipment.includes(k)} onPress={() => setEquipment(toggle(equipment, k))} />)}
      </Row>
      <Row wrap>
        {TAGS.map((k) => <Chip key={k} tone="green" label={k.replace(/_/g, ' ')} active={tags.includes(k)} onPress={() => setTags(toggle(tags, k))} />)}
      </Row>

      <H2 right={toCreate ? <Muted>{toCreate} nouvel{toCreate > 1 ? 's' : ''} ingrédient{toCreate > 1 ? 's' : ''}</Muted> : null}>Ingrédients</H2>
      {draft.ingredients.map((ing, i) => {
        const d = decisions[i]!;
        return (
          <Card key={i}>
            <Muted>{ing.raw_text}</Muted>
            <Row wrap>
              <Field value={ing.quantity == null ? '' : String(ing.quantity)} onChangeText={(v) => updateIng(i, { quantity: num(v) })}
                placeholder="qté" keyboardType="decimal-pad" style={{ width: 80 }} />
              <Field value={ing.unit ?? ''} onChangeText={(v) => updateIng(i, { unit: v || null })} placeholder="unité" style={{ width: 90 }} />
              <Field value={ing.note ?? ''} onChangeText={(v) => updateIng(i, { note: v || null })} placeholder="note" style={{ minWidth: 140 }} />
              <Pressable onPress={() => {
                set('ingredients', draft.ingredients.filter((_, j) => j !== i));
                setDecisions(decisions.filter((_, j) => j !== i));
              }}><Text style={{ color: t.muted, fontSize: 18 }}>✕</Text></Pressable>
            </Row>

            {d.kind === 'existing' ? (
              <Row wrap>
                <Tag label={`✓ ${catalog.get(d.ingredient_id)?.name ?? '?'}`} tone="green" />
                <Pressable onPress={() => setDecision(i, { kind: 'new', name: ing.name, category: 'autre', ingredientKind: 'base' })}>
                  <Muted>changer</Muted>
                </Pressable>
              </Row>
            ) : d.kind === 'new' ? (
              <View style={{ gap: 6 }}>
                <Row wrap>
                  <Tag label="Nouvel ingrédient" tone="amber" />
                  <Field value={d.name} onChangeText={(v) => setDecision(i, { ...d, name: v })} style={{ minWidth: 180 }} />
                  <Chip label="Produit de base" active={d.ingredientKind === 'base'} onPress={() => setDecision(i, { ...d, ingredientKind: 'base' })} />
                  <Chip label="Produit du commerce" active={d.ingredientKind === 'product'} onPress={() => setDecision(i, { ...d, ingredientKind: 'product' })} />
                  <Chip label="Ignorer" tone="neutral" onPress={() => setDecision(i, { kind: 'skip' })} />
                </Row>
                <Row wrap>
                  {Object.entries(INGREDIENT_CATEGORIES).map(([k, l]) => (
                    <Chip key={k} tone="neutral" label={l} active={d.category === k} onPress={() => setDecision(i, { ...d, category: k })} />
                  ))}
                </Row>
                {ing.match?.alternatives.length ? (
                  <Row wrap>
                    <Muted>Ou bien :</Muted>
                    {ing.match.alternatives.map((a) => (
                      <Chip key={a.ingredient_id} label={a.name} onPress={() => setDecision(i, { kind: 'existing', ingredient_id: a.ingredient_id })} />
                    ))}
                  </Row>
                ) : null}
                <IngredientPicker catalog={ingredients} placeholder="Chercher dans mes ingrédients…"
                  onPick={(p) => setDecision(i, { kind: 'existing', ingredient_id: p.id })} />
              </View>
            ) : (
              <Row><Tag label="Non relié (texte seul)" /><Pressable onPress={() => setDecision(i, initialDecision(ing))}><Muted>annuler</Muted></Pressable></Row>
            )}
          </Card>
        );
      })}
      <Row>
        <View style={{ flex: 1 }}><Field placeholder="Ajouter une ligne : 200 g de farine" value={newLine} onChangeText={setNewLine} /></View>
        <Button label="Ajouter" variant="secondary" disabled={!newLine.trim()} onPress={() => {
          // Analyse locale de la ligne, puis rapprochement avec le catalogue
          const [line] = resolveDraftIngredients({ ...emptyDraft(), ingredients: draftIngredientsFromLines([newLine]) }, ingredients).ingredients;
          if (!line) return;
          set('ingredients', [...draft.ingredients, line]);
          setDecisions([...decisions, initialDecision(line)]);
          setNewLine('');
        }} />
      </Row>

      <H2>Étapes</H2>
      {draft.steps.map((s, i) => (
        <Row key={i} style={{ alignItems: 'flex-start' }}>
          <Text style={{ color: t.accent, fontWeight: '700', width: 22, paddingTop: 12 }}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Field value={s.text} multiline onChangeText={(v) => set('steps', draft.steps.map((x, j) => (j === i ? { ...x, text: v } : x)))} />
          </View>
          <Field value={s.timer_seconds ? String(Math.round(s.timer_seconds / 60)) : ''} placeholder="⏱ min" keyboardType="number-pad" style={{ width: 80 }}
            onChangeText={(v) => set('steps', draft.steps.map((x, j) => (j === i ? { ...x, timer_seconds: v ? Number(v) * 60 : null } : x)))} />
          <Pressable onPress={() => set('steps', draft.steps.filter((_, j) => j !== i))} style={{ paddingTop: 12 }}>
            <Text style={{ color: t.muted, fontSize: 18 }}>✕</Text>
          </Pressable>
        </Row>
      ))}
      <Button label="+ Étape" variant="secondary" onPress={() => set('steps', [...draft.steps, { text: '' }])} />

      <Row wrap>
        <Button label="Enregistrer la recette" onPress={save} loading={saving} disabled={!draft.title.trim()} />
        <Button label="Annuler" variant="secondary" onPress={onCancel} />
      </Row>
    </Screen>
  );
}
