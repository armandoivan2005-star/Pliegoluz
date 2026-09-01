-- Datos iniciales de Pliegoluz.
-- Ejecutar después de schema.sql desde el SQL Editor de Supabase.

begin;

insert into public.books (
  slug,
  title,
  subtitle,
  author_name,
  description,
  genres,
  status,
  published_at
)
values (
  'casa-reykov',
  'Casa Reykov',
  'Capítulos I–XLI · Edición canónica',
  'Autor por confirmar',
  'La historia de Santiago Mijáilovich Volkov Reyes, reunida en una edición canónica concebida para una lectura continua, íntima y sin distracciones.',
  array['Novela', 'Drama', 'Edición canónica'],
  'published',
  now()
)
on conflict (slug) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  author_name = excluded.author_name,
  description = excluded.description,
  genres = excluded.genres,
  status = excluded.status,
  published_at = excluded.published_at,
  updated_at = now();

insert into public.chapters (
  book_id,
  number,
  title,
  content_markdown,
  status,
  reading_minutes,
  published_at
)
select
  book.id,
  chapter_number,
  'Capítulo ' || trim(to_char(chapter_number, 'RN')),
  '',
  'published',
  11 + (chapter_number % 7),
  now()
from public.books as book
cross join generate_series(1, 41) as chapter_number
where book.slug = 'casa-reykov'
on conflict (book_id, number) do update set
  title = excluded.title,
  status = excluded.status,
  reading_minutes = excluded.reading_minutes,
  updated_at = now();

commit;

select
  books.title,
  count(chapters.id) as chapter_count
from public.books
left join public.chapters on chapters.book_id = books.id
where books.slug = 'casa-reykov'
group by books.id, books.title;
