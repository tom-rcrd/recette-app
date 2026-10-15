-- =============================================================================
-- Recette app — schéma initial
-- Toutes les données appartiennent à un "foyer" (household) partagé entre
-- plusieurs comptes. Les règles RLS limitent chaque utilisateur à son foyer.
-- =============================================================================

create extension if not exists pg_trgm;

-- -----------------------------------------------------------------------------
-- Foyer & membres
-- -----------------------------------------------------------------------------
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mon foyer',
  -- Prix moyen d'un repas acheté (resto / livraison), pour la stat "argent économisé"
  reference_meal_price numeric(6,2) not null default 12.00,
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  primary key (household_id, user_id)
);

create or replace function is_household_member(h uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_members where household_id = h and user_id = auth.uid()
  );
$$;

-- À l'inscription : création automatique d'un foyer
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  insert into households default values returning id into h;
  insert into household_members (household_id, user_id, role) values (h, new.id, 'owner');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- -----------------------------------------------------------------------------
-- Ingrédients : produits de base ET produits achetés (transformés, emballés)
-- -----------------------------------------------------------------------------
create table ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  aliases text[] not null default '{}',          -- "oignon jaune", "oignons"… pour le rapprochement à l'import
  kind text not null default 'base' check (kind in ('base', 'product')),
  category text not null default 'autre',        -- legume, fruit, feculent, proteine, laitier, epice, huile, condiment, extra, boisson, autre
  brand text,                                    -- produits du commerce
  barcode text,

  -- Saisonnalité : mois 1..12 (vide = toute l'année)
  season_months smallint[] not null default '{}',

  -- Conversion d'unités : poids d'une "pièce" (1 oignon ≈ 150 g) et densité (g/ml)
  grams_per_piece numeric(8,2),
  density numeric(6,3),

  -- Valeurs nutritionnelles pour 100 g
  kcal numeric(7,2),
  protein_g numeric(6,2),
  carbs_g numeric(6,2),
  sugars_g numeric(6,2),
  fat_g numeric(6,2),
  sat_fat_g numeric(6,2),
  fiber_g numeric(6,2),
  salt_g numeric(6,2),

  -- Régimes & allergènes
  is_vegan boolean not null default false,
  is_vegetarian boolean not null default false,
  contains_lactose boolean not null default false,
  contains_gluten boolean not null default false,
  allergens text[] not null default '{}',

  -- Prix indicatif (pour coût par portion et stats)
  price numeric(8,2),
  price_quantity numeric(10,2),                  -- ex. 2.50 € pour 1000 g
  price_unit text,

  pairs_with uuid[] not null default '{}',       -- suggestions d'accompagnement
  created_at timestamptz not null default now(),
  unique nulls not distinct (household_id, name, brand)  -- Postgres 15+
);
create index ingredients_name_trgm on ingredients using gin (name gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Techniques (découpes, gestes…) avec médias de démonstration
-- -----------------------------------------------------------------------------
create table techniques (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  description text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table technique_media (
  id uuid primary key default gen_random_uuid(),
  technique_id uuid not null references techniques(id) on delete cascade,
  kind text not null check (kind in ('image', 'video', 'link')),
  url text not null,                             -- Supabase Storage (bucket "media") ou lien externe
  caption text,
  position int not null default 0
);

-- -----------------------------------------------------------------------------
-- Recettes
-- -----------------------------------------------------------------------------
create table recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  description text,
  image_url text,

  meal_types text[] not null default '{}',       -- petit_dejeuner, dejeuner, diner, gouter, snack
  dish_type text,                                -- entree, plat, accompagnement, dessert, sauce, boisson, pain
  cuisine text,

  servings numeric(5,1) not null default 2,
  prep_min int not null default 0,
  cook_min int not null default 0,
  rest_min int not null default 0,
  total_min int generated always as (prep_min + cook_min + rest_min) stored,
  duration_class text generated always as (
    case when prep_min + cook_min + rest_min <= 30 then 'rapide'
         when prep_min + cook_min + rest_min <= 60 then 'moyen'
         else 'long' end
  ) stored,

  equipment text[] not null default '{}',        -- four, poele, casserole, mixeur, robot, cocotte, micro_ondes, airfryer…
  tags text[] not null default '{}',             -- batch_cooking, une_seule_poele, sans_cuisson, plaisir…
  rating smallint check (rating between 1 and 5),

  source_type text check (source_type in ('manual', 'url', 'instagram', 'tiktok', 'youtube', 'photo', 'text')),
  source_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_title_trgm on recipes using gin (title gin_trgm_ops);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete set null,
  raw_text text,                                 -- ligne d'origine ("2 gousses d'ail hachées")
  quantity numeric(10,2),
  unit text,                                     -- g, kg, ml, cl, l, piece, cas, cac, pincee…
  note text,                                     -- "haché", "à température ambiante"
  group_label text,                              -- "Pour la sauce"
  optional boolean not null default false,
  position int not null default 0
);

create table recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  position int not null,
  text text not null,
  timer_seconds int,                             -- minuterie intégrée au mode cuisine
  technique_id uuid references techniques(id) on delete set null
);

