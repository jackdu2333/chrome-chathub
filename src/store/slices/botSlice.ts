import { StateCreator } from 'zustand';
import { AppState, BotSlice } from '../types';
import { ChatBot, DEFAULT_ADAPTERS, ServiceAdapter, StorageData } from '../../types';
import { appStorageGet, appStorageSet } from '../../lib/appStorage';

function getDefaultBots(): ChatBot[] {
    return DEFAULT_ADAPTERS
        .filter((adapter) => adapter.id === 'openai' || adapter.id === 'claude')
        .map((adapter) => ({
            ...adapter,
            isActive: true,
            instanceId: crypto.randomUUID()
        }));
}

export const createBotSlice: StateCreator<AppState, [], [], BotSlice> = (set, get) => ({
    activeBots: [],
    availableAdapters: DEFAULT_ADAPTERS,
    adapterPreferences: [],

    reorderBots: (oldIndex, newIndex) => {
        set((state) => {
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

    reloadAllBots: () => {
        set(state => ({
            activeBots: state.activeBots.map(bot => ({
                ...bot,
                instanceId: crypto.randomUUID()
            })),
            // instanceId 变了，旧的 selected targets 全部失效，必须清空
            selectedTargetInstanceIds: [],
        }));
    },

    addCustomAdapter: (adapter) => {
        const state = get();
        if (state.availableAdapters.some(a => a.id === adapter.id)) {
            return;
        }

        const newAdapters = [...state.availableAdapters, adapter];
        set({ availableAdapters: newAdapters });

        // Save custom adapters to storage
        const customAdapters = newAdapters.filter(a =>
            !DEFAULT_ADAPTERS.some(defaultAdapter => defaultAdapter.id === a.id)
        );
        void appStorageSet({ customAdapters })
            .then(() => console.log('[ChatHub] Custom adapters saved:', customAdapters.length))
            .catch((error) => console.error('[ChatHub] Failed to save custom adapters:', error));
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
        void appStorageSet({ customAdapters })
            .then(() => console.log('[ChatHub] Custom adapter removed:', id))
            .catch((error) => console.error('[ChatHub] Failed to remove custom adapter:', error));
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
        void appStorageSet({ customAdapters })
            .then(() => console.log('[ChatHub] Custom adapter updated:', id))
            .catch((error) => console.error('[ChatHub] Failed to update custom adapter:', error));
    },

    loadCustomAdapters: async () => {
        try {
            const result = await appStorageGet<StorageData>(['customAdapters']);
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
            const result = await appStorageGet<StorageData>(['activeBotIds']);
            const activeBotIds = result.activeBotIds;

            if (Array.isArray(activeBotIds)) {
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
                const defaultBots = getDefaultBots();
                set({ activeBots: defaultBots });
                console.log('[ChatHub] Using default bots');
            }
        } catch (error) {
            console.error('[ChatHub] Failed to load active bots:', error);
            // Fallback to defaults on error
            const defaultBots = getDefaultBots();
            set({ activeBots: defaultBots });
        }
    },

    saveActiveBots: () => {
        const state = get();
        const activeBotIds = state.activeBots.map(bot => bot.id);
        void appStorageSet({ activeBotIds })
            .then(() => console.log('[ChatHub] Saved active bots:', activeBotIds))
            .catch((error) => console.error('[ChatHub] Failed to save active bots:', error));
    },

    loadPreferences: async () => {
        try {
            const result = await appStorageGet<StorageData>(['adapterPreferences']);
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
        void appStorageSet({ adapterPreferences: prefs })
            .catch((error) => console.error('[ChatHub] Failed to save adapter preferences:', error));
    },

    updateAdapterOrder: (id, newOrder) => {
        const state = get();
        const prefs = [...state.adapterPreferences];
        const index = prefs.findIndex(p => p.id === id);

        if (index >= 0) {
            prefs[index] = { ...prefs[index], order: newOrder };
        } else {
            prefs.push({ id, order: newOrder });
        }

        set({ adapterPreferences: prefs });
        void appStorageSet({ adapterPreferences: prefs })
            .catch((error) => console.error('[ChatHub] Failed to save adapter preferences:', error));
    }
});
