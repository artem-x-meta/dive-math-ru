import { useEffect, useState } from 'react';
import { readBooleanRecord, writeBooleanRecord } from '../lib/storage';

interface Props {
  lessonId: string;
}

const STORAGE_KEY = 'dive-math:lessons';

export default function LessonComplete({ lessonId }: Props) {
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    setComplete(Boolean(readBooleanRecord(localStorage, STORAGE_KEY)[lessonId]));
  }, [lessonId]);

  const toggle = () => {
    const next = !complete;
    setComplete(next);
    writeBooleanRecord(localStorage, STORAGE_KEY, lessonId, next);
  };

  return (
    <section className="dm-complete not-content" data-complete={complete}>
      <div>
        <h3>{complete ? 'Урок отмечен как пройденный' : 'Закончил урок?'}</h3>
        <p>{complete ? 'Отлично. Отметка хранится только в этом браузере.' : 'Отметь прогресс — регистрация не нужна.'}</p>
      </div>
      <button className={`dm-button ${complete ? 'dm-button--secondary' : ''}`} type="button" onClick={toggle}>
        {complete ? '✓ Пройдено' : 'Отметить пройденным'}
      </button>
    </section>
  );
}
