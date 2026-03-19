export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStore implements KeyValueStore {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function getDefaultStore(): KeyValueStore {
  if (typeof window !== 'undefined') {
    return window.localStorage;
  }

  return new MemoryStore();
}

export const appStorage: KeyValueStore = getDefaultStore();

export function readJson<T>(store: KeyValueStore, key: string, fallback: T): T {
  const value = store.getItem(key);
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(store: KeyValueStore, key: string, value: T): void {
  store.setItem(key, JSON.stringify(value));
}
