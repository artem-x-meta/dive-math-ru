/**
 * Подставляет базовый путь во внутренние ссылки разметки.
 *
 * На GitHub Pages сайт живёт по подпути (`/dive-math-ru/`), а в исходниках
 * ссылки записаны от корня (`/6-klass/delimost/`) — так их проверяет
 * tests/content.test.ts и так они работают при локальной разработке.
 * Плагин переписывает их на сборке, поэтому content-файлы менять не нужно.
 *
 * Без BASE_PATH плагин ничего не делает.
 */

/** Ссылки на другие сайты, протоколы и якоря трогать нельзя. */
function isInternal(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//');
}

export function remarkBaseLinks(options = {}) {
  const base = (options.base ?? '').replace(/\/$/, '');
  if (base === '') return () => {};

  return (tree) => {
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;

      // Ссылки и картинки разметки: [текст](/путь) и ![alt](/путь)
      if ((node.type === 'link' || node.type === 'image' || node.type === 'definition') && isInternal(node.url)) {
        node.url = `${base}${node.url}`;
      }

      // Ссылки внутри JSX: <a href="/путь"> и пропсы вида href="/путь"
      if (Array.isArray(node.attributes)) {
        for (const attribute of node.attributes) {
          if (attribute?.type === 'mdxJsxAttribute' && attribute.name === 'href' && isInternal(attribute.value)) {
            attribute.value = `${base}${attribute.value}`;
          }
        }
      }

      for (const child of node.children ?? []) walk(child);
    };

    walk(tree);
  };
}

export default remarkBaseLinks;
