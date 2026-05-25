import { DEFAULT_ADAPTERS, type ServiceAdapter } from '../types';

const CONTENT_SCRIPT_ID = 'chathub-main-content';

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function toMatchPattern(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '/';
    const normalizedPath = pathname.endsWith('*')
      ? pathname
      : pathname.endsWith('/')
        ? `${pathname}*`
        : `${pathname}*`;
    return `${parsed.protocol}//${parsed.host}${normalizedPath}`;
  } catch {
    return null;
  }
}

async function getCustomAdapters(): Promise<ServiceAdapter[]> {
  const storage = await chrome.storage.local.get(['customAdapters']);
  return (storage.customAdapters as ServiceAdapter[]) || [];
}

async function getAllAdapters(): Promise<ServiceAdapter[]> {
  const customAdapters = await getCustomAdapters();
  return [...DEFAULT_ADAPTERS, ...customAdapters];
}

async function updateRules() {
  try {
    const adapters = await getAllAdapters();
    const domains = Array.from(
      new Set(adapters.map((adapter) => extractDomain(adapter.url)).filter(Boolean))
    );

    const rules: chrome.declarativeNetRequest.Rule[] = domains.length
      ? [{
          id: 1,
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            responseHeaders: [
              { header: 'X-Frame-Options', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
              { header: 'Content-Security-Policy', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
              { header: 'Frame-Options', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
            ],
          },
          condition: {
            requestDomains: domains,
            resourceTypes: [chrome.declarativeNetRequest.ResourceType.SUB_FRAME],
          },
        }]
      : [];

    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRules.map((rule) => rule.id),
      addRules: rules,
    });

    console.log('[ChatHub] Dynamic rules refreshed for adapters:', domains);
  } catch (error) {
    console.error('[ChatHub] Failed to refresh DNR rules:', error);
  }
}

async function resolveContentScriptFiles() {
  const runtimeManifest = chrome.runtime.getManifest();
  const manifestDeclaredFiles = runtimeManifest.content_scripts?.flatMap((script) => script.js ?? []) ?? [];
  if (manifestDeclaredFiles.length > 0) {
    return manifestDeclaredFiles;
  }

  const response = await fetch(chrome.runtime.getURL('.vite/manifest.json'));
  const manifest = await response.json() as Record<string, { file?: string; src?: string }>;

  const loaderEntry = Object.entries(manifest).find(([key, value]) => {
    return key.startsWith('_index.ts-loader') || value.file?.includes('index.ts-loader');
  });

  if (loaderEntry?.[1]?.file) {
    return [loaderEntry[1].file];
  }

  const directEntry = manifest['src/content/index.ts']?.file;
  if (directEntry) {
    return [directEntry];
  }

  throw new Error('CONTENT_SCRIPT_FILE_NOT_FOUND');
}

async function updateContentScriptRegistrations() {
  try {
    const adapters = await getAllAdapters();
    const matches = Array.from(
      new Set(adapters.map((adapter) => toMatchPattern(adapter.url)).filter(Boolean))
    ) as string[];

    const js = await resolveContentScriptFiles();
    const existingScripts = await chrome.scripting.getRegisteredContentScripts();
    if (existingScripts.length > 0) {
      await chrome.scripting.unregisterContentScripts({
        ids: existingScripts.map((script) => script.id),
      });
    }

    if (!matches.length) {
      return;
    }

    await chrome.scripting.registerContentScripts([{
      id: CONTENT_SCRIPT_ID,
      matches,
      js,
      allFrames: true,
      runAt: 'document_idle',
    }]);

    console.log('[ChatHub] Registered dynamic content script for matches:', matches);
  } catch (error) {
    console.error('[ChatHub] Failed to register content scripts:', error);
  }
}

async function reloadExtensionConfig() {
  await Promise.all([
    updateRules(),
    updateContentScriptRegistrations(),
  ]);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') {
    return;
  }

  if (changes.customAdapters) {
    void reloadExtensionConfig();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ChatHub] Extension installed, refreshing dynamic registrations...');
  void reloadExtensionConfig();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[ChatHub] Browser started, refreshing dynamic registrations...');
  void reloadExtensionConfig();
});

function isAIPlatform(url: string, adapters: ServiceAdapter[]): boolean {
  try {
    const hostname = new URL(url).hostname;
    return adapters.some(adapter => {
      try {
        const adapterHostname = new URL(adapter.url).hostname;
        return hostname === adapterHostname || hostname.endsWith('.' + adapterHostname);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

async function getAITabsInWindow(windowId: number | undefined, adapters: ServiceAdapter[]): Promise<chrome.tabs.Tab[]> {
  if (windowId === undefined) return [];
  const tabs = await chrome.tabs.query({ windowId });
  return tabs.filter(tab => tab.url && isAIPlatform(tab.url, adapters));
}

async function broadcastToAITabs(text: string, autoSubmit: boolean, windowId: number | undefined) {
  const adapters = await getAllAdapters();
  const tabs = await getAITabsInWindow(windowId, adapters);
  
  const results = [];
  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      const commandId = Math.random().toString(36).substring(7);
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'EXECUTE_COMMAND',
        payload: {
          commandId,
          text,
          autoSubmit,
          timestamp: Date.now()
        }
      }) as { success: boolean; error?: string } | undefined;

      if (response && response.success) {
        results.push({ tabId: tab.id, success: true });
      } else {
        results.push({ tabId: tab.id, success: false, error: response?.error || 'Execution failed' });
      }
    } catch (err) {
      console.warn(`[ChatHub] Failed to send message to tab ${tab.id}:`, err);
      results.push({ tabId: tab.id, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  // Notify tabs of results (e.g. to show Success/Failed toasts)
  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'BROADCAST_RESULT',
        payload: {
          results,
          totalSent: results.filter(r => r.success).length,
          totalFailed: results.filter(r => !r.success).length
        }
      });
    } catch {
      // Ignore
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'RELOAD_EXTENSION_CONFIG') {
    void reloadExtensionConfig()
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        });
      });
    return true;
  }

  if (message?.type === 'BROADCAST_MESSAGE') {
    const { text, autoSubmit } = message.payload || {};
    const windowId = sender.tab?.windowId;
    broadcastToAITabs(text, autoSubmit ?? true, windowId)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }));
    return true;
  }

  if (message?.type === 'GET_STATUS') {
    const windowId = sender.tab?.windowId;
    getAllAdapters().then(adapters => {
      getAITabsInWindow(windowId, adapters).then(tabs => {
        sendResponse({
          tabCount: tabs.length,
          platforms: tabs.map(t => ({
            id: t.id,
            url: t.url || '',
            title: t.title || ''
          }))
        });
      });
    });
    return true;
  }

  return false;
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('index.html'),
  });
});
