-- =============================================================================
-- 5 recettes de test (végétariennes, dont un plat plaisir)
-- À exécuter dans Supabase → SQL Editor. Relançable : les recettes du même nom
-- sont remplacées. Les ingrédients sont reliés au catalogue de départ par leur nom.
-- =============================================================================

-- Petite aide : ajoute une ligne d'ingrédient, reliée au catalogue si le nom existe
create or replace function pg_temp.add_ing(
  r uuid, h uuid, pos int, ing_name text, q numeric, u text, raw text, opt boolean default false
) returns void language sql as $$
  insert into recipe_ingredients (recipe_id, ingredient_id, raw_text, quantity, unit, position, optional)
  values (r, (select id from ingredients where household_id = h and name = ing_name limit 1), raw, q, u, pos, opt);
$$;

create or replace function pg_temp.add_step(r uuid, pos int, txt text, timer int default null)
returns void language sql as $$
  insert into recipe_steps (recipe_id, position, text, timer_seconds) values (r, pos, txt, timer);
$$;

do $$
declare
  -- Ton e-mail de connexion à l'app (sinon le premier foyer trouvé est utilisé)
  my_email text := 'tom.ricouard@protonmail.com';
  h uuid;
  r uuid;
begin
  select m.household_id into h
  from household_members m join auth.users u on u.id = m.user_id
  where u.email = my_email limit 1;
  if h is null then select id into h from households order by created_at limit 1; end if;
  if h is null then raise exception 'Aucun foyer : crée d''abord ton compte dans l''app.'; end if;

  delete from recipes where household_id = h and title in (
    'Dal de lentilles corail au lait de coco', 'Bowl pois chiches rôtis, tofu & brocoli',
    'Omelette champignons & épinards', 'Porridge banane', 'Pizza maison aux légumes');

  -- Tag abandonné : retiré de toutes les recettes du foyer
  update recipes set tags = array_remove(tags, 'enfant_friendly') where household_id = h and 'enfant_friendly' = any(tags);

  -- 1. Dal ---------------------------------------------------------------------
  insert into recipes (household_id, title, description, servings, prep_min, cook_min, meal_types, dish_type, equipment, tags, rating, source_type)
  values (h, 'Dal de lentilles corail au lait de coco',
          'Plat complet, riche en protéines végétales et en fibres. Encore meilleur réchauffé.',
          4, 10, 25, '{dejeuner,diner}', 'plat', '{casserole}', '{batch_cooking}', 5, 'manual')
  returning id into r;
  perform pg_temp.add_ing(r, h, 0, 'Lentilles corail', 250, 'g', '250 g de lentilles corail');
  perform pg_temp.add_ing(r, h, 1, 'Lait de coco', 400, 'ml', '400 ml de lait de coco');
  perform pg_temp.add_ing(r, h, 2, 'Tomates concassées', 400, 'g', '400 g de tomates concassées');
  perform pg_temp.add_ing(r, h, 3, 'Oignon', 1, null, '1 oignon');
  perform pg_temp.add_ing(r, h, 4, 'Ail', 2, 'gousse', '2 gousses d''ail');
  perform pg_temp.add_ing(r, h, 5, 'Gingembre', 10, 'g', '10 g de gingembre frais');
  perform pg_temp.add_ing(r, h, 6, 'Curry en poudre', 2, 'cac', '2 c. à café de curry');
  perform pg_temp.add_ing(r, h, 7, 'Cumin', 1, 'cac', '1 c. à café de cumin');
  perform pg_temp.add_ing(r, h, 8, 'Huile d''olive', 1, 'cas', '1 c. à soupe d''huile d''olive');
  perform pg_temp.add_ing(r, h, 9, 'Riz', 300, 'g', '300 g de riz basmati');
  perform pg_temp.add_ing(r, h, 10, 'Sel', 1, 'pincee', 'sel');
  perform pg_temp.add_step(r, 0, 'Émincer l''oignon, hacher l''ail et râper le gingembre.');
  perform pg_temp.add_step(r, 1, 'Faire revenir l''oignon, l''ail et le gingembre dans l''huile pendant 5 minutes.', 300);
  perform pg_temp.add_step(r, 2, 'Ajouter le curry et le cumin, mélanger 1 minute pour torréfier les épices.', 60);
  perform pg_temp.add_step(r, 3, 'Ajouter les lentilles rincées, les tomates, le lait de coco et 200 ml d''eau. Cuire 20 minutes à feu doux en remuant.', 1200);
  perform pg_temp.add_step(r, 4, 'Pendant ce temps, cuire le riz 11 minutes dans l''eau bouillante salée.', 660);
  perform pg_temp.add_step(r, 5, 'Saler, servir le dal sur le riz.');

  -- 2. Bowl ----------------------------------------------------------------------
  insert into recipes (household_id, title, description, servings, prep_min, cook_min, meal_types, dish_type, equipment, tags, rating, source_type)
  values (h, 'Bowl pois chiches rôtis, tofu & brocoli',
          'Bowl protéiné pour les jours d''entraînement.',
          2, 15, 25, '{dejeuner,diner}', 'plat', '{four,casserole,poele}', '{}', 4, 'manual')
  returning id into r;
  perform pg_temp.add_ing(r, h, 0, 'Pois chiches', 240, 'g', '240 g de pois chiches cuits');
  perform pg_temp.add_ing(r, h, 1, 'Tofu ferme', 200, 'g', '200 g de tofu ferme');
  perform pg_temp.add_ing(r, h, 2, 'Brocoli', 300, 'g', '300 g de brocoli');
  perform pg_temp.add_ing(r, h, 3, 'Riz', 150, 'g', '150 g de riz');
  perform pg_temp.add_ing(r, h, 4, 'Citron', 1, null, '1 citron');
  perform pg_temp.add_ing(r, h, 5, 'Huile d''olive', 2, 'cas', '2 c. à soupe d''huile d''olive');
  perform pg_temp.add_ing(r, h, 6, 'Sauce soja', 2, 'cas', '2 c. à soupe de sauce soja');
  perform pg_temp.add_ing(r, h, 7, 'Paprika', 1, 'cac', '1 c. à café de paprika fumé');
  perform pg_temp.add_step(r, 0, 'Préchauffer le four à 200 °C. Égoutter et sécher les pois chiches.');
  perform pg_temp.add_step(r, 1, 'Les mélanger avec 1 c. à soupe d''huile, le paprika et une pincée de sel. Rôtir 25 minutes en remuant à mi-cuisson.', 1500);
  perform pg_temp.add_step(r, 2, 'Cuire le riz 11 minutes.', 660);
  perform pg_temp.add_step(r, 3, 'Cuire le brocoli en fleurettes 6 minutes à la vapeur.', 360);
  perform pg_temp.add_step(r, 4, 'Couper le tofu en cubes, le dorer à la poêle avec le reste d''huile 8 minutes, déglacer à la sauce soja.', 480);
  perform pg_temp.add_step(r, 5, 'Répartir le riz, les légumes, les pois chiches et le tofu dans les bols. Arroser de jus de citron.');

  -- 3. Omelette ------------------------------------------------------------------
  insert into recipes (household_id, title, description, servings, prep_min, cook_min, meal_types, dish_type, equipment, tags, rating, source_type)
  values (h, 'Omelette champignons & épinards',
          'Rapide, une seule poêle, plein de protéines.',
          1, 5, 8, '{petit_dejeuner,dejeuner}', 'plat', '{poele}', '{une_seule_poele}', 4, 'manual')
  returning id into r;
  perform pg_temp.add_ing(r, h, 0, 'Œuf', 3, null, '3 œufs');
  perform pg_temp.add_ing(r, h, 1, 'Champignon de Paris', 100, 'g', '100 g de champignons de Paris');
  perform pg_temp.add_ing(r, h, 2, 'Épinard', 50, 'g', '50 g de pousses d''épinard');
  perform pg_temp.add_ing(r, h, 3, 'Emmental râpé', 20, 'g', '20 g d''emmental râpé', true);
  perform pg_temp.add_ing(r, h, 4, 'Beurre', 10, 'g', '10 g de beurre');
  perform pg_temp.add_ing(r, h, 5, 'Sel', 1, 'pincee', 'sel');
  perform pg_temp.add_ing(r, h, 6, 'Poivre', 1, 'pincee', 'poivre');
  perform pg_temp.add_step(r, 0, 'Émincer les champignons. Battre les œufs avec le sel et le poivre.');
  perform pg_temp.add_step(r, 1, 'Faire fondre le beurre et dorer les champignons 4 minutes.', 240);
  perform pg_temp.add_step(r, 2, 'Ajouter les épinards et les laisser tomber 1 minute.', 60);
  perform pg_temp.add_step(r, 3, 'Verser les œufs, cuire 3 minutes à feu moyen.', 180);
  perform pg_temp.add_step(r, 4, 'Parsemer d''emmental, plier l''omelette et servir.');

  -- 4. Porridge ------------------------------------------------------------------
  insert into recipes (household_id, title, description, servings, prep_min, cook_min, meal_types, dish_type, equipment, tags, rating, source_type)
  values (h, 'Porridge banane',
          'Petit-déjeuner rassasiant avant l''entraînement.',
          1, 2, 5, '{petit_dejeuner,gouter}', 'plat', '{casserole}', '{}', 4, 'manual')
  returning id into r;
  perform pg_temp.add_ing(r, h, 0, 'Flocons d''avoine', 50, 'g', '50 g de flocons d''avoine');
  perform pg_temp.add_ing(r, h, 1, 'Lait', 200, 'ml', '200 ml de lait');
  perform pg_temp.add_ing(r, h, 2, 'Banane', 1, null, '1 banane');
  perform pg_temp.add_ing(r, h, 3, 'Yaourt nature', 125, 'g', '1 yaourt nature', true);
  perform pg_temp.add_ing(r, h, 4, 'Sucre', 1, 'cac', '1 c. à café de sucre', true);
  perform pg_temp.add_step(r, 0, 'Chauffer le lait avec les flocons d''avoine et cuire 5 minutes en remuant.', 300);
  perform pg_temp.add_step(r, 1, 'Couper la banane en rondelles.');
  perform pg_temp.add_step(r, 2, 'Servir avec la banane et, au choix, le yaourt et le sucre.');

  -- 5. Pizza (plat plaisir) ------------------------------------------------------
  insert into recipes (household_id, title, description, servings, prep_min, cook_min, rest_min, meal_types, dish_type, equipment, tags, rating, source_type)
  values (h, 'Pizza maison aux légumes',
          'Le plat plaisir du week-end.',
          2, 20, 12, 60, '{diner}', 'plat', '{four}', '{plaisir}', 5, 'manual')
  returning id into r;
  perform pg_temp.add_ing(r, h, 0, 'Farine de blé', 300, 'g', '300 g de farine', false);
  perform pg_temp.add_ing(r, h, 1, null, 1, 'sachet', '1 sachet de levure boulangère');
  perform pg_temp.add_ing(r, h, 2, null, 180, 'ml', '180 ml d''eau tiède');
  perform pg_temp.add_ing(r, h, 3, 'Huile d''olive', 1, 'cas', '1 c. à soupe d''huile d''olive');
  perform pg_temp.add_ing(r, h, 4, 'Tomates concassées', 200, 'g', '200 g de tomates concassées');
  perform pg_temp.add_ing(r, h, 5, 'Emmental râpé', 150, 'g', '150 g d''emmental râpé');
  perform pg_temp.add_ing(r, h, 6, 'Champignon de Paris', 100, 'g', '100 g de champignons');
  perform pg_temp.add_ing(r, h, 7, 'Poivron', 1, null, '1 poivron');
  perform pg_temp.add_ing(r, h, 8, 'Sel', 1, 'pincee', 'sel');
  perform pg_temp.add_step(r, 0, 'Mélanger la farine, la levure et le sel. Ajouter l''eau et l''huile, pétrir 10 minutes.', 600);
  perform pg_temp.add_step(r, 1, 'Laisser lever la pâte 1 h sous un torchon.', 3600);
  perform pg_temp.add_step(r, 2, 'Préchauffer le four à 250 °C. Émincer les champignons et le poivron.');
  perform pg_temp.add_step(r, 3, 'Étaler la pâte, napper de tomates, garnir de légumes et d''emmental.');
  perform pg_temp.add_step(r, 4, 'Enfourner 12 minutes.', 720);

  raise notice '5 recettes de test ajoutées au foyer %', h;
end $$;
