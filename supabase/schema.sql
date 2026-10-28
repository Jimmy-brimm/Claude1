-- Polyweb online play.
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
-- It is safe to run again; it replaces the functions and keeps existing games.
--
-- How it fits together:
--   * games holds each online game: the full game state plus who sits where.
--   * seat_keys holds a hash of the secret each device generated when it took a seat.
--   * Clients never touch the tables directly. Row level security is on with no policies,
--     so the only way in is through the functions below, which check seats and versions.

create table if not exists public.games (
  id text primary key check (id ~ '^[A-Z0-9]{6}$'),
  version integer not null default 1,
  state jsonb not null,
  seats jsonb not null,             -- [{ "tribe": 0, "ai": false, "name": "Sam", "taken": true }, ...]
  cur integer not null default 0,   -- whose turn it is, as an index into seats
  turn integer not null default 1,
  status text not null default 'open' check (status in ('open', 'playing', 'over')),
  winner integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seat_keys (
  game_id text not null references public.games (id) on delete cascade,
  seat integer not null,
  key_hash text not null,
  primary key (game_id, seat)
);

alter table public.games enable row level security;
alter table public.seat_keys enable row level security;
revoke all on public.games, public.seat_keys from anon, authenticated;

-- A game is 'open' while a human seat is still free, 'playing' once every human seat is taken.
create or replace function public.polyweb_status(p_seats jsonb) returns text
language sql immutable set search_path = public as $$
  select case when exists (
    select 1 from jsonb_array_elements(p_seats) v
    where not coalesce((v ->> 'ai')::boolean, false) and not coalesce((v ->> 'taken')::boolean, false)
  ) then 'open' else 'playing' end
$$;

create or replace function public.polyweb_hash(p_key text) returns text
language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(p_key, 'UTF8')), 'hex')
$$;

-- Start a game. The creator takes seat 0.
create or replace function public.create_game(p_id text, p_state jsonb, p_seats jsonb, p_key text, p_name text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  s jsonb;
begin
  if coalesce(length(p_key), 0) < 16 then raise exception 'bad key'; end if;
  if jsonb_typeof(p_seats) <> 'array' or jsonb_array_length(p_seats) not between 2 and 8 then raise exception 'bad seats'; end if;
  if coalesce((p_seats -> 0 ->> 'ai')::boolean, false) then raise exception 'bad seats'; end if;
  if pg_column_size(p_state) > 2000000 then raise exception 'state too large'; end if;
  s := jsonb_set(p_seats, '{0}', (p_seats -> 0) || jsonb_build_object('name', left(coalesce(p_name, ''), 24), 'taken', true));
  insert into games (id, state, seats, cur, turn, status) values (p_id, p_state, s, 0, 1, polyweb_status(s));
  insert into seat_keys values (p_id, 0, polyweb_hash(p_key));
  return 1;
end $$;

-- Take a free human seat.
create or replace function public.join_game(p_id text, p_seat integer, p_key text, p_name text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  g games;
  h text := polyweb_hash(p_key);
  s jsonb;
  ns jsonb;
begin
  if coalesce(length(p_key), 0) < 16 then raise exception 'bad key'; end if;
  select * into g from games where id = p_id for update;
  if not found then raise exception 'no such game'; end if;
  if g.status = 'over' then raise exception 'game over'; end if;
  if exists (select 1 from seat_keys where game_id = p_id and key_hash = h) then raise exception 'already joined'; end if;
  s := g.seats -> p_seat;
  if s is null or coalesce((s ->> 'ai')::boolean, false) or coalesce((s ->> 'taken')::boolean, false) then
    raise exception 'seat not available';
  end if;
  insert into seat_keys values (p_id, p_seat, h);
  ns := jsonb_set(g.seats, array[p_seat::text], s || jsonb_build_object('name', left(coalesce(p_name, ''), 24), 'taken', true));
  -- the version tracks the game state only, so taking a seat never makes the current player's turn stale
  update games set seats = ns, status = polyweb_status(ns), updated_at = now()
  where id = p_id returning version into g.version;
  return g.version;
end $$;

-- Save the current player's turn. Only the device holding the current seat's key may submit,
-- and only on top of the latest version, so two devices can never overwrite each other.
create or replace function public.submit_turn(p_id text, p_version integer, p_key text, p_state jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  g games;
  my_seat integer;
  next_cur integer := (p_state ->> 'cur')::integer;
  nv integer;
begin
  select * into g from games where id = p_id for update;
  if not found then raise exception 'no such game'; end if;
  if g.status = 'over' then raise exception 'game over'; end if;
  if g.version <> p_version then raise exception 'version conflict'; end if;
  select k.seat into my_seat from seat_keys k where k.game_id = p_id and k.key_hash = polyweb_hash(p_key);
  if my_seat is null or my_seat <> g.cur then raise exception 'not your turn'; end if;
  if next_cur is null or next_cur < 0 or next_cur >= jsonb_array_length(g.seats) then raise exception 'bad state'; end if;
  if pg_column_size(p_state) > 2000000 then raise exception 'state too large'; end if;
  update games set
    state = p_state,
    cur = next_cur,
    turn = coalesce((p_state ->> 'turn')::integer, turn),
    status = case when jsonb_typeof(p_state -> 'over') = 'object' then 'over' else status end,
    winner = case when jsonb_typeof(p_state -> 'over') = 'object' then (p_state -> 'over' ->> 'winner')::integer end,
    version = version + 1,
    updated_at = now()
  where id = p_id returning version into nv;
  return nv;
end $$;

-- Read one game in full.
create or replace function public.get_game(p_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'version', version, 'state', state, 'seats', seats, 'cur', cur, 'turn', turn,
                            'status', status, 'winner', winner, 'updated_at', updated_at)
  from games where id = p_id
$$;

-- A light summary of several games (no state), for the lobby list and for checking whose turn it is.
create or replace function public.game_summaries(p_ids text[])
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'version', version, 'seats', seats, 'cur', cur, 'turn', turn,
                                               'status', status, 'winner', winner, 'updated_at', updated_at)), '[]'::jsonb)
  from games where id = any (p_ids[1:50])
$$;

revoke all on function public.polyweb_status(jsonb), public.polyweb_hash(text) from public, anon, authenticated;
grant execute on function public.create_game(text, jsonb, jsonb, text, text), public.join_game(text, integer, text, text),
  public.submit_turn(text, integer, text, jsonb), public.get_game(text), public.game_summaries(text[]) to anon, authenticated;
