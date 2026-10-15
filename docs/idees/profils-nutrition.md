# Idée : profils nutritionnels (Normal, Pré-marathon, Prise de masse, Sèche…)

> Statut : **en attente**. À construire avec la [notation des repas](notation-repas.md), qui utilisera les objectifs du profil actif, et après les correctifs de l'audit (dates en heure locale, indispensables pour un profil daté).

## Le besoin

Choisir un mode selon la période, par exemple :
- **Normal** : l'usage actuel ;
- **Semaine pré-marathon** ;
- **Prise de masse** ;
- **Sèche**…

En changeant de profil, l'app adapte ce qu'elle propose.

L'app ne génère rien : un profil ne modifie pas les recettes, il change **la façon dont l'app classe et commente** celles de la bibliothèque (suggestions, repères nutritionnels, notation, portions).

## Ce qu'un profil modifie

| Levier | Normal | Pré-marathon | Prise de masse | Sèche |
|---|---|---|---|---|
| **Suggestions** | équilibre | glucides en tête, plats digestes et connus | plats denses en calories et en protéines | protéines + volume (légumes), densité calorique faible |
| **Repères affichés** | ceux d'aujourd'hui | « peu de fibres » n'est **plus** une alerte (voulu avant une course) | « portion légère » devient une alerte | « riche en calories » devient une alerte |
| **Objectifs du jour** | protéines ~1,6–1,8 g/kg | glucides très élevés (~8–10 g/kg) les 2–3 derniers jours | léger surplus calorique, protéines ~1,8–2,2 g/kg | déficit modéré, protéines ~2–2,4 g/kg |
| **Filtres par défaut** | aucun | pas de plat plaisir trop gras, rien de nouveau ni d'épicé | — | « plats du quotidien » |
| **Portions** | celles de la recette | — | proposées à la hausse | proposées à la baisse |

Les valeurs sont des **ordres de grandeur courants** de la nutrition sportive, à affiner avec les documents de nutrition et de sport. Chaque profil reste modifiable.

Autres profils possibles : **Récupération** (après une course ou une grosse séance), **Jour de repos**, **Entraînement intense**.

## Fonctionnement

- **Profils de base** fournis (Normal, Pré-marathon, Récupération, Prise de masse, Sèche) **et profils personnalisés** : on duplique un profil et on règle ses paramètres.
- **Profil daté** : « Pré-marathon du 18 au 25 octobre ». L'app repasse automatiquement en « Normal » à la fin.
- **Sélecteur sur l'accueil** : une pastille sous le grand titre, par exemple « 🏃 Pré-marathon · J-3 », pour changer en un clic.
- **Raisons explicites** dans les suggestions : « Riche en glucides · idéal J-2 ».
- Les **repères nutritionnels** (`nutritionMessages`) et la **note perso des produits** peuvent aussi dépendre du profil.

## Conception technique

Un profil est un paquet de réglages :

```ts
interface NutritionProfile {
  id: string;
  name: string;              // "Pré-marathon"
  icon: string;              // "🏃"
  targets: {                 // par kg de poids corporel et par jour
    protein_g_per_kg: number;
    carbs_g_per_kg?: number;
    kcal_factor?: number;    // 1 = maintien, 1.1 = surplus, 0.85 = déficit
    fiber_g?: number;
  };
  suggestionWeights: {       // bonus "adéquation au profil" dans suggestRecipes()
    carbs: number; protein: number; kcalDensity: number; fiber: number; fat: number;
  };
  alerts: {                  // seuils de nutritionMessages() (null = message désactivé)
    maxSatFat_g: number | null; maxSalt_g: number | null; minFiber_g: number | null; minProtein_g: number | null;
  };
  defaultFilters?: RecipeFilters;
  portionFactor?: number;    // 1.2 = portions suggérées +20 %
}
```

1. **`packages/core`** : type `NutritionProfile` et profils de base.
   - `suggestRecipes()` reçoit un bonus d'adéquation calculé sur les macros par portion de chaque recette.
   - `nutritionMessages()` prend ses seuils dans le profil (aujourd'hui `MESSAGE_THRESHOLDS`) (les seuils actuels deviennent ceux de « Normal »).
   - Tests : en pré-marathon, le dal (riche en glucides) passe devant l'omelette ; en sèche, c'est l'inverse.
2. **Base de données** : table `profiles` (profils personnalisés du foyer) et, sur le foyer ou l'utilisateur, `active_profile_id`, `profile_starts_on`, `profile_ends_on` et `body_weight_kg`.
3. **App** : écran « Mon profil » (poids, profil actif, dates, réglages), pastille de sélection sur l'accueil, raisons dans les suggestions.

## Prérequis

| Besoin | État |
|---|---|
| Poids corporel (profil utilisateur) | ❌ commun avec la [notation des repas](notation-repas.md) |
| Dates en heure locale (correctif de l'audit) | ❌ |
| Macros par portion des recettes | ✅ `computeRecipeNutrition()` |
| Glucides par ingrédient | ✅ `carbs_g` dans le catalogue |
| Repères nutritionnels paramétrables | ⚠️ seuils regroupés dans `MESSAGE_THRESHOLDS` (`packages/core/src/nutritionMessages.ts`), à rendre paramétrables |

## Question ouverte

Profil **par foyer** ou **par personne** ? Si deux personnes partagent le foyer et qu'une seule prépare un marathon, le profil doit être personnel. Les suggestions communes pourraient alors combiner les deux profils, ou suivre celui de la personne qui cuisine.
