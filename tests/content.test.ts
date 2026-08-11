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
      '/6-klass/dannye/',
      '/6-klass/dannye/tablitsy-i-diagrammy/',
      '/6-klass/dannye/krugovye-diagrammy/',
      '/6-klass/dannye/srednee-arifmeticheskoe/',
      '/6-klass/dannye/perebor-variantov/',
      '/6-klass/dannye/praktikum/',
      '/7-klass/ratsionalnye-chisla/',
      '/7-klass/ratsionalnye-chisla/tochnye-vychisleniya/',
      '/7-klass/ratsionalnye-chisla/stepen/',
      '/7-klass/ratsionalnye-chisla/svoystva-stepeney/',
      '/7-klass/ratsionalnye-chisla/standartnyy-vid/',
      '/7-klass/ratsionalnye-chisla/praktikum/',
      '/7-klass/algebraicheskiy-yazyk/',
      '/7-klass/algebraicheskiy-yazyk/tozhdestva/',
      '/7-klass/algebraicheskiy-yazyk/odnochleny-i-mnogochleny/',
      '/7-klass/algebraicheskiy-yazyk/umnozhenie-mnogochlenov/',
      '/7-klass/algebraicheskiy-yazyk/formuly-sokrashchennogo-umnozheniya/',
      '/7-klass/algebraicheskiy-yazyk/razlozhenie-na-mnozhiteli/',
      '/7-klass/algebraicheskiy-yazyk/praktikum/',
      '/7-klass/lineynye-modeli/',
      '/7-klass/lineynye-modeli/lineynye-uravneniya/',
      '/7-klass/lineynye-modeli/tekstovye-zadachi/',
      '/7-klass/lineynye-modeli/lineynaya-funktsiya/',
      '/7-klass/lineynye-modeli/sistemy-uravneniy/',
      '/7-klass/lineynye-modeli/praktikum/',
      '/7-klass/yazyk-dokazatelstva/',
      '/7-klass/yazyk-dokazatelstva/opredeleniya-i-dokazatelstva/',
      '/7-klass/yazyk-dokazatelstva/priznaki-ravenstva/',
      '/7-klass/yazyk-dokazatelstva/ravnobedrennyy-treugolnik/',
      '/7-klass/yazyk-dokazatelstva/parallelnye-pryamye/',
      '/7-klass/yazyk-dokazatelstva/summa-uglov/',
      '/7-klass/yazyk-dokazatelstva/praktikum/',
      '/7-klass/dannye-i-sluchaynost/',
      '/7-klass/dannye-i-sluchaynost/srednee-i-mediana/',
      '/7-klass/dannye-i-sluchaynost/chastoty-i-diagrammy/',
      '/7-klass/dannye-i-sluchaynost/sluchaynyy-opyt/',
      '/7-klass/dannye-i-sluchaynost/praktikum/',
      '/8-klass/deystvitelnye-chisla/',
      '/8-klass/deystvitelnye-chisla/kvadratnyy-koren/',
      '/8-klass/deystvitelnye-chisla/irratsionalnye-chisla/',
      '/8-klass/deystvitelnye-chisla/otsenka-i-priblizheniya/',
      '/8-klass/deystvitelnye-chisla/svoystva-kornya/',
      '/8-klass/deystvitelnye-chisla/stepen-s-tselym-pokazatelem/',
      '/8-klass/deystvitelnye-chisla/praktikum/',
      '/8-klass/algebraicheskie-drobi/',
      '/8-klass/algebraicheskie-drobi/dopustimye-znacheniya/',
      '/8-klass/algebraicheskie-drobi/sokrashchenie/',
      '/8-klass/algebraicheskie-drobi/slozhenie-i-vychitanie/',
      '/8-klass/algebraicheskie-drobi/umnozhenie-i-delenie/',
      '/8-klass/algebraicheskie-drobi/ratsionalnye-uravneniya/',
      '/8-klass/algebraicheskie-drobi/praktikum/',
      '/8-klass/kvadratnye-uravneniya/',
      '/8-klass/kvadratnye-uravneniya/nepolnye-uravneniya/',
      '/8-klass/kvadratnye-uravneniya/diskriminant/',
      '/8-klass/kvadratnye-uravneniya/teorema-vieta/',
      '/8-klass/kvadratnye-uravneniya/tekstovye-zadachi/',
      '/8-klass/kvadratnye-uravneniya/praktikum/',
      '/8-klass/funktsii-i-neravenstva/',
      '/8-klass/funktsii-i-neravenstva/galereya-grafikov/',
      '/8-klass/funktsii-i-neravenstva/chislovye-promezhutki/',
      '/8-klass/funktsii-i-neravenstva/svoystva-neravenstv/',
      '/8-klass/funktsii-i-neravenstva/lineynye-neravenstva/',
      '/8-klass/funktsii-i-neravenstva/sistemy-neravenstv/',
      '/8-klass/funktsii-i-neravenstva/praktikum/',
      '/8-klass/podobie-i-okruzhnost/',
      '/8-klass/podobie-i-okruzhnost/podobie-treugolnikov/',
      '/8-klass/podobie-i-okruzhnost/teorema-pifagora/',
      '/8-klass/podobie-i-okruzhnost/trigonometriya-ostrogo-ugla/',
      '/8-klass/podobie-i-okruzhnost/okruzhnost-i-kasatelnye/',
      '/8-klass/podobie-i-okruzhnost/vpisannye-ugly/',
      '/8-klass/podobie-i-okruzhnost/praktikum/',
      '/8-klass/veroyatnostnye-derevya/',
      '/8-klass/veroyatnostnye-derevya/sobytiya-i-mnozhestva/',
      '/8-klass/veroyatnostnye-derevya/klassicheskaya-veroyatnost/',
      '/8-klass/veroyatnostnye-derevya/derevo-ispytaniy/',
      '/8-klass/veroyatnostnye-derevya/rasseivanie-dannykh/',
      '/8-klass/veroyatnostnye-derevya/praktikum/',
      '/9-klass/uravneniya-i-sistemy/',
      '/9-klass/uravneniya-i-sistemy/ratsionalnye-uravneniya/',
      '/9-klass/uravneniya-i-sistemy/uravnenie-s-dvumya-peremennymi/',
      '/9-klass/uravneniya-i-sistemy/sistemy-uravneniy/',
      '/9-klass/uravneniya-i-sistemy/tekstovye-zadachi/',
      '/9-klass/uravneniya-i-sistemy/praktikum/',
      '/9-klass/kvadratichnaya-funktsiya/',
      '/9-klass/kvadratichnaya-funktsiya/parabola/',
      '/9-klass/kvadratichnaya-funktsiya/preobrazovaniya-grafika/',
      '/9-klass/kvadratichnaya-funktsiya/vershina-i-svoystva/',
      '/9-klass/kvadratichnaya-funktsiya/kvadratnye-neravenstva/',
      '/9-klass/kvadratichnaya-funktsiya/praktikum/',
      '/9-klass/posledovatelnosti/',
      '/9-klass/posledovatelnosti/chislovye-posledovatelnosti/',
      '/9-klass/posledovatelnosti/arifmeticheskaya-progressiya/',
      '/9-klass/posledovatelnosti/geometricheskaya-progressiya/',
      '/9-klass/posledovatelnosti/slozhnyy-protsent/',
      '/9-klass/posledovatelnosti/praktikum/',
      '/9-klass/geometricheskiy-sintez/',
      '/9-klass/geometricheskiy-sintez/teorema-kosinusov/',
      '/9-klass/geometricheskiy-sintez/teorema-sinusov/',
      '/9-klass/geometricheskiy-sintez/reshenie-treugolnikov/',
      '/9-klass/geometricheskiy-sintez/pravilnye-mnogougolniki/',
      '/9-klass/geometricheskiy-sintez/praktikum/',
      '/9-klass/vektory-i-dvizheniya/',
      '/9-klass/vektory-i-dvizheniya/vektory-i-deystviya/',
      '/9-klass/vektory-i-dvizheniya/koordinatnyy-metod/',
      '/9-klass/vektory-i-dvizheniya/skalyarnoe-proizvedenie/',
      '/9-klass/vektory-i-dvizheniya/dvizheniya-ploskosti/',
      '/9-klass/vektory-i-dvizheniya/praktikum/',
      '/9-klass/kombinatorika/',
      '/9-klass/kombinatorika/pravila-podscheta/',
      '/9-klass/kombinatorika/perestanovki-i-razmeshcheniya/',
      '/9-klass/kombinatorika/sochetaniya/',
      '/9-klass/kombinatorika/skhema-bernulli/',
      '/9-klass/kombinatorika/praktikum/',
      '/10-klass/yazyk-funktsiy/',
      '/10-klass/yazyk-funktsiy/chto-takoe-funktsiya/',
      '/10-klass/yazyk-funktsiy/preobrazovaniya-grafikov/',
      '/10-klass/yazyk-funktsiy/obratnaya-funktsiya/',
      '/10-klass/yazyk-funktsiy/kompozitsiya/',
      '/10-klass/yazyk-funktsiy/praktikum/',
      '/10-klass/trigonometriya/',
      '/10-klass/trigonometriya/edinichnaya-okruzhnost/',
      '/10-klass/trigonometriya/grafiki-i-periodichnost/',
      '/10-klass/trigonometriya/tozhdestva/',
      '/10-klass/trigonometriya/formuly-slozheniya/',
      '/10-klass/trigonometriya/trigonometricheskie-uravneniya/',
      '/10-klass/trigonometriya/praktikum/',
      '/10-klass/uravneniya-i-logika/',
      '/10-klass/uravneniya-i-logika/ravnosilnost-i-sledstvie/',
      '/10-klass/uravneniya-i-logika/irratsionalnye-uravneniya/',
      '/10-klass/uravneniya-i-logika/uravneniya-s-modulem/',
      '/10-klass/uravneniya-i-logika/mnozhestva-i-logika/',
      '/10-klass/uravneniya-i-logika/praktikum/',
      '/10-klass/prostranstvo/',
      '/10-klass/prostranstvo/aksiomy-i-raspolozhenie/',
      '/10-klass/prostranstvo/parallelnost/',
      '/10-klass/prostranstvo/perpendikulyarnost/',
      '/10-klass/prostranstvo/rasstoyaniya-i-ugly/',
      '/10-klass/prostranstvo/praktikum/',
      '/10-klass/mnogogranniki-i-secheniya/',
      '/10-klass/mnogogranniki-i-secheniya/prizma-i-piramida/',
      '/10-klass/mnogogranniki-i-secheniya/pravilnye-mnogogranniki/',
      '/10-klass/mnogogranniki-i-secheniya/postroenie-secheniy/',
      '/10-klass/mnogogranniki-i-secheniya/ploshchad-poverkhnosti/',
      '/10-klass/mnogogranniki-i-secheniya/obyomy-mnogogrannikov/',
      '/10-klass/mnogogranniki-i-secheniya/praktikum/',
      '/10-klass/uslovnaya-veroyatnost/',
      '/10-klass/uslovnaya-veroyatnost/uslovnaya-veroyatnost/',
      '/10-klass/uslovnaya-veroyatnost/nezavisimost/',
      '/10-klass/uslovnaya-veroyatnost/polnaya-veroyatnost-i-bayes/',
      '/10-klass/uslovnaya-veroyatnost/diskretnye-raspredeleniya/',
      '/10-klass/uslovnaya-veroyatnost/praktikum/',
      '/11-klass/eksponenta-i-logarifm/',
      '/11-klass/eksponenta-i-logarifm/stepen-s-ratsionalnym-pokazatelem/',
      '/11-klass/eksponenta-i-logarifm/pokazatelnaya-funktsiya/',
      '/11-klass/eksponenta-i-logarifm/logarifm/',
      '/11-klass/eksponenta-i-logarifm/logarifmicheskaya-funktsiya/',
      '/11-klass/eksponenta-i-logarifm/uravneniya-i-neravenstva/',
      '/11-klass/eksponenta-i-logarifm/praktikum/',
      '/11-klass/proizvodnaya/',
      '/11-klass/proizvodnaya/kasatelnaya-i-skorost/',
      '/11-klass/proizvodnaya/pravila-differentsirovaniya/',
      '/11-klass/proizvodnaya/issledovanie-funktsii/',
      '/11-klass/proizvodnaya/optimizatsiya/',
      '/11-klass/proizvodnaya/praktikum/',
      '/11-klass/integral/',
      '/11-klass/integral/pervoobraznaya/',
      '/11-klass/integral/ploshchad-pod-grafikom/',
      '/11-klass/integral/nyuton-leybnits/',
      '/11-klass/integral/nakoplenie-velichiny/',
      '/11-klass/integral/praktikum/',
      '/11-klass/tela-vrashcheniya/',
      '/11-klass/tela-vrashcheniya/tsilindr/',
      '/11-klass/tela-vrashcheniya/konus/',
      '/11-klass/tela-vrashcheniya/shar-i-sfera/',
      '/11-klass/tela-vrashcheniya/obyomy/',
      '/11-klass/tela-vrashcheniya/praktikum/',
      '/11-klass/vektory-v-prostranstve/',
      '/11-klass/vektory-v-prostranstve/koordinaty-v-prostranstve/',
      '/11-klass/vektory-v-prostranstve/vektory-i-deystviya/',
      '/11-klass/vektory-v-prostranstve/skalyarnoe-proizvedenie/',
      '/11-klass/vektory-v-prostranstve/ugly-i-rasstoyaniya/',
      '/11-klass/vektory-v-prostranstve/praktikum/',
      '/11-klass/statisticheskoe-myshlenie/',
      '/11-klass/statisticheskoe-myshlenie/ozhidanie/',
      '/11-klass/statisticheskoe-myshlenie/dispersiya/',
      '/11-klass/statisticheskoe-myshlenie/normalnaya-model/',
      '/11-klass/statisticheskoe-myshlenie/vyborka-i-vyvody/',
      '/11-klass/statisticheskoe-myshlenie/praktikum/',
      '/lean/',
      '/lean/dokazatelstvo-kak-obekt/',
      '/lean/svyazki-i-razbor-sluchaev/',
      '/lean/kvantory/',
      '/lean/perepisyvanie-ravenstv/',
      '/lean/chisla-i-reshateli/',
      '/lean/induktsiya/',
      '/lean/neravenstva/',
      '/lean/ravnosilnost-i-sledstvie/',
      '/lean/irratsionalnost-kornya/',
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
