import { create } from 'zustand';
import { AdapterPreference, ChatBot, DEFAULT_ADAPTERS, ServiceAdapter, StorageData, Prompt } from './types';

const DEFAULT_PROMPTS: Prompt[] = [
    { id: '1', title: '代码审查', content: '请审查此代码，找出错误和性能问题。', category: '编程', isSystem: true },
    { id: '2', title: '内容总结', content: '请用三点总结以下文本。', category: '写作', isSystem: true },
    { id: '3', title: '简单解释', content: '请像对五岁孩子一样解释这个概念。', category: '学习', isSystem: true },
];

interface AppState {
    activeBots: ChatBot[];
    availableAdapters: ServiceAdapter[];
    adapterPreferences: AdapterPreference[];
    isSyncEnabled: boolean;
    gridLayout: 'single' | 'split' | 'grid';
    isDarkMode: boolean;

    // Prompts
    prompts: Prompt[];
    draftContent: string;

    toggleBot: (adapterId: string) => void;
    setSyncEnabled: (enabled: boolean) => void;
    setGridLayout: (layout: 'single' | 'split' | 'grid') => void;
    setDraftContent: (content: string) => void;
    setDarkMode: (isDark: boolean) => void;

    // Prompts Actions
    addPrompt: (prompt: Prompt) => void;
    updatePrompt: (id: string, updates: Partial<Prompt>) => void;
    deletePrompt: (id: string) => void;
    loadPrompts: () => Promise<void>;
    reloadAllBots: () => void;
    addCustomAdapter: (adapter: ServiceAdapter) => void;
    removeCustomAdapter: (id: string) => void;
    updateCustomAdapter: (id: string, adapter: ServiceAdapter) => void;
    loadCustomAdapters: () => Promise<void>;
    loadActiveBots: () => Promise<void>;
    saveActiveBots: () => void;

    // Preferences
    loadPreferences: () => Promise<void>;
    togglePin: (id: string) => void;
    updateAdapterOrder: (id: string, newOrder: number) => void;

    // Drag & Drop Reordering
    reorderBots: (oldIndex: number, newIndex: number) => void;
}

