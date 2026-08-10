import { useEffect, useId, useMemo, useState } from 'react';
import { readBooleanRecord } from '../lib/storage';
import { withBase } from '../lib/basePath';

const defaultLessons = [
  { id: '6-fractions-compare', title: 'Сравнение дробей', href: '/6-klass/drobi/sravnenie/' },
  { id: '6-fractions-add', title: 'Сложение дробей', href: '/6-klass/drobi/slozhenie/' },
  { id: '6-fractions-practice', title: 'Практикум', href: '/6-klass/drobi/praktikum/' },
];

const STORAGE_KEY = 'dive-math:lessons';

interface LessonLink {
  id: string;
  title: string;
  href: string;
}

interface Props {
  lessons?: LessonLink[];
  eyebrow?: string;
}

export default function CourseProgress({ lessons = defaultLessons, eyebrow = 'Твой маршрут · хранится в браузере' }: Props) {
  const titleId = useId();
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCompleted(readBooleanRecord(localStorage, STORAGE_KEY));
  }, []);

  const completedCount = lessons.filter((lesson) => completed[lesson.id]).length;
  const nextLesson = useMemo(
    () => lessons.find((lesson) => !completed[lesson.id]) ?? lessons[lessons.length - 1],
    [completed, lessons],
  );
  const allComplete = completedCount === lessons.length;

  return (
    <section className="dm-progress not-content" aria-labelledby={titleId}>
      <div className="dm-progress__copy">
        <p className="dm-progress__eyebrow">{eyebrow}</p>
        <h3 id={titleId}>{allComplete ? 'Модуль пройден' : completedCount === 0 ? 'Начни с первой идеи' : 'Продолжай погружение'}</h3>
        <p>{completedCount} из {lessons.length} уроков отмечено</p>
        <progress value={completedCount} max={lessons.length} aria-label={`Пройдено ${completedCount} из ${lessons.length} уроков`} />
      </div>
      <a className="dm-button" href={withBase(nextLesson.href)}>
        {allComplete ? 'Повторить практику' : completedCount === 0 ? 'Начать маршрут' : `Дальше: ${nextLesson.title}`} <span aria-hidden="true">→</span>
      </a>
    </section>
  );
}
