import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const contentRoot = join(process.cwd(), 'src', 'content', 'docs');
const sourceRoot = join(process.cwd(), 'src');

function collectContentFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectContentFiles(path) : ['.md', '.mdx'].includes(extname(entry.name)) ? [path] : [];
  });
}

function collectLinkSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? collectLinkSourceFiles(path)
      : ['.md', '.mdx', '.astro', '.tsx'].includes(extname(entry.name))
        ? [path]
        : [];
  });
}

function slugFor(file: string): string {
  const normalized = relative(contentRoot, file).split(sep).join('/').replace(/\.mdx?$/, '');
  return normalized === 'index' ? '/' : `/${normalized.replace(/\/index$/, '')}/`;
}

describe('book content', () => {
  const files = collectContentFiles(contentRoot);
  const slugs = new Set(files.map(slugFor));

  it('contains every published learning route', () => {
    expect([...slugs]).toEqual(expect.arrayContaining([
      '/6-klass/delimost/',
      '/6-klass/delimost/deliteli/',
      '/6-klass/delimost/ostatok/',
      '/6-klass/delimost/priznaki/',
      '/6-klass/delimost/prostye/',
      '/6-klass/delimost/nod/',
      '/6-klass/delimost/nok/',
      '/6-klass/delimost/praktikum/',
      '/6-klass/drobi/',
      '/6-klass/drobi/sravnenie/',
      '/6-klass/drobi/slozhenie/',
      '/6-klass/drobi/praktikum/',
      '/6-klass/otnosheniya/',
      '/6-klass/otnosheniya/smysl/',
      '/6-klass/otnosheniya/proportsii/',
      '/6-klass/otnosheniya/pryamaya-proportsionalnost/',
      '/6-klass/otnosheniya/masshtab/',
      '/6-klass/otnosheniya/protsenty/',
      '/6-klass/otnosheniya/izmeneniya/',
      '/6-klass/otnosheniya/praktikum/',
      '/6-klass/otricatelnye-chisla/',
      '/6-klass/otricatelnye-chisla/koordinatnaya-pryamaya/',
      '/6-klass/otricatelnye-chisla/modul-i-sravnenie/',
      '/6-klass/otricatelnye-chisla/slozhenie/',
      '/6-klass/otricatelnye-chisla/vychitanie/',
      '/6-klass/otricatelnye-chisla/umnozhenie-i-delenie/',
      '/6-klass/otricatelnye-chisla/koordinatnaya-ploskost/',
      '/6-klass/otricatelnye-chisla/praktikum/',
      '/6-klass/bukvy-i-formuly/',
      '/6-klass/bukvy-i-formuly/bukva-kak-chislo/',
      '/6-klass/bukvy-i-formuly/vyrazhenie-kak-plan/',
      '/6-klass/bukvy-i-formuly/podstanovka-i-tablitsa/',
      '/6-klass/bukvy-i-formuly/raspredelitelnoe-svoystvo/',
      '/6-klass/bukvy-i-formuly/podobnye-slagaemye/',
      '/6-klass/bukvy-i-formuly/formuly-i-modeli/',
      '/6-klass/bukvy-i-formuly/praktikum/',
      '/6-klass/geometriya-i-izmereniya/',
      '/6-klass/geometriya-i-izmereniya/pryamye-i-rasstoyaniya/',
      '/6-klass/geometriya-i-izmereniya/ugly-i-transportir/',
      '/6-klass/geometriya-i-izmereniya/treugolniki-i-chetyrehugolniki/',
      '/6-klass/geometriya-i-izmereniya/perimetr-i-ploschad/',
      '/6-klass/geometriya-i-izmereniya/okruzhnost-i-krug/',
      '/6-klass/geometriya-i-izmereniya/simmetriya/',
      '/6-klass/geometriya-i-izmereniya/tela-razvertki-i-obem/',
      '/6-klass/geometriya-i-izmereniya/praktikum/',
    ]));
  });

  it('does not contain broken internal links in content and UI sources', () => {
    const broken: string[] = [];
    const sourceFiles = [
      ...collectLinkSourceFiles(sourceRoot),
      join(process.cwd(), 'astro.config.mjs'),
    ];

    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8');
      const links = [...source.matchAll(/(?:\]\(|href\s*[:=]\s*["']|link:\s*)(\/[^)"'#?\s]+\/?)/g)].map((match) => match[1]);
      for (const link of links) {
        if (!slugs.has(link.endsWith('/') ? link : `${link}/`)) {
          broken.push(`${relative(process.cwd(), file)} → ${link}`);
        }
      }
    }

    expect(broken).toEqual([]);
  });

  it('keeps every configured sidebar slug connected to a page', () => {
    const config = readFileSync(join(process.cwd(), 'astro.config.mjs'), 'utf8');
    const sidebarSlugs = [...config.matchAll(/slug:\s*['"]([^'"]+)['"]/g)].map((match) => `/${match[1]}/`);

    expect(sidebarSlugs.length).toBeGreaterThan(0);
    expect(sidebarSlugs.filter((slug) => !slugs.has(slug))).toEqual([]);
  });

  it('keeps progress routes synchronized with lesson completion ids', () => {
    const lessonIds = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return [...source.matchAll(/lessonId=["']([^"']+)["']/g)].map((match) => match[1]);
    });
    const progressSources = [
      join(sourceRoot, 'components', 'CourseProgress.tsx'),
      ...files.filter((file) => readFileSync(file, 'utf8').includes('<CourseProgress')),
    ];
    const progressIds = progressSources.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return [...source.matchAll(/\bid:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
    });

    expect(new Set(lessonIds).size).toBe(lessonIds.length);
    expect([...new Set(progressIds)].sort()).toEqual([...lessonIds].sort());
  });

  it('keeps required project entry files', () => {
    expect(existsSync(join(process.cwd(), 'astro.config.mjs'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'src', 'content.config.ts'))).toBe(true);
  });
});
