export type InputMethod = 'default' | 'text' | 'input' | 'paste' | 'pasteAndText';
export type SubmitMode = 'auto' | 'button' | 'enter';
export type SubmitVerificationMode = 'strict' | 'optimistic' | 'none';
export type UploadStrategy =
    | 'paste-first'
    | 'input-first'
    | 'drop-first'
    | 'input-only'
    | 'paste-only';
// Adapter 分类，用于模型栏分组
export type AdapterCategory =
    | 'general'
    | 'coding'
    | 'chinese'
    | 'search'
    | 'long-context'
    | 'custom';
// Adapter 稳定等级
export type StabilityLevel = 'stable' | 'medium' | 'fragile';

export interface SelectorLocator {
    selector: string;
    rootSelector?: SelectorSpec;
    inShadowDom?: boolean;
    shadowRootSelector?: SelectorSpec;
}

export type SelectorSpec = string | SelectorLocator | Array<string | SelectorLocator>;

export type AdapterActionType =
    | 'clickButtonByText'
    | 'findAndSetDataId'
    | 'findParentAndSetDataId'
    | 'findLastAndSetDataId'
    | 'waitForElement'
    | 'wait'
    | 'triggerClick';

export interface AdapterAction {
    type: AdapterActionType;
    params: Record<string, unknown>;
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
    inputSelector: SelectorSpec;
    submitSelector: SelectorSpec;
    readySelector?: SelectorSpec;
    // Optional: wrapper selector to scope searches
    rootSelector?: SelectorSpec;
    inputMethod?: InputMethod;
    firefoxInputMethod?: InputMethod;
    submitMode?: SubmitMode;
    submitVerificationMode?: SubmitVerificationMode;
    uploadStrategy?: UploadStrategy;
    readyActions?: AdapterAction[];
    inputActions?: AdapterAction[];
    sendActions?: AdapterAction[];
    newChatActions?: AdapterAction[];
    // 模型栏分组与展示（Phase 2）
    category?: AdapterCategory;
    displayName?: string;
    tags?: string[];
    stabilityLevel?: StabilityLevel;
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
    uiThemeVariant?: 'morandi' | 'bold';
    // Removed AdapterPreference as it's separate? No, keep it.
    adapterPreferences?: AdapterPreference[];
    activeBotIds?: string[]; // Actually stored key
}
export const DEFAULT_ADAPTERS: ServiceAdapter[] = [
    {
        id: 'chatgpt',
        name: 'gpt',
        url: 'https://web.tabbitbrowser.com/newtab',
        icon: 'Bot',
        inputSelector: '.ProseMirror, [data-placeholder="输入关键词搜索"]',
        submitSelector: 'button[label="ChatSendButton"]'
        ,
        category: 'general',
        tags: ['通用', '搜索'],
        stabilityLevel: 'medium'
    },
    {
        id: 'openai',
        name: 'OpenAI (ChatGPT)',
        url: 'https://chatgpt.com',
        icon: 'Bot',
        readySelector: [
            '#prompt-textarea',
            'textarea[data-testid="prompt-textarea"]',
            'form textarea'
        ],
        inputSelector: [
            '#prompt-textarea',
            'textarea[data-testid="prompt-textarea"]',
            'form textarea'
        ],
        submitSelector: [
            'button[data-testid="send-button"]',
            'button[aria-label*="Send" i]',
            'button[aria-label*="发送" i]'
        ],
        inputMethod: 'pasteAndText',
        submitMode: 'auto',
        submitVerificationMode: 'strict',
        uploadStrategy: 'input-first'
        ,
        category: 'general',
        tags: ['通用', '英文', '代码'],
        stabilityLevel: 'medium'
    },
    {
        id: 'claude',
        name: 'Claude',
        url: 'https://claude.ai',
        icon: 'Bot',
        inputSelector: 'div[contenteditable="true"].ProseMirror',
        submitSelector: 'button[aria-label="Send Message"]'
        ,
        category: 'general',
        tags: ['通用', '英文', '代码', '长文本'],
        stabilityLevel: 'stable'
    },
    {
        id: 'gemini',
        name: 'Gemini',
        url: 'https://gemini.google.com',
        icon: 'Bot',
        readySelector: [
            'rich-textarea div[contenteditable="true"]',
            'div[contenteditable="true"][role="textbox"]'
        ],
        inputSelector: [
            'rich-textarea div[contenteditable="true"]',
            'div[contenteditable="true"][role="textbox"]',
            'div[contenteditable="true"][aria-label*="Enter a prompt" i]'
        ],
        submitSelector: [
            'button[aria-label="Send message"]',
            'button[aria-label*="发送" i]',
            'button[mattooltip*="Send" i]'
        ],
        inputMethod: 'default',
        submitMode: 'button',
        submitVerificationMode: 'strict',
        uploadStrategy: 'paste-first'
        ,
        category: 'general',
        tags: ['通用', '英文', '长文本'],
        stabilityLevel: 'medium'
    },
    {
        id: 'copilot',
        name: 'Copilot',
        url: 'https://copilot.microsoft.com',
        icon: 'Bot',
        inputSelector: '#searchbox, textarea[id^="searchbox"]',
        submitSelector: 'button[aria-label="Submit"]'
        ,
        category: 'search',
        tags: ['搜索', '通用'],
        stabilityLevel: 'fragile'
    },
    {
        id: 'doubao',
        name: '豆包',
        url: 'https://www.doubao.com',
        icon: 'Bot',
        readySelector: [
            'textarea.semi-input-textarea',
            'textarea[placeholder*="发消息"]',
            'textarea'
        ],
        inputSelector: [
            'textarea.semi-input-textarea',
            'textarea[placeholder*="发消息"]',
            'textarea'
        ],
        submitSelector: [
            '[data-id="send-button"]',
            '#flow-end-msg-send',
            'button[id*="send"]',
            'button[aria-label*="发送" i]',
            'button[type="submit"]'
        ],
        inputMethod: 'input',
        submitMode: 'auto',
        submitVerificationMode: 'strict',
        uploadStrategy: 'input-first',
        sendActions: [
            {
                type: 'findAndSetDataId',
                params: {
                    selector: [
                        '#flow-end-msg-send',
                        'button[id*="send"]',
                        'button[aria-label*="发送" i]',
                        'button[type="submit"]'
                    ],
                    dataId: 'send-button'
                }
            }
        ]
        ,
        category: 'chinese',
        tags: ['中文', '通用'],
        stabilityLevel: 'medium'
    },
    {
        id: 'qianwen',
        name: '千问',
        url: 'https://www.qianwen.com',
        icon: 'Bot',
        readySelector: [
            'div[data-slate-editor="true"]',
            'div[contenteditable="true"][data-slate-editor="true"]',
            'div[contenteditable="true"][role="textbox"]'
        ],
        inputSelector: [
            'div[data-slate-editor="true"]',
            'div[contenteditable="true"][data-slate-editor="true"]',
            'div[contenteditable="true"][role="textbox"]'
        ],
        submitSelector: [
            '[data-id="send-button"]',
            '.operateBtn-JsB9e2',
            'button[class*="operateBtn"]',
            'button[aria-label*="发送" i]',
            'button[type="submit"]'
        ],
        inputMethod: 'pasteAndText',
        submitMode: 'auto',
        submitVerificationMode: 'optimistic',
        uploadStrategy: 'paste-first',
        sendActions: [
            {
                type: 'findAndSetDataId',
                params: {
                    selector: [
                        '.operateBtn-JsB9e2',
                        'button[class*="operateBtn"]',
                        'button[aria-label*="发送" i]',
                        'button[type="submit"]'
                    ],
                    dataId: 'send-button'
                }
            }
        ]
        ,
        category: 'chinese',
        tags: ['中文', '通用', '长文本'],
        stabilityLevel: 'medium'
    },
    {
        id: 'yiyan',
        name: '文心一言',
        url: 'https://yiyan.baidu.com',
        icon: 'Bot',
        inputSelector: '.editable__QRoAFgYA, div[role="textbox"], div[contenteditable="true"]',
        submitSelector: 'div[class*="send-btn"], div[class*="submit"], button[class*="send"], div[role="button"]:not([disabled]) svg, .send-button'
        ,
        category: 'chinese',
        tags: ['中文', '通用'],
        stabilityLevel: 'fragile'
    },
    {
        id: 'kimi',
        name: 'Kimi',
        url: 'https://www.kimi.com',
        icon: 'Bot',
        inputSelector: '.chat-input-editor',
        submitSelector: '.send-button-container'
        ,
        category: 'chinese',
        tags: ['中文', '长文本'],
        stabilityLevel: 'medium'
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        url: 'https://chat.deepseek.com',
        icon: 'Bot',
        inputSelector: '#chat-input, textarea, div[contenteditable="true"][role="textbox"]',
        submitSelector: '' // Force Enter key - DeepSeek's button has framework-level state validation that blocks programmatic clicks
        ,
        category: 'coding',
        tags: ['代码', '中文', '通用'],
        stabilityLevel: 'medium'
    },
    {
        id: 'chatglm',
        name: 'ChatGLM',
        url: 'https://chatglm.cn',
        icon: 'Bot',
        readySelector: [
            'div[contenteditable="true"][role="textbox"]',
            'textarea',
            'div[contenteditable="true"]'
        ],
        inputSelector: [
            'div[contenteditable="true"][role="textbox"]',
            'textarea',
            'div[contenteditable="true"]'
        ],
        submitSelector: [
            '[data-id="send-button"]',
            'button[type="submit"]',
            'button[aria-label*="发送" i]',
            '.enter-btn',
            'div[class*="enter-btn"]',
            'div[class*="send-btn"]'
        ],
        inputMethod: 'default',
        submitMode: 'auto',
        submitVerificationMode: 'optimistic',
        uploadStrategy: 'input-first',
        sendActions: [
            {
                type: 'findAndSetDataId',
                params: {
                    selector: [
                        'button[type="submit"]',
                        'button[aria-label*="发送" i]',
                        '.enter-btn',
                        'div[class*="enter-btn"]',
                        'div[class*="send-btn"]'
                    ],
                    dataId: 'send-button'
                }
            }
        ]
        ,
        category: 'chinese',
        tags: ['中文', '代码'],
        stabilityLevel: 'medium'
    }
];

// ============================================
// Message Types - 用于窗口间通信
// ============================================
export type MessageType =
    | 'USER_MESSAGE'           // 用户发送消息
    | 'INJECT_PROMPT'          // 注入提示词
    | 'CONTENT_ERROR';         // Content Script 错误

export interface UserMessagePayload {
    text: string;
    autoSubmit: boolean;
    files?: {
        name: string;
        type: string;
        data: string; // Base64
    }[];
}

export interface InjectPromptPayload {
    content: string;
}

export interface ContentErrorPayload {
    error: string;
}

export type MessagePayload =
    | UserMessagePayload
    | InjectPromptPayload
    | ContentErrorPayload;

export interface HubMessage<T extends MessageType = MessageType> {
    type: T;
    payload: T extends 'USER_MESSAGE' ? UserMessagePayload
    : T extends 'INJECT_PROMPT' ? InjectPromptPayload
    : T extends 'CONTENT_ERROR' ? ContentErrorPayload
    : never;
}
