-- =============================================================================
-- Produits du commerce scannés (Open Food Facts) + critères de notation du foyer
-- =============================================================================

alter table ingredients
  add column if not exists image_url text,
  add column if not exists nutriscore_grade text check (nutriscore_grade in ('a', 'b', 'c', 'd', 'e')),
  add column if not exists nova_group smallint check (nova_group between 1 and 4),
  add column if not exists additives text[] not null default '{}',      -- tags OFF : en:e322…
  add column if not exists labels text[] not null default '{}',         -- en:organic, en:no-gluten…
  add column if not exists analysis_tags text[] not null default '{}';  -- en:palm-oil, en:vegan…

-- Un code-barres n'existe qu'une fois par foyer : un nouveau scan ouvre la fiche existante
create unique index if not exists ingredients_household_barcode
  on ingredients (household_id, barcode) where barcode is not null;

-- Critères personnels de notation des produits (voir packages/core/src/productScore.ts)
alter table households
  add column if not exists score_criteria jsonb not null default '{}'::jsonb;
