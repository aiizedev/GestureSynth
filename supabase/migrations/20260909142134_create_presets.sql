-- Presets de usuario sincronizados con la cuenta (login Google).
-- Cada usuario ve y edita solo los suyos (RLS). El cliente los sube al guardar
-- y hace merge last-write-wins al iniciar sesion. `updated_at` lo pone siempre
-- el servidor (default + trigger).
--
-- Aplicada al proyecto rhnroqqeqowhnurfxwfg via MCP (migracion 20260909142134).

create table public.presets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (name <> ''),
  preset     jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.presets enable row level security;

create policy "presets_select_own" on public.presets
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "presets_insert_own" on public.presets
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "presets_update_own" on public.presets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "presets_delete_own" on public.presets
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.presets to authenticated;

-- updated_at siempre lo pone el servidor (tambien en la rama DO UPDATE del upsert).
create or replace function public.presets_touch_updated_at()
  returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger presets_touch_updated_at
  before update on public.presets
  for each row execute function public.presets_touch_updated_at();

-- Realtime: cambios de fila para sincronizar entre dispositivos (RLS filtra por usuario).
alter publication supabase_realtime add table public.presets;
