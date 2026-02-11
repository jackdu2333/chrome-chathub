import { AdapterPreference, ChatBot, Prompt, ServiceAdapter } from '../types';

export interface BotSlice {
    activeBots: ChatBot[];
    availableAdapters: ServiceAdapter[];
    adapterPreferences: AdapterPreference[];
    
    toggleBot: (adapterId: string) => void;
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
    reorderBots: (oldIndex: number, newIndex: number) => void;
}

export interface UISlice {
    gridLayout: 'single' | 'split' | 'grid';
    isDarkMode: boolean;
    setGridLayout: (layout: 'single' | 'split' | 'grid') => void;
    setDarkMode: (isDark: boolean) => void;
}

export interface SettingsSlice {
    isSyncEnabled: boolean;
    setSyncEnabled: (enabled: boolean) => void;
}

export interface PromptSlice {
    prompts: Prompt[];
    draftContent: string;
    setDraftContent: (content: string) => void;
    addPrompt: (prompt: Prompt) => void;
    updatePrompt: (id: string, updates: Partial<Prompt>) => void;
    deletePrompt: (id: string) => void;
    loadPrompts: () => Promise<void>;
}

export type AppState = BotSlice & UISlice & SettingsSlice & PromptSlice;
