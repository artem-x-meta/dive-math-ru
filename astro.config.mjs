import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const site = process.env.SITE_URL;

export default defineConfig({
  ...(site ? { site } : {}),
  integrations: [
    react(),
    starlight({
      title: 'Ныряем в математику',
      description: 'Интерактивная онлайн-книга по математике для 6–11 классов',
      logo: {
        src: './src/assets/logo.svg',
        replacesTitle: true,
      },
      favicon: '/favicon.svg',
      defaultLocale: 'root',
      locales: {
        root: {
          label: 'Русский',
          lang: 'ru',
        },
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Старт',
          items: [
            { label: 'Как устроена книга', slug: 'about' },
            { label: 'Карта курса', slug: 'roadmap' },
          ],
        },
        {
          label: '6 класс',
          collapsed: false,
          items: [
            { label: 'Обзор', slug: '6-klass' },
            {
              label: '1. У чисел есть устройство',
              collapsed: false,
              items: [
                { label: 'Вход в тему', slug: '6-klass/delimost' },
                { label: '1.1 Делители и кратные', slug: '6-klass/delimost/deliteli' },
                { label: '1.2 Что рассказывает остаток', slug: '6-klass/delimost/ostatok' },
                { label: '1.3 Признаки делимости', slug: '6-klass/delimost/priznaki' },
                { label: '1.4 Простые числа', slug: '6-klass/delimost/prostye' },
                { label: '1.5 Наибольший общий делитель', slug: '6-klass/delimost/nod' },
                { label: '1.6 Наименьшее общее кратное', slug: '6-klass/delimost/nok' },
                { label: '1.7 Практикум', slug: '6-klass/delimost/praktikum' },
              ],
            },
            {
              label: '2. Дроби без страха',
              collapsed: false,
              items: [
                { label: 'Вход в тему', slug: '6-klass/drobi' },
                { label: '2.1 Сравнение дробей', slug: '6-klass/drobi/sravnenie' },
                { label: '2.2 Сложение дробей', slug: '6-klass/drobi/slozhenie' },
                { label: '2.3 Практикум', slug: '6-klass/drobi/praktikum' },
              ],
            },
            {
              label: '3. Отношения и проценты',
              collapsed: false,
              items: [
                { label: 'Вход в тему', slug: '6-klass/otnosheniya' },
                { label: '3.1 Смысл отношения', slug: '6-klass/otnosheniya/smysl' },
                { label: '3.2 Равные отношения и пропорции', slug: '6-klass/otnosheniya/proportsii' },
                { label: '3.3 Прямая пропорциональность', slug: '6-klass/otnosheniya/pryamaya-proportsionalnost' },
                { label: '3.4 Масштаб', slug: '6-klass/otnosheniya/masshtab' },
                { label: '3.5 Процент — доля из ста', slug: '6-klass/otnosheniya/protsenty' },
                { label: '3.6 Процентные задачи и изменения', slug: '6-klass/otnosheniya/izmeneniya' },
                { label: '3.7 Практикум', slug: '6-klass/otnosheniya/praktikum' },
              ],
            },
            {
              label: '4. Числа со знаком',
              collapsed: false,
              items: [
                { label: 'Вход в тему', slug: '6-klass/otricatelnye-chisla' },
                { label: '4.1 Координатная прямая', slug: '6-klass/otricatelnye-chisla/koordinatnaya-pryamaya' },
                { label: '4.2 Модуль и сравнение', slug: '6-klass/otricatelnye-chisla/modul-i-sravnenie' },
                { label: '4.3 Сложение чисел со знаком', slug: '6-klass/otricatelnye-chisla/slozhenie' },
                { label: '4.4 Вычитание чисел со знаком', slug: '6-klass/otricatelnye-chisla/vychitanie' },
                { label: '4.5 Умножение и деление', slug: '6-klass/otricatelnye-chisla/umnozhenie-i-delenie' },
                { label: '4.6 Координатная плоскость', slug: '6-klass/otricatelnye-chisla/koordinatnaya-ploskost' },
                { label: '4.7 Практикум', slug: '6-klass/otricatelnye-chisla/praktikum' },
              ],
            },
            {
              label: '5. Буквы, выражения и формулы',
              collapsed: false,
              items: [
                { label: 'Вход в тему', slug: '6-klass/bukvy-i-formuly' },
                { label: '5.1 Буква хранит число', slug: '6-klass/bukvy-i-formuly/bukva-kak-chislo' },
                { label: '5.2 Выражение — план вычислений', slug: '6-klass/bukvy-i-formuly/vyrazhenie-kak-plan' },
                { label: '5.3 Подстановка и таблица', slug: '6-klass/bukvy-i-formuly/podstanovka-i-tablitsa' },
                { label: '5.4 Распределительное свойство', slug: '6-klass/bukvy-i-formuly/raspredelitelnoe-svoystvo' },
                { label: '5.5 Подобные слагаемые', slug: '6-klass/bukvy-i-formuly/podobnye-slagaemye' },
                { label: '5.6 Формулы и модели', slug: '6-klass/bukvy-i-formuly/formuly-i-modeli' },
                { label: '5.7 Практикум', slug: '6-klass/bukvy-i-formuly/praktikum' },
              ],
            },
            {
              label: '6. Фигуры, меры и пространство',
              collapsed: false,
              items: [
                { label: 'Вход в тему', slug: '6-klass/geometriya-i-izmereniya' },
                { label: '6.1 Прямые и расстояния', slug: '6-klass/geometriya-i-izmereniya/pryamye-i-rasstoyaniya' },
                { label: '6.2 Углы и транспортир', slug: '6-klass/geometriya-i-izmereniya/ugly-i-transportir' },
                { label: '6.3 Треугольники и четырёхугольники', slug: '6-klass/geometriya-i-izmereniya/treugolniki-i-chetyrehugolniki' },
                { label: '6.4 Периметр и площадь', slug: '6-klass/geometriya-i-izmereniya/perimetr-i-ploschad' },
                { label: '6.5 Окружность и круг', slug: '6-klass/geometriya-i-izmereniya/okruzhnost-i-krug' },
                { label: '6.6 Симметрия', slug: '6-klass/geometriya-i-izmereniya/simmetriya' },
                { label: '6.7 Тела, развёртки и объём', slug: '6-klass/geometriya-i-izmereniya/tela-razvertki-i-obem' },
                { label: '6.8 Практикум', slug: '6-klass/geometriya-i-izmereniya/praktikum' },
              ],
            },
          ],
        },
        {
          label: '7 класс',
          collapsed: true,
          items: [
            { label: 'Программа года', slug: '7-klass', badge: 'план' },
          ],
        },
        {
          label: '8 класс',
          collapsed: true,
          items: [
            { label: 'Программа года', slug: '8-klass', badge: 'план' },
          ],
        },
        {
          label: '9 класс',
          collapsed: true,
          items: [
            { label: 'Программа года', slug: '9-klass', badge: 'план' },
          ],
        },
        {
          label: '10 класс',
          collapsed: true,
          items: [
            { label: 'Программа года', slug: '10-klass', badge: 'план' },
          ],
        },
        {
          label: '11 класс',
          collapsed: true,
          items: [
            { label: 'Программа года', slug: '11-klass', badge: 'план' },
          ],
        },
      ],
    }),
  ],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  },
  vite: {
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
      },
    },
  },
});
