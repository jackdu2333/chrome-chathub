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
    // 输入框默认始终显示，高级用户可切自动隐藏
    inputDisplayMode: 'always',
    // 发送结果反馈初始为空
    lastSendSummary: null,

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
    setInputDisplayMode: (mode) => {
        set({ inputDisplayMode: mode });
        chrome.storage.local.set({ inputDisplayMode: mode });
    },
    setLastSendSummary: (summary) => set({ lastSendSummary: summary }),
    loadSettings: async () => {
        try {
            const result = await chrome.storage.local.get([THEME_KEY, 'themeMode', 'inputDisplayMode']) as {
                uiThemeVariant?: unknown;
                themeMode?: unknown;
                inputDisplayMode?: unknown;
            };
            if (isUIThemeVariant(result.uiThemeVariant)) {
                set({ uiThemeVariant: result.uiThemeVariant });
            }
            if (result.themeMode === 'light' || result.themeMode === 'dark' || result.themeMode === 'system') {
                set({ themeMode: result.themeMode });
            }
            if (result.inputDisplayMode === 'always' || result.inputDisplayMode === 'auto-hide') {
                set({ inputDisplayMode: result.inputDisplayMode });
            }
        } catch (error) {
            console.error('[ChatHub] Failed to load settings:', error);
        }
    },
});
