-- SmartList : liste de courses partagée par code de foyer.
-- À coller une fois dans l'éditeur SQL de Supabase (SQL Editor → New query → Run).
--
-- La table n'a aucune règle d'accès direct : la clé publique ne peut ni la lire
-- ni l'écrire. Tout passe par sl_sync(), qui exige le code du foyer et ne
-- renvoie que les lignes de ce foyer.

create table if not exists public.sl_items (
  household  text        not null,
  id         text        not null,
  name       text        not null check (char_length(name) between 1 and 80),
  done       boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (household, id)
);

alter table public.sl_items enable row level security;
revoke all on public.sl_items from anon, authenticated;

-- Nom et couleur de chaque foyer, modifiables par tous ses membres.
create table if not exists public.sl_households (
  code       text        primary key,
  name       text        check (char_length(name) between 1 and 40),
  color      text        check (color ~ '^[a-z]{1,20}$'),
  updated_at timestamptz not null default now()
);
-- Mise à niveau d'une base créée avec une version précédente de ce script.
alter table public.sl_households add column if not exists color text check (color ~ '^[a-z]{1,20}$');
alter table public.sl_households alter column name drop not null;

alter table public.sl_households enable row level security;
revoke all on public.sl_households from anon, authenticated;

-- Applique les modifications d'un téléphone (et un éventuel nouveau nom ou
-- une nouvelle couleur), puis renvoie le nom, la couleur et la liste du foyer.
drop function if exists public.sl_sync(text, jsonb, jsonb);
drop function if exists public.sl_sync(text, jsonb, jsonb, text);
create or replace function public.sl_sync(
  p_code    text,
  p_upserts jsonb default '[]'::jsonb,
  p_deletes jsonb default '[]'::jsonb,
  p_name    text  default null,
  p_color   text  default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if p_code is null or p_code !~ '^[a-z0-9-]{8,64}$' then
    raise exception 'code de foyer invalide';
  end if;
  if jsonb_array_length(p_upserts) > 500 or jsonb_array_length(p_deletes) > 500 then
    raise exception 'trop de modifications en une fois';
  end if;

  if coalesce(btrim(p_name), '') <> '' or coalesce(p_color, '') ~ '^[a-z]{1,20}$' then
    insert into sl_households (code, name, color)
    values (p_code,
            nullif(left(btrim(coalesce(p_name, '')), 40), ''),
            case when p_color ~ '^[a-z]{1,20}$' then p_color end)
    on conflict (code) do update
       set name  = coalesce(excluded.name,  sl_households.name),
           color = coalesce(excluded.color, sl_households.color),
           updated_at = now();
  end if;

  delete from sl_items
   where household = p_code
     and id in (select jsonb_array_elements_text(p_deletes));

  insert into sl_items (household, id, name, done, updated_at)
  select distinct on (x->>'id')
         p_code,
         x->>'id',
         left(btrim(x->>'name'), 80),
         coalesce((x->>'done')::boolean, false),
         now()
    from jsonb_array_elements(p_upserts) as x
   where coalesce(btrim(x->>'name'), '') <> ''
     and char_length(coalesce(x->>'id', '')) between 1 and 64
  on conflict (household, id) do update
     set name = excluded.name, done = excluded.done, updated_at = now();

  if (select count(*) from sl_items where household = p_code) > 1000 then
    raise exception 'liste trop longue';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'done', done)), '[]'::jsonb)
    into result
    from sl_items
   where household = p_code;
  return jsonb_build_object(
    'name',  (select name  from sl_households where code = p_code),
    'color', (select color from sl_households where code = p_code),
    'items', result
  );
end;
$$;

revoke all on function public.sl_sync(text, jsonb, jsonb, text, text) from public;
grant execute on function public.sl_sync(text, jsonb, jsonb, text, text) to anon, authenticated;
