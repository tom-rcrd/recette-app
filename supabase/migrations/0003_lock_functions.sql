-- Les fonctions "security definer" sont appelables via l'API (RPC) par défaut.
-- seed_household_basics permettrait à n'importe quel compte d'écrire dans le foyer
-- d'un autre : on la réserve au trigger d'inscription.
revoke execute on function seed_household_basics(uuid) from public, anon, authenticated;
revoke execute on function handle_new_user() from public, anon, authenticated;
