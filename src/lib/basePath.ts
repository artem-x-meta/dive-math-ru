/**
 * Базовый путь сайта.
 *
 * На GitHub Pages книга живёт по подпути (`/dive-math-ru/`), локально — от корня.
 * В исходниках ссылки всегда пишутся от корня; префикс подставляется здесь,
 * чтобы content-файлы не зависели от места публикации.
 *
 * Ссылки внутри разметки обрабатывает scripts/remark-base-links.mjs,
 * а эта функция нужна компонентам, которые собирают href сами.
 */
export function withBase(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base.replace(/\/$/, '')}${path}`;
}
