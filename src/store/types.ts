import { AdapterPreference, ChatBot, ServiceAdapter } from '../types';

export type UIThemeVariant = 'morandi' | 'bold';

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
    isInputCollapsed: boolean;
    setGridLayout: (layout: 'single' | 'split' | 'grid') => void;
    setDarkMode: (isDark: boolean) => void;
    setInputCollapsed: (collapsed: boolean) => void;
}

export interface SettingsSlice {
    isSyncEnabled: boolean;
    draftContent: string;
    uiThemeVariant: UIThemeVariant;
    themeMode: 'light' | 'dark' | 'system';
    setSyncEnabled: (enabled: boolean) => void;
    setDraftContent: (content: string) => void;
    setUIThemeVariant: (variant: UIThemeVariant) => void;
    setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
    loadSettings: () => Promise<void>;
}

export type AppState = BotSlice & UISlice & SettingsSlice;

