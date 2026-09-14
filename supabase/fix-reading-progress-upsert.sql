-- Corrige instalaciones migradas en las que PostgREST no puede resolver
-- ON CONFLICT (profile_id, book_id) contra un índice único parcial.
-- Es idempotente y conserva las filas antiguas asociadas mediante user_id.

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reading_progress'
      and column_name = 'profile_id'
  ) then
    raise exception 'Falta reading_progress.profile_id. Ejecuta primero supabase/firebase-auth.sql.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reading_progress'::regclass
      and contype in ('p', 'u')
      and conkey = array[
        (select attnum from pg_attribute where attrelid = 'public.reading_progress'::regclass and attname = 'profile_id'),
        (select attnum from pg_attribute where attrelid = 'public.reading_progress'::regclass and attname = 'book_id')
      ]::smallint[]
  ) then
    alter table public.reading_progress
      add constraint reading_progress_profile_book_key unique (profile_id, book_id);
  end if;
end
$$;

commit;
