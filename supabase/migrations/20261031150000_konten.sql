-- Eltern-Konten, Kinder und Kindergeräte. Nur zusätzliche Tabellen: family_data (Lernstände) bleibt, wie sie ist.
-- Zugriff nur über den Server (api/*) mit dem geheimen Schlüssel. RLS ist an und hat keine Policies,
-- damit niemand mit dem öffentlichen Schlüssel etwas lesen oder schreiben kann.

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- true: die bisherige Familie mit Luisa; ihr Lernstand liegt weiter in family_data unter „familie“
  legacy boolean not null default false,
  pin text check (pin ~ '^\d{4}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.parents (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  family_id uuid references public.families (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.children (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null,
  grade int not null check (grade between 1 and 13),
  school text not null,
  helps jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
create index if not exists children_family on public.children (family_id);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  child_id text not null references public.children (id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  last_seen timestamptz,
  revoked_at timestamptz
);
create index if not exists devices_child on public.devices (child_id);

-- Einmal-Codes zum Einrichten eines Kindergeräts, 15 Minuten gültig, nur als Hash gespeichert
create table if not exists public.device_codes (
  code_hash text primary key,
  child_id text not null references public.children (id) on delete cascade,
  expires_at timestamptz not null
);

alter table public.families enable row level security;
alter table public.parents enable row level security;
alter table public.children enable row level security;
alter table public.devices enable row level security;
alter table public.device_codes enable row level security;
