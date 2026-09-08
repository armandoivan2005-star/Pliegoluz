-- Añade el estado público de la obra sin cambiar su visibilidad editorial.
-- Es seguro ejecutar esta migración más de una vez.

begin;

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

commit;
