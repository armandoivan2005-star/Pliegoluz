-- Guarda la posición exacta de lectura dentro del capítulo.
-- Es idempotente y puede ejecutarse más de una vez.

begin;

alter table public.reading_progress
  add column if not exists paragraph_index integer not null default 0,
  add column if not exists paragraph_offset numeric(6, 5) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reading_progress_paragraph_index_check'
      and conrelid = 'public.reading_progress'::regclass
  ) then
    alter table public.reading_progress
      add constraint reading_progress_paragraph_index_check
      check (paragraph_index >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'reading_progress_paragraph_offset_check'
      and conrelid = 'public.reading_progress'::regclass
  ) then
    alter table public.reading_progress
      add constraint reading_progress_paragraph_offset_check
      check (paragraph_offset between 0 and 1);
  end if;
end
$$;

commit;
