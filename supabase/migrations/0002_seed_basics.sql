-- =============================================================================
-- Catalogue de départ : ~60 produits de base courants, créés pour chaque foyer.
-- Valeurs nutritionnelles pour 100 g : ORDRES DE GRANDEUR inspirés de la table
-- CIQUAL (Anses), à vérifier et affiner. Saisons : France métropolitaine.
-- =============================================================================

create or replace function seed_household_basics(h uuid)
returns void language sql security definer set search_path = public as $$
  insert into ingredients (
    household_id, name, kind, aliases, category, season_months, grams_per_piece, density,
    kcal, protein_g, carbs_g, sugars_g, fat_g, sat_fat_g, fiber_g, salt_g,
    is_vegan, is_vegetarian, contains_lactose, contains_gluten, allergens
  )
  select h, v.name,
         case when v.category = 'extra' or v.name in ('Tomates concassées', 'Thon en conserve', 'Sauce soja', 'Moutarde', 'Concentré de tomates') then 'product' else 'base' end,
         v.aliases, v.category, v.seasons, v.gpp, v.density,
         v.kcal, v.prot, v.carbs, v.sugars, v.fat, v.sat, v.fiber, v.salt,
         v.diet = 'vegan', v.diet in ('vegan', 'vege'), v.lactose, v.gluten, v.allergens
  from (values
    -- name, aliases, category, saisons, g/pièce, densité, kcal, prot, gluc, sucres, lip, sat, fibres, sel, régime, lactose, gluten, allergènes
    ('Tomate', '{tomates}'::text[], 'legume', '{6,7,8,9}'::smallint[], 120::numeric, null::numeric, 19::numeric, 0.9::numeric, 2.5::numeric, 2.3::numeric, 0.3::numeric, 0.1::numeric, 1.2::numeric, 0.01::numeric, 'vegan', false, false, '{}'::text[]),
    ('Courgette', '{courgettes}', 'legume', '{6,7,8,9}', 200, null, 16, 1.2, 1.9, 1.7, 0.4, 0.1, 1.1, 0.01, 'vegan', false, false, '{}'),
    ('Aubergine', '{aubergines}', 'legume', '{7,8,9}', 250, null, 22, 1.1, 3.0, 2.5, 0.2, 0.0, 2.5, 0.01, 'vegan', false, false, '{}'),
    ('Poivron', '{poivrons,"poivron rouge","poivron vert","poivron jaune"}', 'legume', '{7,8,9}', 150, null, 28, 0.9, 5.0, 4.5, 0.3, 0.1, 1.8, 0.01, 'vegan', false, false, '{}'),
    ('Concombre', '{concombres}', 'legume', '{5,6,7,8,9}', 300, null, 12, 0.6, 2.0, 1.7, 0.1, 0.0, 0.7, 0.01, 'vegan', false, false, '{}'),
    ('Haricot vert', '{"haricots verts"}', 'legume', '{6,7,8,9}', null, null, 30, 1.8, 4.0, 2.0, 0.2, 0.0, 3.4, 0.01, 'vegan', false, false, '{}'),
    ('Petit pois', '{"petits pois"}', 'legume', '{5,6,7}', null, null, 80, 5.4, 12.0, 4.5, 0.4, 0.1, 5.0, 0.01, 'vegan', false, false, '{}'),
    ('Salade verte', '{laitue,salade,batavia,"feuille de chêne"}', 'legume', '{4,5,6,7,8,9,10}', 300, null, 15, 1.2, 1.5, 1.0, 0.2, 0.0, 1.2, 0.02, 'vegan', false, false, '{}'),
    ('Épinard', '{épinards,"pousses d''épinard"}', 'legume', '{3,4,5,9,10,11}', null, null, 23, 2.9, 1.4, 0.4, 0.4, 0.1, 2.2, 0.2, 'vegan', false, false, '{}'),
    ('Brocoli', '{brocolis}', 'legume', '{6,7,8,9,10,11}', 400, null, 34, 2.8, 2.7, 1.7, 0.4, 0.1, 2.6, 0.08, 'vegan', false, false, '{}'),
    ('Chou-fleur', '{"chou fleur"}', 'legume', '{1,2,3,4,9,10,11,12}', 800, null, 25, 1.9, 2.6, 2.0, 0.3, 0.1, 2.2, 0.04, 'vegan', false, false, '{}'),
    ('Poireau', '{poireaux}', 'legume', '{1,2,3,4,9,10,11,12}', 250, null, 30, 1.5, 4.6, 2.5, 0.3, 0.0, 3.0, 0.03, 'vegan', false, false, '{}'),
    ('Courge butternut', '{butternut,courge,potiron,potimarron}', 'legume', '{1,2,9,10,11,12}', 1000, null, 45, 1.0, 10.0, 2.2, 0.1, 0.0, 2.0, 0.01, 'vegan', false, false, '{}'),
    ('Carotte', '{carottes}', 'legume', '{}', 100, null, 36, 0.8, 7.6, 5.0, 0.2, 0.0, 2.7, 0.08, 'vegan', false, false, '{}'),
    ('Oignon', '{oignons,"oignon jaune","oignon rouge"}', 'legume', '{}', 150, null, 40, 1.2, 7.6, 5.0, 0.2, 0.0, 1.7, 0.01, 'vegan', false, false, '{}'),
    ('Échalote', '{échalotes}', 'legume', '{}', 30, null, 70, 1.9, 14.0, 7.0, 0.1, 0.0, 2.4, 0.02, 'vegan', false, false, '{}'),
    ('Ail', '{"gousse d''ail",gousses}', 'legume', '{}', 5, null, 131, 5.8, 22.0, 1.5, 0.5, 0.1, 4.7, 0.04, 'vegan', false, false, '{}'),
    ('Pomme de terre', '{"pommes de terre",patate,patates}', 'legume', '{}', 150, null, 80, 2.0, 17.0, 0.8, 0.1, 0.0, 1.8, 0.01, 'vegan', false, false, '{}'),
    ('Champignon de Paris', '{champignons,champignon}', 'legume', '{}', 20, null, 22, 3.1, 0.3, 0.2, 0.3, 0.1, 1.5, 0.02, 'vegan', false, false, '{}'),
    ('Gingembre', '{"gingembre frais"}', 'epice', '{}', null, null, 80, 1.8, 15.0, 1.7, 0.8, 0.2, 2.0, 0.03, 'vegan', false, false, '{}'),
    ('Persil', '{"persil plat"}', 'epice', '{}', null, null, 40, 3.0, 4.0, 0.9, 0.8, 0.1, 4.0, 0.1, 'vegan', false, false, '{}'),
    ('Basilic', '{"basilic frais"}', 'epice', '{6,7,8,9}', null, null, 25, 3.2, 1.0, 0.3, 0.6, 0.0, 1.6, 0.01, 'vegan', false, false, '{}'),
    ('Pomme', '{pommes}', 'fruit', '{1,2,3,4,8,9,10,11,12}', 150, null, 52, 0.3, 12.0, 10.0, 0.2, 0.0, 2.0, 0.0, 'vegan', false, false, '{}'),
    ('Banane', '{bananes}', 'fruit', '{}', 120, null, 90, 1.1, 20.0, 15.0, 0.3, 0.1, 2.6, 0.0, 'vegan', false, false, '{}'),
    ('Citron', '{citrons,"jus de citron"}', 'fruit', '{}', 100, 1.03, 30, 0.8, 3.0, 2.5, 0.3, 0.0, 2.0, 0.0, 'vegan', false, false, '{}'),
    ('Fraise', '{fraises}', 'fruit', '{4,5,6,7}', 15, null, 32, 0.7, 6.0, 5.0, 0.3, 0.0, 2.0, 0.0, 'vegan', false, false, '{}'),
    ('Riz', '{"riz basmati","riz thaï","riz blanc"}', 'feculent', '{}', null, 0.85, 350, 7.5, 77.0, 0.3, 0.6, 0.2, 1.3, 0.0, 'vegan', false, false, '{}'),
    ('Pâtes', '{spaghetti,penne,fusilli,tagliatelles,coquillettes}', 'feculent', '{}', null, null, 355, 12.5, 70.0, 3.0, 1.5, 0.3, 3.0, 0.01, 'vegan', false, true, '{gluten}'),
    ('Semoule', '{"semoule de blé",couscous}', 'feculent', '{}', null, 0.7, 360, 12.0, 72.0, 1.0, 1.2, 0.2, 3.5, 0.01, 'vegan', false, true, '{gluten}'),
    ('Farine de blé', '{farine,"farine T55","farine T45"}', 'feculent', '{}', null, 0.55, 345, 10.0, 72.0, 1.0, 1.2, 0.2, 3.0, 0.0, 'vegan', false, true, '{gluten}'),
    ('Pain', '{baguette,"pain de campagne"}', 'boulangerie', '{}', null, null, 270, 9.0, 52.0, 3.0, 1.5, 0.3, 3.0, 1.2, 'vegan', false, true, '{gluten}'),
    ('Flocons d''avoine', '{avoine,"flocons d''avoine"}', 'feculent', '{}', null, 0.4, 370, 13.0, 58.0, 1.0, 7.0, 1.3, 10.0, 0.01, 'vegan', false, true, '{gluten}'),
    ('Lentilles corail', '{lentilles}', 'legumineuse', '{}', null, 0.85, 340, 24.0, 50.0, 2.0, 1.5, 0.2, 11.0, 0.02, 'vegan', false, false, '{}'),
    ('Pois chiches', '{"pois chiche"}', 'legumineuse', '{}', null, null, 140, 7.0, 17.0, 0.5, 2.4, 0.3, 7.0, 0.3, 'vegan', false, false, '{}'),
    ('Tofu ferme', '{tofu}', 'proteine', '{}', null, null, 120, 13.0, 1.0, 0.5, 7.0, 1.0, 1.0, 0.02, 'vegan', false, false, '{soja}'),
    ('Œuf', '{oeuf,oeufs,œufs}', 'proteine', '{}', 55, null, 140, 12.7, 0.5, 0.3, 9.8, 2.6, 0.0, 0.35, 'vege', false, false, '{oeuf}'),
    ('Blanc de poulet', '{poulet,"filet de poulet","escalope de poulet"}', 'proteine', '{}', 150, null, 110, 23.0, 0.0, 0.0, 1.5, 0.4, 0.0, 0.15, 'none', false, false, '{}'),
    ('Bœuf haché', '{"viande hachée","steak haché",boeuf}', 'proteine', '{}', 100, null, 125, 21.0, 0.0, 0.0, 5.0, 2.2, 0.0, 0.15, 'none', false, false, '{}'),
    ('Lardons', '{"lardons fumés"}', 'proteine', '{}', null, null, 270, 15.0, 0.5, 0.5, 23.0, 8.5, 0.0, 2.3, 'none', false, false, '{}'),
    ('Saumon', '{"pavé de saumon","filet de saumon"}', 'proteine', '{}', 125, null, 200, 20.0, 0.0, 0.0, 13.0, 2.5, 0.0, 0.12, 'none', false, false, '{poisson}'),
    ('Thon en conserve', '{thon,"thon au naturel"}', 'proteine', '{}', null, null, 110, 25.0, 0.0, 0.0, 1.0, 0.3, 0.0, 0.9, 'none', false, false, '{poisson}'),
    ('Lait', '{"lait demi-écrémé","lait entier"}', 'laitier', '{}', null, 1.03, 46, 3.3, 4.8, 4.8, 1.6, 1.0, 0.0, 0.1, 'vege', true, false, '{lait}'),
    ('Beurre', '{"beurre doux"}', 'laitier', '{}', null, 0.91, 745, 0.7, 0.6, 0.6, 82.0, 54.0, 0.0, 0.02, 'vege', true, false, '{lait}'),
    ('Crème fraîche', '{crème,"crème liquide","crème épaisse"}', 'laitier', '{}', null, 1.0, 290, 2.4, 3.0, 3.0, 30.0, 20.0, 0.0, 0.05, 'vege', true, false, '{lait}'),
    ('Yaourt nature', '{yaourt,yogourt}', 'laitier', '{}', 125, null, 60, 4.0, 5.0, 5.0, 3.0, 2.0, 0.0, 0.1, 'vege', true, false, '{lait}'),
    -- Fromages affinés : quasiment sans lactose
    ('Emmental râpé', '{emmental,gruyère,"fromage râpé"}', 'laitier', '{}', null, 0.4, 375, 28.0, 0.0, 0.0, 29.0, 19.0, 0.0, 0.7, 'vege', false, false, '{lait}'),
    ('Parmesan', '{parmigiano}', 'laitier', '{}', null, 0.4, 390, 35.0, 0.0, 0.0, 28.0, 18.0, 0.0, 1.6, 'none', false, false, '{lait}'),
    ('Huile d''olive', '{huile}', 'huile', '{}', null, 0.92, 900, 0.0, 0.0, 0.0, 100.0, 14.0, 0.0, 0.0, 'vegan', false, false, '{}'),
    ('Huile de tournesol', '{"huile neutre"}', 'huile', '{}', null, 0.92, 900, 0.0, 0.0, 0.0, 100.0, 11.0, 0.0, 0.0, 'vegan', false, false, '{}'),
    ('Sel', '{"sel fin","fleur de sel"}', 'epice', '{}', null, 1.2, 0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 100.0, 'vegan', false, false, '{}'),
    ('Poivre', '{"poivre noir"}', 'epice', '{}', null, 0.5, 250, 10.0, 38.0, 0.6, 3.0, 1.4, 25.0, 0.05, 'vegan', false, false, '{}'),
    ('Curry en poudre', '{curry}', 'epice', '{}', null, 0.4, 325, 14.0, 26.0, 2.8, 14.0, 2.2, 33.0, 0.13, 'vegan', false, false, '{}'),
    ('Cumin', '{"cumin moulu"}', 'epice', '{}', null, 0.4, 375, 18.0, 34.0, 2.3, 22.0, 1.5, 10.0, 0.4, 'vegan', false, false, '{}'),
    ('Paprika', '{"paprika fumé"}', 'epice', '{}', null, 0.45, 280, 14.0, 19.0, 10.0, 13.0, 2.1, 35.0, 0.2, 'vegan', false, false, '{}'),
    ('Sucre', '{"sucre en poudre","sucre blanc"}', 'condiment', '{}', null, 0.85, 400, 0.0, 100.0, 100.0, 0.0, 0.0, 0.0, 0.0, 'vegan', false, false, '{}'),
    ('Moutarde', '{"moutarde de Dijon"}', 'condiment', '{}', null, 1.0, 150, 7.0, 4.0, 2.0, 11.0, 0.6, 3.0, 5.8, 'vegan', false, false, '{moutarde}'),
    ('Sauce soja', '{soja}', 'condiment', '{}', null, 1.15, 60, 8.0, 5.0, 1.0, 0.1, 0.0, 0.8, 14.0, 'vegan', false, true, '{soja,gluten}'),
    ('Concentré de tomates', '{"concentré de tomate"}', 'condiment', '{}', null, 1.1, 80, 4.0, 14.0, 11.0, 0.5, 0.1, 4.0, 0.2, 'vegan', false, false, '{}'),
    ('Lait de coco', '{"crème de coco"}', 'extra', '{}', null, 1.0, 190, 2.0, 3.0, 2.0, 19.0, 17.0, 0.0, 0.03, 'vegan', false, false, '{}'),
    ('Tomates concassées', '{"tomates pelées","coulis de tomate","pulpe de tomate"}', 'legume', '{}', null, 1.05, 22, 1.2, 3.5, 3.0, 0.2, 0.0, 1.2, 0.3, 'vegan', false, false, '{}'),
    ('Bouillon cube', '{bouillon,"cube de bouillon"}', 'extra', '{}', 10, null, 250, 10.0, 20.0, 5.0, 15.0, 7.0, 0.0, 55.0, 'none', false, false, '{celeri}')
  ) as v(name, aliases, category, seasons, gpp, density, kcal, prot, carbs, sugars, fat, sat, fiber, salt, diet, lactose, gluten, allergens)
  on conflict do nothing;

  -- "Toujours là" dans les placards
  insert into pantry_items (household_id, ingredient_id, location, is_staple)
  select h, i.id, case i.category when 'huile' then 'huiles' else 'epices' end, true
  from ingredients i
  where i.household_id = h and i.name in ('Sel', 'Poivre', 'Huile d''olive');
$$;

-- Le trigger d'inscription remplit aussi le catalogue
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  insert into households default values returning id into h;
  insert into household_members (household_id, user_id, role) values (h, new.id, 'owner');
  perform seed_household_basics(h);
  return new;
end;
$$;

