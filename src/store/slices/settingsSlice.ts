import { StateCreator } from 'zustand';
import { AppState, SettingsSlice, UIThemeVariant } from '../types';

const THEME_KEY = 'uiThemeVariant';

function isUIThemeVariant(value: unknown): value is UIThemeVariant {
    return value === 'morandi' || value === 'bold';
}

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsSlice> = (set) => ({
    isSyncEnabled: true,
    draftContent: '',
    uiThemeVariant: 'morandi',
    themeMode: 'system',
    setSyncEnabled: (enabled) => set({ isSyncEnabled: enabled }),
    setDraftContent: (content) => set({ draftContent: content }),
    setUIThemeVariant: (variant) => {
        set({ uiThemeVariant: variant });
        chrome.storage.local.set({ [THEME_KEY]: variant });
    },
    setThemeMode: (mode) => {
        set({ themeMode: mode });
        chrome.storage.local.set({ themeMode: mode });
    },
    loadSettings: async () => {
        try {
            const result = await chrome.storage.local.get([THEME_KEY, 'themeMode']) as { uiThemeVariant?: unknown; themeMode?: unknown };
            if (isUIThemeVariant(result.uiThemeVariant)) {
                set({ uiThemeVariant: result.uiThemeVariant });
            }
            if (result.themeMode === 'light' || result.themeMode === 'dark' || result.themeMode === 'system') {
                set({ themeMode: result.themeMode });
            }
        } catch (error) {
            console.error('[ChatHub] Failed to load settings:', error);
        }
    },
});
