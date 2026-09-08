-- Roles, propiedad editorial y funciones sociales de Pliegoluz.
-- Ejecutar una vez en Supabase > SQL Editor sobre una instalación existente.

begin;

do $$
begin
  if exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typnamespace = 'public'::regnamespace and t.typname = 'user_role' and e.enumlabel = 'editor'
  ) and not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typnamespace = 'public'::regnamespace and t.typname = 'user_role' and e.enumlabel = 'author'
  ) then
    alter type public.user_role rename value 'editor' to 'author';
  end if;
end
$$;

alter table public.firebase_profiles
  add column if not exists suspended_at timestamptz;

alter table public.books
  add column if not exists author_profile_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'books_author_profile_id_fkey'
      and conrelid = 'public.books'::regclass
  ) then
    alter table public.books
      add constraint books_author_profile_id_fkey
      foreign key (author_profile_id) references public.firebase_profiles(id) on delete set null;
  end if;
end
$$;

create table if not exists public.book_favorites (
  profile_id uuid not null references public.firebase_profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, book_id)
);

create table if not exists public.book_ratings (
  profile_id uuid not null references public.firebase_profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, book_id)
);

create index if not exists books_author_profile_idx
  on public.books(author_profile_id, updated_at desc);
create index if not exists book_favorites_profile_idx
  on public.book_favorites(profile_id, created_at desc);
create index if not exists book_ratings_book_idx
  on public.book_ratings(book_id);

alter table public.book_favorites enable row level security;
alter table public.book_ratings enable row level security;
revoke all on public.book_favorites, public.book_ratings from anon, authenticated;
grant all on public.book_favorites, public.book_ratings to service_role;

commit;

-- Los libros existentes quedan sin propietario y continúan administrables por un admin.
-- Para asignarlos a un autor:
-- update public.books set author_profile_id = (
--   select id from public.firebase_profiles where lower(email) = lower('autor@ejemplo.com')
-- ) where slug = 'slug-del-libro';
