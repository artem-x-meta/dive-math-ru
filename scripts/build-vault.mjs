/**
 * Генератор Obsidian-заметок для уроков книги.
 *
 * Читает MDX-страницы из src/content/docs и создаёт по короткой заметке
 * на каждый урок в vault/uroki. Заметки намеренно не копируют текст урока:
 * они дают название, цели, лаборатории и ссылку на страницу книги, чтобы
 * заметкам о понятиях было на что ссылаться. Полный текст живёт только в MDX.
 *
 * Запуск: npm run vault
 */

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentRoot = join(projectRoot, 'src', 'content', 'docs');
const vaultRoot = join(projectRoot, 'vault');
const lessonsRoot = join(vaultRoot, 'uroki');
const siteBase = (process.env.SITE_URL ?? 'http://localhost:4321').replace(/\/$/, '');

const GRADES = ['6-klass', '7-klass', '8-klass', '9-klass', '10-klass', '11-klass'];

/** Windows запрещает : ? * " < > | / \ в именах файлов. */
function safeFileName(title) {
  return title.replace(/:/g, ' —').replace(/[?*"<>|/\\]/g, '').trim();
}

function collectMdx(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectMdx(path);
    return extname(entry.name) === '.mdx' ? [path] : [];
  });
}

function frontmatterValue(source, key) {
  const match = source.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!match) return null;
  return match[1].trim().replace(/^['"]|['"]$/g, '').trim();
}

/** Цели урока из <LearningGoals items={[ '...', '...' ]} />. */
function learningGoals(source) {
  const block = source.match(/<LearningGoals[^>]*items=\{\[([\s\S]*?)\]\}/);
  if (!block) return [];
  return [...block[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] ?? m[2]);
}

/** Что нужно знать заранее — из атрибута prerequisites у <LessonMeta />. */
function prerequisites(source) {
  const meta = source.match(/<LessonMeta[^>]*prerequisites="([^"]*)"/);
  return meta ? meta[1] : null;
}

function gradeLabel(source) {
  const meta = source.match(/<LessonMeta[^>]*grade="([^"]*)"/);
  return meta ? meta[1] : null;
}

/** Импортированные компоненты, имя которых заканчивается на Lab. */
function labs(source) {
  return [...source.matchAll(/^import\s+(\w*Lab)\s+from/gm)].map((m) => m[1]);
}

function routeFor(file) {
  const normalized = relative(contentRoot, file).split(sep).join('/').replace(/\.mdx$/, '');
  return `/${normalized.replace(/\/index$/, '')}/`;
}

function gradeNumber(gradeDir) {
  return Number.parseInt(gradeDir, 10);
}

/** Уникальное имя заметки: номера уроков повторяются в разных классах. */
function noteName(gradeDir, title) {
  return safeFileName(`${gradeNumber(gradeDir)} класс · ${title}`);
}

function yamlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

const lessons = [];

for (const gradeDir of GRADES) {
  const gradePath = join(contentRoot, gradeDir);
  for (const file of collectMdx(gradePath)) {
    const parts = relative(contentRoot, file).split(sep);
    // parts: [<grade>, <chapter>, <lesson>.mdx] либо [<grade>, index.mdx]
    if (parts.length < 3) continue; // обзор класса — не урок
    const [, chapterDir, fileName] = parts;
    const source = readFileSync(file, 'utf8');
    const title = frontmatterValue(source, 'title');
    if (!title) continue;

    lessons.push({
      grade: gradeDir,
      chapter: chapterDir,
      isChapterIndex: fileName === 'index.mdx',
      title,
      note: noteName(gradeDir, title),
      description: frontmatterValue(source, 'description'),
      goals: learningGoals(source),
      prerequisites: prerequisites(source),
      gradeLabel: gradeLabel(source),
      labs: labs(source),
      route: routeFor(file),
    });
  }
}

lessons.sort((a, b) => a.route.localeCompare(b.route, 'ru'));

rmSync(lessonsRoot, { recursive: true, force: true });

for (const lesson of lessons) {
  const dir = join(lessonsRoot, lesson.grade, lesson.chapter);
  mkdirSync(dir, { recursive: true });

  const tags = ['урок', `класс/${gradeNumber(lesson.grade)}`];
  if (lesson.isChapterIndex) tags.push('вход-в-тему');
  if (/практикум/i.test(lesson.title)) tags.push('практикум');

  const body = [
    '---',
    `title: ${yamlString(lesson.title)}`,
    `klass: ${gradeNumber(lesson.grade)}`,
    `glava: ${yamlString(lesson.chapter)}`,
    `stranitsa: ${yamlString(lesson.route)}`,
    `tags: [${tags.map((tag) => yamlString(tag)).join(', ')}]`,
    '---',
    '',
    `# ${lesson.title}`,
    '',
    '> [!info] Это заметка-указатель',
    '> Полный текст урока живёт в книге. Здесь только карточка для связей.',
    '',
    `**Читать урок:** [${lesson.title}](${siteBase}${lesson.route})`,
    '',
  ];

  if (lesson.gradeLabel) body.push(`**Раздел:** ${lesson.gradeLabel}`, '');
  if (lesson.description) body.push(lesson.description, '');

  if (lesson.prerequisites) {
    body.push('## Нужно знать заранее', '', lesson.prerequisites, '');
  }

  if (lesson.goals.length > 0) {
    body.push('## После урока ты сможешь', '', ...lesson.goals.map((goal) => `- ${goal}`), '');
  }

  if (lesson.labs.length > 0) {
    body.push('## Лаборатории', '', ...lesson.labs.map((lab) => `- \`${lab}\``), '');
  }

  body.push(
    '## Понятия урока',
    '',
    'Заполняется обратными ссылками: заметки о понятиях ссылаются сюда,',
    'и Obsidian показывает их в панели «Backlinks».',
    '',
  );

  writeFileSync(join(dir, `${lesson.note}.md`), body.join('\n'), 'utf8');
}

// Указатель: точные имена заметок, чтобы ссылки [[...]] писались без опечаток.
const indexLines = [
  '---',
  "tags: ['указатель']",
  '---',
  '',
  '# Указатель уроков',
  '',
  'Точные имена заметок для ссылок вида `[[8 класс · 3.2 Полный квадрат и дискриминант]]`.',
  'Файл создаётся генератором — править вручную не нужно.',
  '',
];

for (const gradeDir of GRADES) {
  const gradeLessons = lessons.filter((lesson) => lesson.grade === gradeDir);
  if (gradeLessons.length === 0) continue;
  indexLines.push(`## ${gradeNumber(gradeDir)} класс`, '');
  let currentChapter = null;
  for (const lesson of gradeLessons) {
    if (lesson.chapter !== currentChapter) {
      currentChapter = lesson.chapter;
      indexLines.push(`### ${currentChapter}`, '');
    }
    indexLines.push(`- [[${lesson.note}]]`);
  }
  indexLines.push('');
}

writeFileSync(join(vaultRoot, 'Указатель уроков.md'), indexLines.join('\n'), 'utf8');

console.log(`Готово: ${lessons.length} заметок об уроках в vault/uroki`);
