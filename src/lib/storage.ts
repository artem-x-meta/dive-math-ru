export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readBooleanRecord(storage: StorageLike, key: string): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? '{}');
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
    );
  } catch {
    return {};
  }
}

export function writeBooleanRecord(storage: StorageLike, key: string, id: string, value: boolean): boolean {
  try {
    const saved = readBooleanRecord(storage, key);
    storage.setItem(key, JSON.stringify({ ...saved, [id]: value }));
    return true;
  } catch {
    return false;
  }
}
