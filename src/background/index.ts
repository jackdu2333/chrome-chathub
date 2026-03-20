const RULE_ID = 1;

// Domains to strip headers from (to allow iframing)
const DEFAULT_AI_DOMAINS = [
    "chatgpt.com",
    "gemini.google.com",
    "claude.ai",
    "copilot.microsoft.com",
    "chat.openai.com",
    "web.tabbitbrowser.com"
];

// Extract domain from URL
function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return '';
    }
}

// Get all domains (default + custom)
async function getAllDomains(): Promise<string[]> {
    const storage = await chrome.storage.local.get(['customDomains']);
    const customDomains: string[] = (storage.customDomains as string[]) || [];
    return [...DEFAULT_AI_DOMAINS, ...customDomains];
}

// Update declarativeNetRequest rules
async function updateRules() {
    try {
        const domains = await getAllDomains();
        console.log('[ChatHub] Updating rules for domains:', domains);

        // Create a single rule for all domains
        const rules: chrome.declarativeNetRequest.Rule[] = [{
            id: RULE_ID,
            priority: 1,
            action: {
                type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                responseHeaders: [
                    { header: 'X-Frame-Options', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
                    { header: 'Content-Security-Policy', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
                    { header: 'Frame-Options', operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE }
                ]
            },
            condition: {
                requestDomains: domains,
                resourceTypes: [chrome.declarativeNetRequest.ResourceType.SUB_FRAME]
            }
        }];

        // Clear all dynamic rules first
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const existingRuleIds = existingRules.map(r => r.id);

        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRuleIds,
            addRules: rules
        });

        console.log('[ChatHub] ✅ Rules updated successfully for', domains.length, 'domains');
        console.log('[ChatHub] Active rules:', await chrome.declarativeNetRequest.getDynamicRules());
    } catch (error) {
        console.error('[ChatHub] ❌ Error updating rules:', error);
    }
}

// Listen for messages from the app to add custom domains
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'ADD_CUSTOM_DOMAIN') {
        const domain = extractDomain(message.url);
        if (domain) {
            chrome.storage.local.get(['customDomains'], (result) => {
                const customDomains: string[] = (result.customDomains as string[]) || [];
                if (!customDomains.includes(domain) && !DEFAULT_AI_DOMAINS.includes(domain)) {
                    customDomains.push(domain);
                    chrome.storage.local.set({ customDomains }, () => {
                        updateRules();
                        sendResponse({ success: true });
                    });
                } else {
                    sendResponse({ success: true, message: 'Domain already exists' });
                }
            });
            return true; // Keep message channel open for async response
        }
    }
});

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
    console.log('[ChatHub] Extension installed, updating rules...');
    updateRules();
});

// Re-apply rules on startup
chrome.runtime.onStartup.addListener(() => {
    console.log('[ChatHub] Browser started, updating rules...');
    updateRules();
});

// Handle extension icon click - Open ChatHub in a new tab
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({
        url: chrome.runtime.getURL('index.html')
    });
});
