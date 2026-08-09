import { describe, expect, it } from 'vitest';
import { readBooleanRecord, writeBooleanRecord, type StorageLike } from '../src/lib/storage';

class MemoryStorage implements StorageLike {
  value: string | null;

  constructor(value: string | null = null) {
    this.value = value;
  }

  getItem() {
    return this.value;
  }

  setItem(_key: string, value: string) {
    this.value = value;
  }
}

describe('boolean record storage', () => {
  it('filters values that are not booleans', () => {
    const storage = new MemoryStorage('{"done":true,"score":5}');
    expect(readBooleanRecord(storage, 'progress')).toEqual({ done: true });
  });

  it('recovers from malformed JSON on the next write', () => {
    const storage = new MemoryStorage('{broken');
    expect(writeBooleanRecord(storage, 'progress', 'lesson-1', true)).toBe(true);
    expect(storage.value).toBe('{"lesson-1":true}');
  });
});
