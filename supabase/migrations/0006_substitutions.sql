-- =============================================================================
-- Remplacements d'ingrédients (ex. lait → boisson végétale) appliqués partout
-- dans l'app, sans modifier les recettes d'origine. + laits végétaux au catalogue.
-- =============================================================================

create table if not exists substitutions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  from_ingredient_id uuid not null references ingredients(id) on delete cascade,
  to_ingredient_id uuid not null references ingredients(id) on delete cascade,
  ratio numeric(6,3) not null default 1,       -- quantité remplaçante = quantité d'origine × ratio
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (household_id, from_ingredient_id),
  check (from_ingredient_id <> to_ingredient_id)
);

alter table substitutions enable row level security;
create policy "household access" on substitutions for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));

-- Laits végétaux (valeurs indicatives pour 100 ml, versions non sucrées du commerce)
create or replace function seed_plant_milks(h uuid)
returns void language sql security definer set search_path = public as $$
  insert into ingredients (
    household_id, name, aliases, kind, category, density,
    kcal, protein_g, carbs_g, sugars_g, fat_g, sat_fat_g, fiber_g, salt_g,
    is_vegan, is_vegetarian, contains_lactose, contains_gluten, allergens
  ) values
    (h, 'Boisson soja', '{"lait de soja","boisson au soja"}', 'product', 'laitier', 1.03,
     35, 3.3, 0.5, 0.3, 1.8, 0.3, 0.6, 0.1, true, true, false, false, '{soja}'),
    (h, 'Boisson avoine', '{"lait d''avoine","boisson à l''avoine"}', 'product', 'laitier', 1.03,
     45, 1.0, 6.7, 3.3, 1.5, 0.2, 0.8, 0.1, true, true, false, true, '{gluten}'),
    (h, 'Boisson amande', '{"lait d''amande","boisson à l''amande"}', 'product', 'laitier', 1.02,
     15, 0.5, 0.3, 0.1, 1.1, 0.1, 0.3, 0.13, true, true, false, false, '{fruits_a_coque}')
  on conflict do nothing;
$$;
revoke execute on function seed_plant_milks(uuid) from public, anon, authenticated;

-- Foyers existants
select seed_plant_milks(id) from households;

-- Nouveaux comptes : catalogue de départ + laits végétaux
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  insert into households default values returning id into h;
  insert into household_members (household_id, user_id, role) values (h, new.id, 'owner');
  perform seed_household_basics(h);
  perform seed_plant_milks(h);
  return new;
end;
$$;