export const useStore = create<AppState>((set, get) => ({
    // Initial state - will be overridden by loadActiveBots
    // Initial state - will be overridden by loadActiveBots
    activeBots: [],
    availableAdapters: DEFAULT_ADAPTERS,
    adapterPreferences: [],
    isSyncEnabled: true,
    gridLayout: 'split',
    isDarkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    prompts: [],
    draftContent: '',

    reorderBots: (oldIndex, newIndex) => {
        set((state) => {
            // Import arrayMove dynamically here or use inline implementation
            const items = Array.from(state.activeBots);
            const [removed] = items.splice(oldIndex, 1);
            items.splice(newIndex, 0, removed);

            // Persist the new order
            setTimeout(() => get().saveActiveBots(), 0);

            return { activeBots: items };
        });
    },

    toggleBot: (adapterId) => {
        set((state) => {
            const isAlreadyActive = state.activeBots.some(b => b.id === adapterId);

            let newActiveBots;
            if (isAlreadyActive) {
                newActiveBots = state.activeBots.filter(b => b.id !== adapterId);
            } else {
                const adapter = state.availableAdapters.find(a => a.id === adapterId);
                if (!adapter) return state;

                const newBot: ChatBot = {
                    ...adapter,
                    isActive: true,
                    instanceId: crypto.randomUUID()
                };
                newActiveBots = [...state.activeBots, newBot];
            }

            return { activeBots: newActiveBots };
        });

        // Save to storage after state update
        setTimeout(() => get().saveActiveBots(), 0);
    },

    setSyncEnabled: (enabled) => set({ isSyncEnabled: enabled }),
    setGridLayout: (layout) => set({ gridLayout: layout }),
    setDraftContent: (content) => set({ draftContent: content }),
    setDarkMode: (isDark) => set({ isDarkMode: isDark }),

    addPrompt: (prompt) => {
        set((state) => {
            const newPrompts = [...state.prompts, prompt];
            chrome.storage.local.set({ prompts: newPrompts });
            return { prompts: newPrompts };
        });
    },

    updatePrompt: (id, updates) => {
        set((state) => {
            const newPrompts = state.prompts.map(p => p.id === id ? { ...p, ...updates } : p);
            chrome.storage.local.set({ prompts: newPrompts });
            return { prompts: newPrompts };
        });
    },

    deletePrompt: (id) => {
        set((state) => {
            const newPrompts = state.prompts.filter(p => p.id !== id);
            chrome.storage.local.set({ prompts: newPrompts });
            return { prompts: newPrompts };
        });
    },

    loadPrompts: async () => {
        try {
            const result = await chrome.storage.local.get(['prompts']) as Partial<StorageData>;
            if (result.prompts && result.prompts.length > 0) {
                set({ prompts: result.prompts });
                console.log('[ChatHub] Loaded prompts:', result.prompts.length);
            } else {
                set({ prompts: DEFAULT_PROMPTS });
                console.log('[ChatHub] Using default prompts');
            }
        } catch (error) {
            console.error('[ChatHub] Failed to load prompts:', error);
            set({ prompts: DEFAULT_PROMPTS });
        }
    },

    reloadAllBots: () => {
        set(state => ({
            activeBots: state.activeBots.map(bot => ({
                ...bot,
                instanceId: crypto.randomUUID()
            }))
        }));
    },

    addCustomAdapter: (adapter) => {
        const state = get();
        if (state.availableAdapters.some(a => a.id === adapter.id)) {
            return;
        }

        // Notify background script to add domain to rules
        chrome.runtime.sendMessage({
            type: 'ADD_CUSTOM_DOMAIN',
            url: adapter.url
        }, (response) => {
            console.log('[ChatHub] Domain added:', response);
        });

        const newAdapters = [...state.availableAdapters, adapter];
        set({ availableAdapters: newAdapters });

        // Save custom adapters to storage
        const customAdapters = newAdapters.filter(a =>
            !DEFAULT_ADAPTERS.some(defaultAdapter => defaultAdapter.id === a.id)
        );
        chrome.storage.local.set({ customAdapters }, () => {
            if (chrome.runtime.lastError) {
                console.error('[ChatHub] Failed to save custom adapters:', chrome.runtime.lastError);
                return;
            }
            console.log('[ChatHub] Custom adapters saved:', customAdapters.length);
        });
    },

    removeCustomAdapter: (id) => {
        const state = get();

        // Don't allow removing default adapters
        const isDefault = DEFAULT_ADAPTERS.some(a => a.id === id);
        if (isDefault) {
            console.warn('[ChatHub] Cannot remove default adapter:', id);
            return;
        }

        // Remove from available adapters
        const newAdapters = state.availableAdapters.filter(a => a.id !== id);
        set({ availableAdapters: newAdapters });

        // Remove from active bots if it's currently open
        const newActiveBots = state.activeBots.filter(b => b.id !== id);
        set({ activeBots: newActiveBots });

        // Update storage
        const customAdapters = newAdapters.filter(a =>
            !DEFAULT_ADAPTERS.some(defaultAdapter => defaultAdapter.id === a.id)
        );
        chrome.storage.local.set({ customAdapters }, () => {
            if (chrome.runtime.lastError) {
                console.error('[ChatHub] Failed to remove custom adapter:', chrome.runtime.lastError);
                return;
            }
            console.log('[ChatHub] Custom adapter removed:', id);
        });
    },

    updateCustomAdapter: (id, updatedAdapter) => {
        const state = get();

        // Don't allow updating default adapters
        const isDefault = DEFAULT_ADAPTERS.some(a => a.id === id);
        if (isDefault) {
            console.warn('[ChatHub] Cannot update default adapter:', id);
            return;
        }

        // Update in available adapters
        const newAdapters = state.availableAdapters.map(a =>
            a.id === id ? updatedAdapter : a
        );
        set({ availableAdapters: newAdapters });

        // Update in active bots if it's currently open (reload it)
        const newActiveBots = state.activeBots.map(b =>
            b.id === id ? {
                ...updatedAdapter,
                isActive: true,
                instanceId: crypto.randomUUID() // Force reload
            } : b
        );
        set({ activeBots: newActiveBots });

        // Update storage
        const customAdapters = newAdapters.filter(a =>
            !DEFAULT_ADAPTERS.some(defaultAdapter => defaultAdapter.id === a.id)
        );
        chrome.storage.local.set({ customAdapters }, () => {
            if (chrome.runtime.lastError) {
                console.error('[ChatHub] Failed to update custom adapter:', chrome.runtime.lastError);
                return;
            }
            console.log('[ChatHub] Custom adapter updated:', id);
        });
    },

    loadCustomAdapters: async () => {
        try {
            const result = await chrome.storage.local.get(['customAdapters']) as StorageData;
            const customAdapters = result.customAdapters || [];

            if (customAdapters.length > 0) {
                set(() => ({
                    availableAdapters: [...DEFAULT_ADAPTERS, ...customAdapters]
                }));
                console.log('[ChatHub] Loaded custom adapters:', customAdapters.length);
            }
        } catch (error) {
            console.error('[ChatHub] Failed to load custom adapters:', error);
        }
    },

    loadActiveBots: async () => {
        try {
            const result = await chrome.storage.local.get(['activeBotIds']) as Partial<StorageData>;
            const activeBotIds = result.activeBotIds || null;

            if (activeBotIds && activeBotIds.length > 0) {
                // Restore bots from saved IDs
                const state = get();
                const restoredBots = activeBotIds
                    .map(id => state.availableAdapters.find(a => a.id === id))
                    .filter((adapter): adapter is ServiceAdapter => adapter !== undefined)
                    .map(adapter => ({
                        ...adapter,
                        isActive: true,
                        instanceId: crypto.randomUUID()
                    }));

                set({ activeBots: restoredBots });
                console.log('[ChatHub] Restored active bots:', restoredBots.length);
            } else {
                // First time use - show default bots (ChatGPT + Claude)
                const defaultBots = DEFAULT_ADAPTERS.slice(0, 2).map(adapter => ({
                    ...adapter,
                    isActive: true,
                    instanceId: crypto.randomUUID()
                }));
                set({ activeBots: defaultBots });
                console.log('[ChatHub] Using default bots');
            }
        } catch (error) {
            console.error('[ChatHub] Failed to load active bots:', error);
            // Fallback to defaults on error
            const defaultBots = DEFAULT_ADAPTERS.slice(0, 2).map(adapter => ({
                ...adapter,
                isActive: true,
                instanceId: crypto.randomUUID()
            }));
            set({ activeBots: defaultBots });
        }
    },

    saveActiveBots: () => {
        const state = get();
        const activeBotIds = state.activeBots.map(bot => bot.id);
        chrome.storage.local.set({ activeBotIds }, () => {
            if (chrome.runtime.lastError) {
                console.error('[ChatHub] Failed to save active bots:', chrome.runtime.lastError);
                return;
            }
            console.log('[ChatHub] Saved active bots:', activeBotIds);
        });
    },

    loadPreferences: async () => {
        try {
            const result = await chrome.storage.local.get(['adapterPreferences']) as Partial<StorageData>;
            const prefs = result.adapterPreferences || [];
            set({ adapterPreferences: prefs });
            console.log('[ChatHub] Loaded preferences:', prefs.length);
        } catch (error) {
            console.error('[ChatHub] Failed to load preferences:', error);
        }
    },

    togglePin: (id) => {
        const state = get();
        const prefs = [...state.adapterPreferences];
        const index = prefs.findIndex(p => p.id === id);

        if (index >= 0) {
            prefs[index] = { ...prefs[index], isPinned: !prefs[index].isPinned };
        } else {
            prefs.push({ id, isPinned: true });
        }

        set({ adapterPreferences: prefs });

        // Save to storage
        chrome.storage.local.set({ adapterPreferences: prefs });
    },

    updateAdapterOrder: (id, newOrder) => {
        const state = get();
        let prefs = [...state.adapterPreferences];
        const index = prefs.findIndex(p => p.id === id);

        if (index >= 0) {
            prefs[index] = { ...prefs[index], order: newOrder };
        } else {
            prefs.push({ id, order: newOrder });
        }

        set({ adapterPreferences: prefs });
        chrome.storage.local.set({ adapterPreferences: prefs });
    }
}));

// Initialize store with saved data
(async () => {
    // Load custom adapters first
    await useStore.getState().loadCustomAdapters();
    await useStore.getState().loadPreferences();
    await useStore.getState().loadPrompts();
    // Then load active bots (needs adapters to be loaded)
    await useStore.getState().loadActiveBots();
})();

// Listen for system theme changes
if (typeof window !== 'undefined') {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeQuery.addEventListener('change', (e) => {
        useStore.getState().setDarkMode(e.matches);
        console.log('[ChatHub] Theme changed to:', e.matches ? 'dark' : 'light');
    });
}
