-- Test Drive Exprés: eventos y registros de clientes con la firma del deslinde.
--
-- Es ADITIVO: crea objetos nuevos (td_*) y no toca ninguna tabla, función ni política que ya exista.
-- Se puede correr más de una vez sin problema.
--
-- Quién puede qué:
--   * Crear y cerrar eventos: gerencia y admin (el "jefe de ventas" es gerencia en la base).
--   * Cargar clientes: vendedor, gerencia y admin, solo con un evento abierto y a su nombre.
--   * Ver registros: cada uno ve los que cargó; gerencia y admin ven todos.
--   * Los registros no se pueden modificar ni borrar desde la app (la firma queda como constancia).

-- ---------- Funciones auxiliares (leen el perfil de quien consulta) ----------
create or replace function public.td_mi_rol() returns text
language sql stable security definer set search_path = public
as $$ select p.rol::text from public.perfiles p where p.id = auth.uid() and p.activo is true $$;

create or replace function public.td_mi_conc() returns uuid
language sql stable security definer set search_path = public
as $$ select p.concesionario_id from public.perfiles p where p.id = auth.uid() and p.activo is true $$;

revoke all on function public.td_mi_rol() from public, anon;
revoke all on function public.td_mi_conc() from public, anon;
grant execute on function public.td_mi_rol() to authenticated;
grant execute on function public.td_mi_conc() to authenticated;

-- ---------- Eventos ----------
create table if not exists public.td_eventos (
  id               uuid primary key default gen_random_uuid(),
  concesionario_id uuid not null default public.td_mi_conc(),
  nombre           text not null check (char_length(btrim(nombre)) between 2 and 120),
  lugar            text check (lugar is null or char_length(lugar) <= 160),
  fecha            date not null default current_date,
  estado           text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  creado_por       uuid not null default auth.uid(),
  created_at       timestamptz not null default now(),
  cerrado_at       timestamptz
);

-- ---------- Registros (un cliente que firmó el deslinde) ----------
create table if not exists public.td_registros (
  id                  uuid primary key default gen_random_uuid(),
  concesionario_id    uuid not null,
  evento_id           uuid not null references public.td_eventos(id) on delete restrict,
  numero              integer not null,
  nombre              text not null check (char_length(btrim(nombre)) between 1 and 80),
  apellido            text not null check (char_length(btrim(apellido)) between 1 and 80),
  dni                 text not null check (dni ~ '^[0-9]{6,9}$'),
  telefono            text not null check (char_length(btrim(telefono)) between 6 and 30),
  email               text check (email is null or char_length(email) <= 160),
  vendedor_id         uuid not null,
  vendedor_nombre     text not null,
  licencia_verificada boolean not null check (licencia_verificada),
  firma_png           text not null check (firma_png like 'data:image/png;base64,%' and char_length(firma_png) < 600000),
  texto_version       text not null default 'v1',
  created_at          timestamptz not null default now(),
  unique (evento_id, numero)
);
create index if not exists td_registros_evento_idx on public.td_registros (evento_id, created_at);

-- ---------- Antes de guardar un registro: el servidor pone quién lo carga y el número ----------
create or replace function public.td_registros_antes_insert() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_ev     public.td_eventos;
  v_nombre text;
begin
  select * into v_ev from public.td_eventos where id = new.evento_id;
  if not found or v_ev.concesionario_id is distinct from public.td_mi_conc() then
    raise exception 'No se encontró el evento.' using errcode = 'P0002';
  end if;
  if v_ev.estado <> 'abierto' then
    raise exception 'El evento está cerrado: ya no se pueden cargar más clientes.' using errcode = 'P0001';
  end if;
  select p.nombre into v_nombre from public.perfiles p where p.id = auth.uid();
  new.concesionario_id := v_ev.concesionario_id;
  new.vendedor_id      := auth.uid();
  new.vendedor_nombre  := coalesce(nullif(btrim(v_nombre), ''), 'Sin nombre');
  perform pg_advisory_xact_lock(hashtext(new.evento_id::text));
  select coalesce(max(r.numero), 0) + 1 into new.numero from public.td_registros r where r.evento_id = new.evento_id;
  return new;
end
$$;

drop trigger if exists td_registros_bi on public.td_registros;
create trigger td_registros_bi before insert on public.td_registros
  for each row execute function public.td_registros_antes_insert();

-- ---------- Seguridad por fila ----------
alter table public.td_eventos   enable row level security;
alter table public.td_registros enable row level security;

drop policy if exists td_eventos_ver     on public.td_eventos;
drop policy if exists td_eventos_crear   on public.td_eventos;
drop policy if exists td_eventos_editar  on public.td_eventos;
drop policy if exists td_registros_ver   on public.td_registros;
drop policy if exists td_registros_crear on public.td_registros;

create policy td_eventos_ver on public.td_eventos for select to authenticated
  using (concesionario_id = public.td_mi_conc() and public.td_mi_rol() in ('vendedor', 'gerencia', 'admin'));

create policy td_eventos_crear on public.td_eventos for insert to authenticated
  with check (concesionario_id = public.td_mi_conc() and creado_por = auth.uid() and public.td_mi_rol() in ('gerencia', 'admin'));

create policy td_eventos_editar on public.td_eventos for update to authenticated
  using (concesionario_id = public.td_mi_conc() and public.td_mi_rol() in ('gerencia', 'admin'))
  with check (concesionario_id = public.td_mi_conc() and public.td_mi_rol() in ('gerencia', 'admin'));

create policy td_registros_ver on public.td_registros for select to authenticated
  using (concesionario_id = public.td_mi_conc() and (vendedor_id = auth.uid() or public.td_mi_rol() in ('gerencia', 'admin')));

create policy td_registros_crear on public.td_registros for insert to authenticated
  with check (concesionario_id = public.td_mi_conc() and vendedor_id = auth.uid() and public.td_mi_rol() in ('vendedor', 'gerencia', 'admin'));

-- ---------- Permisos de tabla (sin acceso anónimo) ----------
revoke all on public.td_eventos, public.td_registros from anon;
revoke all on public.td_eventos, public.td_registros from authenticated;
grant select, insert, update on public.td_eventos to authenticated;
grant select, insert on public.td_registros to authenticated;
