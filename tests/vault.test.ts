import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const vaultRoot = join(projectRoot, 'vault');
const conceptsRoot = join(vaultRoot, 'ponyatiya');
const lessonsRoot = join(vaultRoot, 'uroki');
const contentRoot = join(projectRoot, 'src', 'content', 'docs');

function collectMarkdown(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectMarkdown(path) : extname(entry.name) === '.md' ? [path] : [];
  });
}

function noteName(file: string): string {
  return basename(file, '.md');
}

/** Значения списка aliases из frontmatter: aliases: ['a', 'b']. */
function aliases(source: string): string[] {
  const line = source.match(/^aliases:\s*\[(.*)\]\s*$/m);
  if (!line) return [];
  return [...line[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((match) => match[1] ?? match[2]);
}

/** Ссылки [[Имя]], [[Имя|подпись]], [[Имя#заголовок]]. */
function wikiLinks(source: string): string[] {
  return [...source.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)].map((match) => match[1].trim());
}

function frontmatterValue(source: string, key: string): string | null {
  const match = source.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
}

function contentRoutes(): Set<string> {
  const collect = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return collect(path);
      return ['.md', '.mdx'].includes(extname(entry.name)) ? [path] : [];
    });

  return new Set(
    collect(contentRoot).map((file) => {
      const normalized = relative(contentRoot, file).split(sep).join('/').replace(/\.mdx?$/, '');
      return normalized === 'index' ? '/' : `/${normalized.replace(/\/index$/, '')}/`;
    }),
  );
}

describe('obsidian vault', () => {
  const files = collectMarkdown(vaultRoot);
  const lessonFiles = collectMarkdown(lessonsRoot);
  const conceptFiles = collectMarkdown(conceptsRoot);

  it('is generated and hand-authored', () => {
    expect(lessonFiles.length).toBeGreaterThan(200);
    expect(conceptFiles.length).toBeGreaterThan(80);
  });

  it('keeps every note name unique so wiki links resolve', () => {
    const seen = new Map<string, string[]>();
    for (const file of files) {
      const name = noteName(file);
      seen.set(name, [...(seen.get(name) ?? []), relative(projectRoot, file)]);
    }
    const duplicates = [...seen.entries()].filter(([, paths]) => paths.length > 1);
    expect(duplicates).toEqual([]);
  });

  it('has no dangling links — every mentioned concept is defined somewhere', () => {
    const resolvable = new Set<string>();
    for (const file of files) {
      resolvable.add(noteName(file));
      for (const alias of aliases(readFileSync(file, 'utf8'))) resolvable.add(alias);
    }

    const dangling: string[] = [];
    for (const file of files) {
      for (const link of wikiLinks(readFileSync(file, 'utf8'))) {
        if (!resolvable.has(link)) dangling.push(`${relative(projectRoot, file)} → [[${link}]]`);
      }
    }

    expect(dangling).toEqual([]);
  });

  it('points every lesson note at a real book page', () => {
    const routes = contentRoutes();
    const broken = lessonFiles
      .map((file) => ({ file, route: frontmatterValue(readFileSync(file, 'utf8'), 'stranitsa') }))
      .filter((entry) => !entry.route || !routes.has(entry.route))
      .map((entry) => `${relative(projectRoot, entry.file)} → ${entry.route}`);

    expect(broken).toEqual([]);
  });

  it('gives every concept note a line and an introducing grade', () => {
    const lines = new Set(['числа', 'алгебра', 'функции', 'геометрия', 'данные', 'рассуждение']);
    const invalid: string[] = [];

    for (const file of conceptFiles) {
      const source = readFileSync(file, 'utf8');
      const line = frontmatterValue(source, 'liniya');
      const grade = Number(frontmatterValue(source, 'vvoditsya'));
      if (!line || !lines.has(line)) invalid.push(`${noteName(file)} — линия «${line}»`);
      if (!Number.isInteger(grade) || grade < 6 || grade > 11) {
        invalid.push(`${noteName(file)} — класс «${grade}»`);
      }
    }

    expect(invalid).toEqual([]);
  });

  it('links every concept note to at least one lesson', () => {
    const lessonNames = new Set(lessonFiles.map(noteName));
    const orphans = conceptFiles
      .filter((file) => !wikiLinks(readFileSync(file, 'utf8')).some((link) => lessonNames.has(link)))
      .map(noteName);

    expect(orphans).toEqual([]);
  });
});
