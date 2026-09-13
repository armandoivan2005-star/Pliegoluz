-- Impide publicar capítulos vacíos o con contenido insuficiente.
-- Es idempotente y corrige filas antiguas antes de activar la restricción.

begin;

update public.chapters
set status = 'draft', published_at = null, updated_at = now()
where status = 'published'
  and char_length(trim(content_markdown)) < 20;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chapters_published_content_check'
      and conrelid = 'public.chapters'::regclass
  ) then
    alter table public.chapters
      add constraint chapters_published_content_check
      check (status <> 'published' or char_length(trim(content_markdown)) >= 20);
  end if;
end
$$;

commit;
