-- Habilita el panel editorial y los perfiles vinculados a Firebase Auth.
-- Ejecutar en Supabase > SQL Editor.

begin;

alter table public.books
add column if not exists genres text[] not null default array[]::text[];

alter table public.books
add column if not exists work_status text not null default 'completed';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'books_work_status_check'
      and conrelid = 'public.books'::regclass
  ) then
    alter table public.books
      add constraint books_work_status_check
      check (work_status in ('completed', 'publishing', 'paused', 'cancelled'));
  end if;
end
$$;

update public.books
set genres = array['Novela', 'Drama', 'Edición canónica']
where slug = 'casa-reykov'
  and cardinality(genres) = 0;

create index if not exists books_status_idx
on public.books(status, updated_at desc);

-- Firebase conserva las credenciales. Supabase conserva el perfil de la app.
-- `id` es el UUID interno que utilizarán los datos relacionados del usuario;
-- `firebase_uid` es el vínculo único con Firebase Authentication.
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

-- Los perfiles y las mutaciones editoriales solo pasan por el servidor Next.js,
-- después de verificar la cookie de Firebase. La service role nunca llega al navegador.
revoke all on public.firebase_profiles from anon, authenticated;
grant all on public.firebase_profiles to service_role;
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

-- Después de registrarte o entrar con Google, asigna el rol con tu correo:
-- update public.firebase_profiles
-- set role = 'admin', updated_at = now()
-- where lower(email) = lower('tu-correo@ejemplo.com');
