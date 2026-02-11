// ... imports
export interface Prompt {
    id: string;
    title: string;
    content: string;
    category: string;
    isSystem?: boolean; // Default prompts cannot be deleted?
    lastUsed?: number;
}

export interface ServiceAdapter {
    id: string;
    name: string;
    url: string;
    icon?: string;
    userSelect?: boolean; // Prevent selection if needed
    permissions?: string[]; // permissions needed
    submitDelay?: number; // Optional custom delay for auto-submit

    // Selectors for DOM manipulation
    inputSelector: string;
    submitSelector: string;
    // Optional: wrapper selector to scope searches
    rootSelector?: string;
}

export interface ChatBot extends ServiceAdapter {
    isActive: boolean; // Is this bot currently visible in the grid?
    instanceId: string; // Unique ID for this specific instance (in case we allow multiple of same type)
}

// ... existing DEFAULT_ADAPTERS ...

// Preferences for adapters (sorting, pinning)
export interface AdapterPreference {
    id: string;
    isPinned?: boolean;
    order?: number;
}

// ============================================
// Storage Types - Chrome Storage 数据结构
// ============================================
export interface StorageData {
    customAdapters?: ServiceAdapter[];
    activeBots?: ChatBot[];
    isSyncEnabled?: boolean;
    prompts?: Prompt[];
    // Removed AdapterPreference as it's separate? No, keep it.
    adapterPreferences?: AdapterPreference[];
    activeBotIds?: string[]; // Actually stored key
}
export const DEFAULT_ADAPTERS: ServiceAdapter[] = [
    {
        id: 'chatgpt',
        name: 'ChatGPT',
        url: 'https://chatgpt.com',
        icon: 'Bot',
        inputSelector: 'textarea#prompt-textarea, #prompt-textarea',
        submitSelector: 'button[data-testid="send-button"]'
    },
    {
        id: 'claude',
        name: 'Claude',
        url: 'https://claude.ai',
        icon: 'Bot',
        inputSelector: 'div[contenteditable="true"].ProseMirror',
        submitSelector: 'button[aria-label="Send Message"]'
    },
    {
        id: 'gemini',
        name: 'Gemini',
        url: 'https://gemini.google.com',
        icon: 'Bot',
        inputSelector: 'div[contenteditable="true"][role="textbox"]',
        submitSelector: 'button[aria-label="Send message"]'
    },
    {
        id: 'copilot',
        name: 'Copilot',
        url: 'https://copilot.microsoft.com',
        icon: 'Bot',
        inputSelector: '#searchbox, textarea[id^="searchbox"]',
        submitSelector: 'button[aria-label="Submit"]'
    },
    {
        id: 'doubao',
        name: '豆包',
        url: 'https://www.doubao.com',
        icon: 'Bot',
        inputSelector: 'textarea.semi-input-textarea',
        submitSelector: '#flow-end-msg-send'
    },
    {
        id: 'qianwen',
        name: '千问',
        url: 'https://www.qianwen.com',
        icon: 'Bot',
        inputSelector: 'div[data-slate-editor="true"]',
        submitSelector: '.operateBtn-JsB9e2'
    },
    {
        id: 'yiyan',
        name: '文心一言',
        url: 'https://yiyan.baidu.com',
        icon: 'Bot',
        inputSelector: '.editable__QRoAFgYA, div[role="textbox"], div[contenteditable="true"]',
        submitSelector: 'div[class*="send-btn"], div[class*="submit"], button[class*="send"], div[role="button"]:not([disabled]) svg, .send-button'
    },
    {
        id: 'kimi',
        name: 'Kimi',
        url: 'https://www.kimi.com',
        icon: 'Bot',
        inputSelector: '.chat-input-editor',
        submitSelector: '.send-button-container'
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        url: 'https://chat.deepseek.com',
        icon: 'Bot',
        inputSelector: '#chat-input, textarea, div[contenteditable="true"][role="textbox"]',
        submitSelector: '' // Force Enter key - DeepSeek's button has framework-level state validation that blocks programmatic clicks
    },
    {
        id: 'chatglm',
        name: 'ChatGLM',
        url: 'https://chatglm.cn',
        icon: 'Bot',
        inputSelector: 'textarea, div[contenteditable="true"][role="textbox"]',
        submitSelector: 'button[type="submit"], button[aria-label*="发送" i], .enter-btn, div[class*="enter-btn"], div[class*="send-btn"]'
    }
];

// ============================================
// Message Types - 用于窗口间通信
// ============================================
export type MessageType =
    | 'USER_MESSAGE'           // 用户发送消息
    | 'INJECT_PROMPT'          // 注入提示词
    | 'DETECT_SELECTORS'       // 请求检测选择器
    | 'SELECTORS_DETECTED'     // 选择器检测结果
    | 'CONTENT_ERROR';         // Content Script 错误

export interface UserMessagePayload {
    text: string;
    autoSubmit: boolean;
}

export interface InjectPromptPayload {
    content: string;
}

export interface DetectedSelectorsPayload {
    inputSelector: string;
    submitSelector: string;
    confidence: number;
}

export interface ContentErrorPayload {
    error: string;
}

export type MessagePayload =
    | UserMessagePayload
    | InjectPromptPayload
    | DetectedSelectorsPayload
    | ContentErrorPayload;

export interface HubMessage<T extends MessageType = MessageType> {
    type: T;
    payload: T extends 'USER_MESSAGE' ? UserMessagePayload
    : T extends 'INJECT_PROMPT' ? InjectPromptPayload
    : T extends 'SELECTORS_DETECTED' ? DetectedSelectorsPayload
    : T extends 'CONTENT_ERROR' ? ContentErrorPayload
    : never;
}


