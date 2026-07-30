import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  assertCommandNotExpired,
  createCommandDeadline,
  isCommandExpirationError,
  isCommandExpired,
} from '../src/runtime/commandDeadline.ts';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

test('packaged extension has no global static DNR or static content script', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../dist/manifest.json', import.meta.url), 'utf8')
  );

  assert.equal(manifest.declarative_net_request, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(existsSync(new URL('../dist/src/rules.json', import.meta.url)), false);

  const assetNames = readdirSync(new URL('../dist/assets', import.meta.url));
  const loaderNames = assetNames.filter((name) => name.includes('index.ts-loader'));
  assert.equal(loaderNames.length, 1);

  const backgroundBundle = assetNames
    .filter((name) => name.endsWith('.js'))
    .map((name) => readFileSync(`${projectRoot}/dist/assets/${name}`, 'utf8'))
    .find((source) => source.includes('chathub-main-content'));

  assert.ok(backgroundBundle, 'background bundle should register the content script');
  assert.match(backgroundBundle, /requestDomains/);
  assert.doesNotMatch(backgroundBundle, /urlFilter:\s*["']\*["']/);
});

test('built service worker registers domain-scoped rules and one content script', async () => {
  const assetNames = readdirSync(new URL('../dist/assets', import.meta.url));
  const backgroundAssetName = assetNames.find((name) => {
    if (!name.endsWith('.js')) {
      return false;
    }
    return readFileSync(`${projectRoot}/dist/assets/${name}`, 'utf8').includes('chathub-main-content');
  });
  assert.ok(backgroundAssetName);

  let installedListener;
  let dynamicRuleUpdate;
  let registeredScripts;

  globalThis.chrome = {
    storage: {
      local: {
        get: async () => ({ customAdapters: [] }),
      },
      onChanged: { addListener: () => {} },
    },
    declarativeNetRequest: {
      RuleActionType: { MODIFY_HEADERS: 'modifyHeaders' },
      HeaderOperation: { REMOVE: 'remove', SET: 'set' },
      ResourceType: { SUB_FRAME: 'sub_frame' },
      getDynamicRules: async () => [],
      updateDynamicRules: async (update) => {
        dynamicRuleUpdate = update;
      },
    },
    scripting: {
      getRegisteredContentScripts: async () => [],
      unregisterContentScripts: async () => {},
      registerContentScripts: async (scripts) => {
        registeredScripts = scripts;
      },
    },
    permissions: {
      contains: async () => true,
    },
    runtime: {
      onInstalled: {
        addListener: (listener) => {
          installedListener = listener;
        },
      },
      onStartup: { addListener: () => {} },
      onMessage: { addListener: () => {} },
      getURL: (path) => `chrome-extension://test/${path}`,
    },
    action: { onClicked: { addListener: () => {} } },
    tabs: { create: () => {} },
  };

  await import(`${pathToFileURL(`${projectRoot}/dist/assets/${backgroundAssetName}`).href}?test=p0`);
  assert.equal(typeof installedListener, 'function');
  installedListener();

  for (let attempt = 0; attempt < 20 && (!dynamicRuleUpdate || !registeredScripts); attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }

  assert.equal(dynamicRuleUpdate.addRules.length, 3);
  const dynamicRule = dynamicRuleUpdate.addRules.find((rule) => rule.condition.requestDomains);
  assert.ok(dynamicRule);
  assert.equal(dynamicRule.condition.urlFilter, undefined);
  assert.ok(dynamicRule.condition.requestDomains.includes('chatgpt.com'));
  assert.equal(dynamicRule.action.responseHeaders.length, 3);

  assert.equal(registeredScripts.length, 1);
  const [registeredScript] = registeredScripts;
  assert.equal(registeredScript.id, 'chathub-main-content');
  assert.equal(registeredScript.js.length, 1);
  assert.equal(registeredScript.allFrames, true);
  assert.equal(registeredScript.matchOriginAsFallback, true);
  assert.ok(registeredScript.matches.includes('https://chatgpt.com/*'));
  assert.ok(registeredScript.matches.every((pattern) => pattern.endsWith('/*')));

  delete globalThis.chrome;
});

test('command deadline preserves a legitimate command before expiry', () => {
  const expiresAt = createCommandDeadline(20_000, 1_000);
  let executed = false;

  assert.equal(isCommandExpired(expiresAt, 20_999), false);
  assert.doesNotThrow(() => assertCommandNotExpired(expiresAt, 20_999));
  executed = true;

  assert.equal(executed, true);
});

test('expired queued command is rejected before execution', () => {
  const expiresAt = createCommandDeadline(20_000, 1_000);
  let executed = false;

  const executeQueuedCommand = () => {
    assertCommandNotExpired(expiresAt, 21_000);
    executed = true;
  };

  assert.throws(executeQueuedCommand, /COMMAND_EXPIRED/);
  assert.equal(executed, false);
  assert.equal(isCommandExpirationError(new Error('COMMAND_EXPIRED')), true);
  assert.equal(isCommandExpirationError(new Error('INPUT_NOT_FOUND')), false);
});

test('command without a finite deadline is rejected', () => {
  assert.throws(() => assertCommandNotExpired(Number.NaN), /COMMAND_INVALID_DEADLINE/);
  assert.throws(() => assertCommandNotExpired(Number.POSITIVE_INFINITY), /COMMAND_INVALID_DEADLINE/);
});
