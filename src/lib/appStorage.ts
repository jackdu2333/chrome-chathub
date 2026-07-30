type StorageValues = Record<string, unknown>;

const LOCAL_STORAGE_PREFIX = 'chathub:';

function getChromeStorage() {
  return globalThis.chrome?.storage?.local ?? null;
}

function getBrowserLocalStorage() {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

export async function appStorageGet<T>(
  keys: string[]
): Promise<Partial<T>> {
  const chromeStorage = getChromeStorage();
  if (chromeStorage) {
    return await chromeStorage.get<StorageValues>(keys) as Partial<T>;
  }

  const localStorage = getBrowserLocalStorage();
  if (!localStorage) {
    return {};
  }

  const result: StorageValues = {};
  for (const key of keys) {
    const rawValue = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${key}`);
    if (rawValue !== null) {
      try {
        result[key] = JSON.parse(rawValue);
      } catch {
        localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${key}`);
      }
    }
  }
  return result as Partial<T>;
}

export async function appStorageSet(values: StorageValues) {
  const chromeStorage = getChromeStorage();
  if (chromeStorage) {
    await chromeStorage.set(values);
    return;
  }

  const localStorage = getBrowserLocalStorage();
  if (!localStorage) {
    return;
  }

  for (const [key, value] of Object.entries(values)) {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${key}`, JSON.stringify(value));
  }
}

export async function appStorageRemove(keys: string[]) {
  const chromeStorage = getChromeStorage();
  if (chromeStorage) {
    await chromeStorage.remove(keys);
    return;
  }

  const localStorage = getBrowserLocalStorage();
  if (!localStorage) {
    return;
  }

  for (const key of keys) {
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${key}`);
  }
}
