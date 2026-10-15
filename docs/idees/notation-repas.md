# Idée : notation des repas et de la semaine

> Statut : **en attente**. À reprendre après les correctifs de l'audit (les dates calculées en UTC fausseraient les notes de la semaine).
> Voir aussi : [profils nutritionnels](profils-nutrition.md), qui fourniront les objectifs utilisés par la notation.

## Le besoin

Un régime équilibré, végétarien proche du vegan (hors fromage, œufs parfois, plats transformés), adapté à la musculation : beaucoup de protéines, assez de fibres, pas trop gras, sucré ou salé. Sans exclure les plats moins intéressants ni les repas plaisir, tant qu'ils ne font pas la majorité de l'alimentation.

Philosophie à afficher dans l'app : **« 80 % nourrissant, 20 % plaisir, sans culpabilité. »**

L'app ne dit jamais « cette pizza est mauvaise ». Elle dit : *« Repas plaisir : 44/100. Ta semaine reste à 85/100 et tes protéines sont atteintes. Aucun problème. »*

## Proposition de départ

Deux niveaux : une note par repas (/100), puis une note de la semaine. Quatre piliers par repas :

| Pilier | Points | Ce qui est évalué |
|---|---|---|
| Densité nutritionnelle | 35 | légumes et fruits, légumineuses, céréales complètes, noix et graines, aliments peu transformés |
| Protéines & muscu | 25 | quantité et répartition des protéines, sources végétales, fer, B12, oméga-3 |
| Équilibre énergétique | 25 | sucres ajoutés, graisses saturées, sel, densité calorique, portion |
| Flexibilité & plaisir | 15 | place laissée aux aliments moins optimaux, variété, pas de restriction inutile |

Semaine : moyenne pondérée, avec 70 % pour les repas principaux, 20 % pour les petits-déjeuners et collations, et 10 % pour les sorties, cheat meals et grignotages. Objectif réaliste : 80–85/100 en moyenne.

## Analyse

**À garder**
- Les deux niveaux, repas puis semaine : l'app a déjà l'historique des repas (`meal_log`, avec les portions) et la nutrition par portion de chaque recette.
- Les trois premiers piliers, proches des indices de qualité alimentaire reconnus, et mesurables.
- Le ton et les badges plutôt qu'une note punitive.

**À corriger**
1. **Le pilier « Flexibilité & plaisir » noté par repas se contredit.** Il donne 15 points au repas idéal et 8 à la pizza : c'est une pénalité de plus, alors que la pizza est déjà pénalisée en densité et en équilibre. La flexibilité n'a de sens qu'à l'échelle de la semaine, comme une *part* de repas plaisir.
2. **La pondération 70/20/10 masque les écarts.** Plus on classe de repas en « cheat », moins ils comptent. Il vaut mieux pondérer par les **calories** et laisser le pilier flexibilité juger la fréquence.
3. **Les protéines doivent dépendre du profil.** Repères courants pour la musculation : environ 1,6 à 2,2 g/kg/jour, soit 0,3 à 0,4 g/kg par repas. Il faut renseigner son poids et son objectif.
4. **Certaines données manquent** (voir plus bas).

## Version retenue

### Note par repas : /100, uniquement des critères mesurables

| Pilier | Points | Calcul |
|---|---|---|
| Densité nutritionnelle | 40 | grammes de légumes et fruits par portion (1 portion ≈ 80 g, viser 2 ou plus), légumineuse ou protéine végétale, féculent complet, bonne graisse, fibres |
| Protéines | 30 | protéines de la portion rapportées à l'objectif par repas du profil |
| Équilibre gras/sucre/sel | 30 | graisses saturées, sucres (hors fruits), sel, densité calorique |

Elle **remplace** le « score de complétude » actuel (`completenessScore` dans `packages/core/src/nutrition.ts`).
La **note perso des produits** (`productScore.ts`) reste à part : elle note les courses, pas les repas.

### Note de la semaine

- Moyenne des notes de repas **pondérée par les calories**.
- Bonus et indicateurs d'habitudes :
  - **Flexibilité** : part de repas plaisir dans la zone 10–25 %, moins bien noté à 0 % (rigidité) comme au-delà de 30 % ;
  - **Protéines** : objectif atteint X jours sur 7 ;
  - **Fibres** : apport moyen par jour (repère : environ 30 g) ;
  - **Variété végétale** : nombre de végétaux différents dans la semaine (repère : 30) ;
  - **Plats très transformés** : X repas sur 21.

Exemple d'affichage :

> **Semaine : 84/100**. Protéines atteintes 6 jours sur 7 · Fibres : bon niveau · 2 repas très transformés sur 21 · Flexibilité équilibrée
> 💡 Ajouter une source de fer ou de légumineuses à 3 déjeuners

### Badges (neutres, jamais punitifs)

Végétal dominant · Protéines solides · Fibres élevées · Peu transformé · Plaisir préservé · Semaine équilibrée · Variété végétale

### Lien avec les suggestions (le vrai plus pour l'app)

Les manques de la semaine en cours font remonter les recettes qui les comblent. Exemple : protéines ou légumineuses insuffisantes → les recettes riches en protéines végétales passent en tête. L'app reste fidèle à son principe : elle ne génère rien, elle propose les recettes de la bibliothèque au bon moment.

## Prérequis

| Besoin | État | Solution |
|---|---|---|
| Correctifs de l'audit (dates en heure locale, frigo vidé après cuisson) | ❌ | à faire **avant** |
| Profil : poids, objectif protéines (g/kg), fibres, calories | ❌ | écran « Mon profil » ; défaut 1,8 g/kg |
| Portions de légumes et fruits | ✅ | grammes + catégorie de l'ingrédient |
| Légumineuses, tofu, seitan | ✅ | catégories `legumineuse` / `proteine` + régime |
| Céréales **complètes**, **bonnes graisses** | ❌ | étiquettes sur les ingrédients (`complet`, `bonne_graisse`) |
| Sucres **ajoutés** | ⚠️ | sucres totaux hors fruits ; `added-sugars_100g` d'Open Food Facts quand elle existe |
| **Fer, B12, oméga-3** | ❌ | colonnes à ajouter ; valeurs depuis la table CIQUAL et les documents de nutrition et de sport |
| Repas pris dehors | ❌ | journal rapide « repas extérieur / plaisir » avec une estimation |
| Marquer un repas comme « plaisir » | ❌ | case dans « J'ai cuisiné ça » et dans le mode cuisine |

## Étapes de réalisation

1. Écran « Mon profil » et objectifs journaliers.
2. Étiquettes d'ingrédients (`complet`, `bonne_graisse`, `source_fer`…) et éventuellement les micronutriments.
3. `mealScore()` et `weekScore()` dans `packages/core`, avec des tests sur les exemples : un bowl quinoa-pois chiches-tofu doit être bien noté, une pizza végé avec salade et bière plus faiblement.
4. Écran « Ma semaine » : note, indicateurs, badges et conseils.
5. Branchement sur `suggestRecipes()` pour combler les manques.
