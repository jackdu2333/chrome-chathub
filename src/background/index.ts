import { DEFAULT_ADAPTERS, type ServiceAdapter } from '../types';

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

// v1.2: 检测 Chrome 版本，< 101 使用 domains 代替 initiatorDomains
const chromeVersion = parseInt(
  (navigator.userAgent.toLowerCase().match(/chrome\/(\d+)/)?.[1]) ?? '0', 10
);

/**
 * 构建 Sec-Fetch header 修改规则（解决 Storage Partitioning 导致的 iframe 登录态隔离）
 * 参考 Simple Chat Hub 的方案：将 Sec-Fetch-Dest 改为 document，Sec-Fetch-Site 改为 same-origin
 */
function buildSecFetchRule(
  initiatorHostnames: string[],
  resourceTypes?: chrome.declarativeNetRequest.ResourceType[]
): chrome.declarativeNetRequest.Rule {
  const condition: Record<string, unknown> = { initiatorDomains: initiatorHostnames };
  if (resourceTypes) {
    condition.resourceTypes = resourceTypes;
  }
  // Chrome < 101 不支持 initiatorDomains，回退到 domains
  if (chromeVersion !== 0 && chromeVersion < 101) {
    condition.domains = condition.initiatorDomains;
    delete condition.initiatorDomains;
  }
  return {
    id: 0, // 调用方会重新分配 id
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      requestHeaders: [
        { header: 'Sec-Fetch-Dest', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: 'document' },
        { header: 'Sec-Fetch-Site', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: 'same-origin' },
      ],
      responseHeaders: [
        { header: 'X-Frame-Options', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
        { header: 'Content-Security-Policy', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
      ],
    },
    condition: condition as chrome.declarativeNetRequest.RuleCondition,
  };
}

async function updateRules() {
  try {
    const adapters = await getAllAdapters();
    const domains = Array.from(
      new Set(adapters.map((adapter) => extractDomain(adapter.url)).filter(Boolean))
    );

    const rules: chrome.declarativeNetRequest.Rule[] = [];

    // 规则 1: 移除 iframe 嵌入限制（X-Frame-Options / CSP）
    if (domains.length) {
      rules.push({
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
      });
    }

    // v1.2: Sec-Fetch header 修改 — 解决 Storage Partitioning 导致的 cookie 分区
    const extensionHostname = new URL(chrome.runtime.getURL('')).hostname;

    // 规则 2: 扩展自身发起的请求（iframe 内的子资源请求）
    const extRule = buildSecFetchRule([extensionHostname]);
    extRule.id = 2;
    rules.push(extRule);

    // 规则 3: AI 平台域名的 sub_frame 请求
    if (domains.length) {
      const subFrameRule = buildSecFetchRule(
        domains.map(d => d),
        [chrome.declarativeNetRequest.ResourceType.SUB_FRAME]
      );
      subFrameRule.id = 3;
      rules.push(subFrameRule);
    }

    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRules.map((rule) => rule.id),
      addRules: rules,
    });

    console.log('[ChatHub] Dynamic rules refreshed for adapters:', domains, '| Sec-Fetch rules: enabled');
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

const DEFAULT_DOMAIN_PATTERNS = new Set(
  DEFAULT_ADAPTERS.map(a => toMatchPattern(a.url)).filter(Boolean) as string[]
);

const CUSTOM_SCRIPT_ID = 'chathub-custom-content';

async function updateContentScriptRegistrations() {
  try {
    const adapters = await getAllAdapters();
    const allMatches = Array.from(
      new Set(adapters.map((adapter) => toMatchPattern(adapter.url)).filter(Boolean))
    ) as string[];

    // 只注册自定义域名（不在静态 manifest matches 中的）
    const customMatches = allMatches.filter(m => !DEFAULT_DOMAIN_PATTERNS.has(m));

    // 过滤掉未授权的自定义域名
    const authorizedCustom: string[] = [];
    for (const match of customMatches) {
      try {
        const hasPermission = await chrome.permissions.contains({ origins: [match] });
        if (hasPermission) {
          authorizedCustom.push(match);
        } else {
          console.warn('[ChatHub] Skipping unauthorized custom match:', match);
        }
      } catch {
        authorizedCustom.push(match);
      }
    }

    // 清理旧的自定义注册
    try {
      const existing = await chrome.scripting.getRegisteredContentScripts();
      const customScripts = existing.filter(s => s.id === CUSTOM_SCRIPT_ID);
      if (customScripts.length > 0) {
        await chrome.scripting.unregisterContentScripts({ ids: [CUSTOM_SCRIPT_ID] });
      }
    } catch {
      // ignore
    }

    if (!authorizedCustom.length) {
      console.log('[ChatHub] No custom domains to register dynamically');
      return;
    }

    const js = await resolveContentScriptFiles();
    await chrome.scripting.registerContentScripts([{
      id: CUSTOM_SCRIPT_ID,
      matches: authorizedCustom,
      js,
      allFrames: true,
      runAt: 'document_idle',
    }]);

    console.log('[ChatHub] Registered dynamic content script for custom domains:', authorizedCustom);
  } catch (error) {
    console.error('[ChatHub] Failed to register custom content scripts:', error);
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
