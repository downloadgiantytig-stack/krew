-- ============================================================
-- KREW — Supabase Schema
-- Run this in your Supabase project → SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table if not exists profiles (
  id            uuid references auth.users primary key,
  username      text unique not null,
  full_name     text,
  bio           text,
  avatar_url    text,
  skills        text[]   default '{}',
  github_url    text,
  portfolio_url text,
  created_at    timestamptz default now()
);

-- ============================================================
-- SQUADS
-- ============================================================
create table if not exists squads (
  id           uuid   default gen_random_uuid() primary key,
  name         text   not null,
  description  text,
  creator_id   uuid   references profiles(id) on delete cascade,
  tags         text[] default '{}',
  status       text   default 'open',       -- open | in_progress | completed
  max_members  int    default 5,
  duration     text,                         -- e.g. "2 weeks"
  payout_model text,                         -- e.g. "Revenue Split"
  created_at   timestamptz default now()
);

-- ============================================================
-- SQUAD MEMBERS
-- ============================================================
create table if not exists squad_members (
  id        uuid  default gen_random_uuid() primary key,
  squad_id  uuid  references squads(id) on delete cascade,
  user_id   uuid  references profiles(id) on delete cascade,
  role      text  default 'member',          -- owner | member
  joined_at timestamptz default now(),
  unique(squad_id, user_id)
);

-- ============================================================
-- MARKETPLACE PRODUCTS
-- ============================================================
create table if not exists products (
  id                uuid    default gen_random_uuid() primary key,
  title             text    not null,
  description       text,
  price_usd         numeric(10,2),
  checkout_url      text    not null,
  checkout_type     text    default 'gumroad',   -- gumroad | external
  creator_id        uuid    references profiles(id) on delete cascade,
  category          text,                         -- script | automation | template | api | design | tool
  tags              text[]  default '{}',
  preview_image_url text,
  demo_url          text,
  downloads_count   int     default 0,
  created_at        timestamptz default now()
);

-- ============================================================
-- POSTS (squad updates + general)
-- ============================================================
create table if not exists posts (
  id         uuid   default gen_random_uuid() primary key,
  author_id  uuid   references profiles(id) on delete cascade,
  squad_id   uuid   references squads(id)   on delete cascade,  -- nullable
  content    text   not null,
  type       text   default 'update',        -- update | looking_for | showcase
  created_at timestamptz default now()
);

-- ============================================================
-- LIKES (polymorphic)
-- ============================================================
create table if not exists likes (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references profiles(id) on delete cascade,
  target_type text not null,                 -- product | squad | post
  target_id   uuid not null,
  created_at  timestamptz default now(),
  unique(user_id, target_type, target_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles      enable row level security;
alter table squads        enable row level security;
alter table squad_members enable row level security;
alter table products      enable row level security;
alter table posts         enable row level security;
alter table likes         enable row level security;

-- Drop all policies first so re-running this script never errors
drop policy if exists "Public profiles"          on profiles;
drop policy if exists "Own profile write"        on profiles;
drop policy if exists "Public squads"            on squads;
drop policy if exists "Creator manages squad"    on squads;
drop policy if exists "Public squad members"     on squad_members;
drop policy if exists "Own membership"           on squad_members;
drop policy if exists "Public products"          on products;
drop policy if exists "Creator manages product"  on products;
drop policy if exists "Public posts"             on posts;
drop policy if exists "Author post write"        on posts;
drop policy if exists "Public likes"             on likes;
drop policy if exists "Own likes"                on likes;

-- PROFILES: read all, write own
create policy "Public profiles"   on profiles for select using (true);
create policy "Own profile write" on profiles for all    using (auth.uid() = id);

-- SQUADS: read all, write own
create policy "Public squads"          on squads for select using (true);
create policy "Creator manages squad"  on squads for all    using (auth.uid() = creator_id);

-- SQUAD MEMBERS: read all, manage own
create policy "Public squad members" on squad_members for select using (true);
create policy "Own membership"       on squad_members for all    using (auth.uid() = user_id);

-- PRODUCTS: read all, write own
create policy "Public products"          on products for select using (true);
create policy "Creator manages product"  on products for all    using (auth.uid() = creator_id);

-- POSTS: read all, write own
create policy "Public posts"      on posts for select using (true);
create policy "Author post write" on posts for all    using (auth.uid() = author_id);

-- LIKES: read all, write own
create policy "Public likes" on likes for select using (true);
create policy "Own likes"    on likes for all    using (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: auto-create profile on new user signup
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    lower(coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4)
    )),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (username) do update set
    full_name  = excluded.full_name,
    avatar_url = excluded.avatar_url;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- HELPER: increment downloads
-- ============================================================
create or replace function increment_downloads(product_id uuid)
returns void language plpgsql as $$
begin
  update products set downloads_count = downloads_count + 1 where id = product_id;
end;
$$;