-- Notes, pistes d'amélioration, variantes, retours après cuisson
create table recipe_notes (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  kind text not null default 'note' check (kind in ('note', 'improvement', 'variant', 'cook_feedback')),
  body text not null,
  author_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Le frigo (et placards, épices, huiles…)
-- -----------------------------------------------------------------------------
create table pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  location text not null default 'frigo',        -- frigo, congelateur, placard, epices, huiles, extras
  quantity numeric(10,2),
  unit text,
  expires_on date,
  is_staple boolean not null default false,      -- "toujours là" (sel, poivre, huile…)
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Historique des repas : répétition, statistiques
-- -----------------------------------------------------------------------------
create table meal_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  recipe_id uuid references recipes(id) on delete set null,
  eaten_on date not null default current_date,
  meal_type text,
  servings numeric(5,1),
  cost numeric(8,2),                             -- coût estimé au moment de la cuisson
  saved_ingredient_ids uuid[] not null default '{}', -- ingrédients proches de la péremption utilisés
  created_at timestamptz not null default now()
);
create index meal_log_recent on meal_log (household_id, eaten_on desc);

-- Planning (sélection de plats pour les jours à venir)
create table meal_plan (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete cascade,
  planned_on date not null,
  meal_type text,
  servings numeric(5,1)
);

-- -----------------------------------------------------------------------------
-- Listes de courses
-- -----------------------------------------------------------------------------
create table shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null default 'Courses',
  created_at timestamptz not null default now()
);

create table shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references shopping_lists(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete set null,
  label text not null,
  quantity numeric(10,2),
  unit text,
  category text,
  checked boolean not null default false,
  from_recipe_ids uuid[] not null default '{}'
);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table households enable row level security;
alter table household_members enable row level security;
alter table ingredients enable row level security;
alter table techniques enable row level security;
alter table technique_media enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_steps enable row level security;
alter table recipe_notes enable row level security;
alter table pantry_items enable row level security;
alter table meal_log enable row level security;
alter table meal_plan enable row level security;
alter table shopping_lists enable row level security;
alter table shopping_list_items enable row level security;

create policy "member reads household" on households for select using (is_household_member(id));
create policy "member updates household" on households for update using (is_household_member(id));
create policy "member sees members" on household_members for select using (is_household_member(household_id));

-- Tables qui portent directement household_id
do $$
declare t text;
begin
  foreach t in array array['ingredients','techniques','recipes','pantry_items','meal_log','meal_plan','shopping_lists']
  loop
    execute format(
      'create policy "household access" on %I for all using (is_household_member(household_id)) with check (is_household_member(household_id))', t);
  end loop;
end $$;

-- Tables enfants : accès via le parent
create policy "household access" on recipe_ingredients for all
  using (exists (select 1 from recipes r where r.id = recipe_id and is_household_member(r.household_id)))
  with check (exists (select 1 from recipes r where r.id = recipe_id and is_household_member(r.household_id)));
create policy "household access" on recipe_steps for all
  using (exists (select 1 from recipes r where r.id = recipe_id and is_household_member(r.household_id)))
  with check (exists (select 1 from recipes r where r.id = recipe_id and is_household_member(r.household_id)));
create policy "household access" on recipe_notes for all
  using (exists (select 1 from recipes r where r.id = recipe_id and is_household_member(r.household_id)))
  with check (exists (select 1 from recipes r where r.id = recipe_id and is_household_member(r.household_id)));
create policy "household access" on technique_media for all
  using (exists (select 1 from techniques t where t.id = technique_id and is_household_member(t.household_id)))
  with check (exists (select 1 from techniques t where t.id = technique_id and is_household_member(t.household_id)));
create policy "household access" on shopping_list_items for all
  using (exists (select 1 from shopping_lists l where l.id = list_id and is_household_member(l.household_id)))
  with check (exists (select 1 from shopping_lists l where l.id = list_id and is_household_member(l.household_id)));

-- Stockage des photos de recettes et médias de techniques
insert into storage.buckets (id, name, public) values ('media', 'media', false)
  on conflict do nothing;
create policy "media: authenticated read" on storage.objects for select
  using (bucket_id = 'media' and auth.role() = 'authenticated');
create policy "media: authenticated write" on storage.objects for insert
  with check (bucket_id = 'media' and auth.role() = 'authenticated');
