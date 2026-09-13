-- Modelo inicial para Pliegoluz con Firebase Authentication y datos en Supabase.
-- Ejecutar una vez en el SQL Editor de Supabase para proyectos nuevos.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('reader', 'author', 'admin');
create type public.publication_status as enum ('draft', 'published', 'archived');

-- Firebase conserva las credenciales. Supabase conserva los datos del usuario
-- bajo un UUID interno y utiliza firebase_uid como vínculo único.
create table public.firebase_profiles (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
  email text,
  display_name text,
  photo_url text,
  email_verified boolean not null default false,
  provider text,
  role public.user_role not null default 'reader',
  suspended_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid references public.firebase_profiles(id) on delete set null,
  slug text not null unique,
  title text not null,
  subtitle text,
  author_name text not null,
  description text not null default '',
  genres text[] not null default array[]::text[],
  cover_path text,
  status public.publication_status not null default 'draft',
  work_status text not null default 'completed'
    check (work_status in ('completed', 'publishing', 'paused', 'cancelled')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  number integer not null check (number > 0),
  title text not null,
  content_markdown text not null default '',
  status public.publication_status not null default 'draft',
  reading_minutes integer not null default 1 check (reading_minutes > 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chapters_published_content_check
    check (status <> 'published' or char_length(trim(content_markdown)) >= 20),
  unique (book_id, number)
);

create table public.reading_progress (
  profile_id uuid not null references public.firebase_profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  progress_percent numeric(5, 2) not null default 0 check (progress_percent between 0 and 100),
  paragraph_index integer not null default 0 check (paragraph_index >= 0),
  paragraph_offset numeric(6, 5) not null default 0 check (paragraph_offset between 0 and 1),
  updated_at timestamptz not null default now(),
  primary key (profile_id, book_id)
);

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.firebase_profiles(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  paragraph_key text,
  created_at timestamptz not null default now(),
  unique (profile_id, chapter_id, paragraph_key)
);

create table public.book_favorites (
  profile_id uuid not null references public.firebase_profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, book_id)
);

create table public.book_ratings (
  profile_id uuid not null references public.firebase_profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, book_id)
);

create index chapters_book_number_idx on public.chapters(book_id, number);
create index bookmarks_profile_idx on public.bookmarks(profile_id, created_at desc);
create index books_status_idx on public.books(status, updated_at desc);
create index firebase_profiles_email_idx on public.firebase_profiles(lower(email));

alter table public.firebase_profiles enable row level security;
alter table public.books enable row level security;
alter table public.chapters enable row level security;
alter table public.reading_progress enable row level security;
alter table public.bookmarks enable row level security;
alter table public.book_favorites enable row level security;
alter table public.book_ratings enable row level security;

grant select on public.books, public.chapters to anon, authenticated;
revoke insert, update, delete on public.books, public.chapters from anon, authenticated;
revoke all on public.firebase_profiles, public.reading_progress, public.bookmarks from anon, authenticated;
grant all on public.firebase_profiles, public.reading_progress, public.bookmarks to service_role;
grant all on public.book_favorites, public.book_ratings to service_role;

create policy "Published books are public"
on public.books for select
using (status = 'published');

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

-- Las escrituras privadas se realizan únicamente desde el servidor Next.js
-- después de validar la cookie de Firebase y el rol almacenado en Supabase.
