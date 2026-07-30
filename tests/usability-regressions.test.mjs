import assert from 'node:assert/strict';
import test from 'node:test';
import { appStorageGet, appStorageRemove, appStorageSet } from '../src/lib/appStorage.ts';
import {
  MAX_FILE_COUNT,
  MAX_FILE_SIZE_BYTES,
  MAX_TOTAL_FILE_SIZE_BYTES,
  validateUploadSelection,
} from '../src/lib/uploadLimits.ts';
import { supportsGenericFileUpload } from '../src/content/drivers/genericCapabilities.ts';
import { DEFAULT_ADAPTERS } from '../src/types.ts';

function createMemoryLocalStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('local development storage falls back without chrome.storage', async () => {
  globalThis.window = { localStorage: createMemoryLocalStorage() };
  delete globalThis.chrome;

  await appStorageSet({
    activeBotIds: ['openai', 'claude'],
    isSyncEnabled: false,
    themeMode: 'dark',
    uiThemeVariant: 'bold',
  });
  assert.deepEqual(
    await appStorageGet(['activeBotIds', 'isSyncEnabled', 'themeMode', 'uiThemeVariant']),
    {
      activeBotIds: ['openai', 'claude'],
      isSyncEnabled: false,
      themeMode: 'dark',
      uiThemeVariant: 'bold',
    }
  );

  await appStorageSet({ activeBotIds: [] });
  assert.deepEqual(await appStorageGet(['activeBotIds']), { activeBotIds: [] });

  await appStorageRemove(['activeBotIds']);
  assert.deepEqual(await appStorageGet(['activeBotIds']), {});
  delete globalThis.window;
});

test('upload selection enforces count, per-file, and total-size limits', () => {
  const normalFile = { name: 'normal.pdf', size: 1024 };

  assert.equal(validateUploadSelection([], [normalFile]), null);
  assert.deepEqual(
    validateUploadSelection(
      Array.from({ length: MAX_FILE_COUNT }, (_, index) => ({ name: `${index}.txt`, size: 1 })),
      [normalFile]
    ),
    { code: 'TOO_MANY_FILES' }
  );
  assert.deepEqual(
    validateUploadSelection([], [{ name: 'large.pdf', size: MAX_FILE_SIZE_BYTES + 1 }]),
    { code: 'FILE_TOO_LARGE', fileName: 'large.pdf' }
  );
  assert.deepEqual(
    validateUploadSelection(
      [{ name: 'existing.bin', size: MAX_TOTAL_FILE_SIZE_BYTES }],
      [normalFile]
    ),
    { code: 'TOTAL_TOO_LARGE' }
  );
});

test('generic driver only advertises explicitly configured file upload', () => {
  const genericAdapter = {
    id: 'custom',
    name: 'Custom',
    url: 'https://example.com',
    inputSelector: 'textarea',
    submitSelector: 'button',
  };

  assert.equal(supportsGenericFileUpload(genericAdapter), false);
  assert.equal(supportsGenericFileUpload({ ...genericAdapter, uploadStrategy: 'input-only' }), true);
});

test('removed Tabbit GPT model is not shipped as a built-in adapter', () => {
  assert.equal(DEFAULT_ADAPTERS.some((adapter) => adapter.id === 'chatgpt'), false);
  assert.equal(
    DEFAULT_ADAPTERS.some((adapter) => new URL(adapter.url).hostname === 'web.tabbitbrowser.com'),
    false
  );
});
