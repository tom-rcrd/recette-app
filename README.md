# Recettes

Une app iPad pour ranger ses recettes (importées de partout) et se faire proposer **quoi cuisiner**
selon le frigo, la saison, l'historique et les envies. Rien n'est généré : on classe et filtre
**ta** bibliothèque.

```
apps/mobile     App Expo (React Native) : iPad + version web (même code)
apps/server     Service Node pour le Raspberry Pi : import de recettes + sert la version web
packages/core   Logique métier partagée et testée : suggestions, filtres, nutrition, courses…
supabase/       Schéma Postgres (migrations), règles d'accès, catalogue de départ
```

## Fonctionnalités

| | |
|---|---|
| **Recettes** | ingrédients + quantités, étapes, temps (prépa / cuisson / repos), durée *rapide / moyen / long* calculée, portions ajustables, catégories (petit-déj, déjeuner, dîner, goûter, snack), type de plat, matériel, tags |
| **Ingrédients** | produits de base **et** produits du commerce (marque), saisons (mois), nutrition / 100 g, conversions (poids d'une pièce, densité), régimes, allergènes, prix, « va bien avec ». ~60 produits de base créés à l'inscription |
| **Import universel** | URL de site (lecture des données schema.org, sans IA : Marmiton, 750g, blogs…), YouTube / TikTok / Instagram (légende → IA), texte collé, photo de livre ou de fiche manuscrite (IA vision). Chaque ingrédient est **relié au catalogue** ou **créé** lors de la relecture |
| **Scan de produits** | caméra de l'iPad → code-barres → fiche remplie depuis [Open Food Facts](https://world.openfoodfacts.org) (nutrition, allergènes, régimes, Nutri-Score, NOVA, additifs, photo) |
| **Note perso** | note /100 des produits du commerce selon **tes** critères : poids nutrition / transformation / additifs / bio, interdits (huile de palme, allergènes, additifs), seuils sucre et sel |
| **Remplacements** | lait → boisson végétale (soja, avoine, amande)… appliqué automatiquement à toutes les recettes : affichage, nutrition, frigo, courses, mode cuisine ; le lait animal est détecté et signalé |
| **Impact** | un jardin qui pousse à chaque repas cuisiné : CO₂ évité, surface agricole préservée, eau économisée, par rapport au même plat en version classique (viande, lait…). Données Poore & Nemecek (2018) via Our World in Data |
| **Le frigo** | frigo, congélateur, placards, épices, huiles, extras ; dates de péremption ; produits « toujours là » |
| **Suggestions** | classement par : répétition (le riz au curry d'hier descend), ingrédients disponibles, anti-gaspi (ce qui périme bientôt), saison, note, redécouverte. Chaque suggestion dit **pourquoi** |
| **Filtres anti-frustration** | avec ce que j'ai, il manque 1–2 trucs, < 30 min, sans four, une seule poêle, végétarien, batch cooking, plaisir / plats du quotidien + matériel absent, régimes, type de plat |
| **Mode cuisine** | étape par étape, gros texte, minuteries (détectées automatiquement), validation des étapes, écran toujours allumé, notes et note ★ à la fin |
| **Notes & variantes** | notes, pistes d'amélioration, variantes, retours après cuisson |
| **Techniques** | fiches avec photos, vidéos ou liens de démonstration, reliables aux étapes |
| **Nutrition** | kcal, protéines, glucides, lipides, fibres, sel par portion ; score de complétude ; repères doux, sans culpabilisation ; coût par portion |
| **Courses** | choisir des plats + portions → liste additionnée, rangée par rayon, frigo déduit, partagée dans le foyer |
| **Statistiques** | repas cuisinés, argent économisé, aliments sauvés, recettes les plus rentables / cuisinées |

## Mise en route

### 1. Supabase

1. Crée un projet gratuit sur [supabase.com](https://supabase.com).
2. Dans *SQL Editor*, exécute dans l'ordre tous les fichiers de `supabase/migrations/` (`0001` → `0006`).
3. Récupère dans *Project Settings → API* l'URL du projet et la clé `anon`.

Chaque compte créé reçoit son « foyer ». Pour partager un foyer à deux, ajoute l'autre compte à la
table `household_members` (un écran d'invitation viendra plus tard).

### 2. Service d'import (PC ou Raspberry Pi)

```bash
cp apps/server/.env.example apps/server/.env    # puis remplis-le
npm install
npm run server                                  # http://localhost:8787
```

**Choix du LLM** (`LLM_PROVIDER`). L'abonnement Claude ne donne pas accès à l'API (facturée à part),
d'où ces options :

- `gemini` (défaut) : offre gratuite de Google AI Studio, gère texte et photos. Clé sur aistudio.google.com/apikey.
- `openai` : n'importe quelle API compatible OpenAI. Groq (gratuit, rapide), OpenRouter (modèles `:free`), Mistral, ou LM Studio en local.
- `ollama` : 100 % local et open source (ex. `qwen2.5vl:7b`). Il faut un PC avec un GPU correct : sur un Raspberry Pi, c'est trop lent pour les photos.

Les sites de recettes classiques n'utilisent **pas** le LLM (données schema.org), c'est gratuit et instantané.

### 3. App iPad

```bash
cp apps/mobile/.env.example apps/mobile/.env    # URL Supabase, clé anon, adresse du Pi
npm run mobile
```

- **Test sur l'iPad** : installe *Expo Go* depuis l'App Store et scanne le QR code (même Wi-Fi).
- **Vraie app installée** (sans Mac) : `npx eas-cli@latest build --platform ios` compile dans le cloud
  Expo ; il faut un compte Apple Developer (99 €/an) pour l'installer durablement sur l'iPad.

### 4. Déploiement sur le Raspberry Pi

```bash
git clone … && cd recette-app
cp apps/server/.env.example apps/server/.env    # remplis-le
cp apps/server/.env .env                        # pour les variables de build de la version web
docker compose up -d --build
```

L'app web est alors disponible sur `http://<ip-du-pi>:8787` depuis le PC, et l'iPad appelle la même
adresse pour les imports (`EXPO_PUBLIC_SERVER_URL`). Pour y accéder hors de chez toi, Tailscale est
le plus simple.

## Développement

```bash
npm test             # tests de packages/core (suggestions, filtres, unités, courses…)
npm run typecheck    # tous les packages
npm run build:web    # export web de l'app → apps/mobile/dist
```

## Pistes pour la suite

- **Notation des repas et de la semaine** (végétarien, musculation, « 80 % nourrissant / 20 % plaisir ») : voir [docs/idees/notation-repas.md](docs/idees/notation-repas.md).
- **Profils nutritionnels** (Normal, Pré-marathon, Prise de masse, Sèche…) qui adaptent suggestions et repères : voir [docs/idees/profils-nutrition.md](docs/idees/profils-nutrition.md).

- Valeurs nutritionnelles : les données de départ sont des **ordres de grandeur** (inspirés de CIQUAL).
  Elles sont à affiner avec tes documents ; un import CIQUAL / Open Food Facts (code-barres) serait le plus solide.
- Paramètres nutrition et sport (besoins selon le profil) pour personnaliser le score de complétude.
- Planning de la semaine (table `meal_plan` déjà prévue) et liste de courses générée depuis le planning.
- Transcription audio des vidéos (Whisper) quand la recette n'est pas dans la description.
- Partage iOS : « Partager vers Recettes » depuis Instagram / Safari (extension de partage).
- Invitation d'un second membre dans le foyer.
