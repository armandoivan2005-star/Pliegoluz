-- Migra una instalación existente desde Supabase Auth hacia Firebase Auth.
-- Es idempotente: puede ejecutarse nuevamente sin duplicar perfiles.

begin;

create table if not exists public.firebase_profiles (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
  email text,
  display_name text,
  photo_url text,
  email_verified boolean not null default false,
  provider text,
  role public.user_role not null default 'reader',
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists firebase_profiles_email_idx
on public.firebase_profiles(lower(email));

alter table public.firebase_profiles enable row level security;

-- Conserva cualquier progreso antiguo de Supabase Auth y prepara las mismas
-- tablas para perfiles Firebase. Las filas nuevas usan profile_id (UUID).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reading_progress' and column_name = 'user_id'
  ) then
    alter table public.reading_progress
      add column if not exists profile_id uuid references public.firebase_profiles(id) on delete cascade;
    alter table public.reading_progress drop constraint if exists reading_progress_pkey;
    alter table public.reading_progress alter column user_id drop not null;
    alter table public.reading_progress drop constraint if exists reading_progress_identity_check;
    alter table public.reading_progress
      add constraint reading_progress_identity_check
      check (num_nonnulls(user_id, profile_id) = 1) not valid;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookmarks' and column_name = 'user_id'
  ) then
    alter table public.bookmarks
      add column if not exists profile_id uuid references public.firebase_profiles(id) on delete cascade;
    alter table public.bookmarks alter column user_id drop not null;
    alter table public.bookmarks drop constraint if exists bookmarks_identity_check;
    alter table public.bookmarks
      add constraint bookmarks_identity_check
      check (num_nonnulls(user_id, profile_id) = 1) not valid;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reading_progress' and column_name = 'user_id'
  ) then
    execute 'create unique index if not exists reading_progress_legacy_user_book_uidx
      on public.reading_progress(user_id, book_id) where user_id is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reading_progress' and column_name = 'profile_id'
  ) then
    execute 'create unique index if not exists reading_progress_firebase_profile_book_uidx
      on public.reading_progress(profile_id, book_id) where profile_id is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookmarks' and column_name = 'profile_id'
  ) then
    execute 'create unique index if not exists bookmarks_firebase_profile_chapter_paragraph_uidx
      on public.bookmarks(profile_id, chapter_id, paragraph_key) where profile_id is not null';
  end if;
end
$$;

revoke all on public.firebase_profiles from anon, authenticated;
grant all on public.firebase_profiles to service_role;
grant all on public.reading_progress, public.bookmarks to service_role;
grant select on public.books, public.chapters to anon, authenticated;
revoke insert, update, delete on public.books, public.chapters from authenticated;

drop policy if exists "Published books are public" on public.books;
create policy "Published books are public"
on public.books for select
using (status = 'published');

drop policy if exists "Published chapters are public" on public.chapters;
create policy "Published chapters are public"
on public.chapters for select
using (
  status = 'published'
  and exists (
    select 1 from public.books
    where books.id = chapters.book_id
      and books.status = 'published'
  )
);

drop policy if exists "Editors can create books" on public.books;
drop policy if exists "Editors can update books" on public.books;
drop policy if exists "Editors can delete books" on public.books;
drop policy if exists "Editors can create chapters" on public.chapters;
drop policy if exists "Editors can update chapters" on public.chapters;
drop policy if exists "Editors can delete chapters" on public.chapters;

commit;

-- PASO POSTERIOR: entra una vez con Firebase para crear tu perfil y ejecuta:
-- update public.firebase_profiles
-- set role = 'admin', updated_at = now()
-- where lower(email) = lower('tu-correo@ejemplo.com');
