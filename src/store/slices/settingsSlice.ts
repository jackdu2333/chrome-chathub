import { StateCreator } from 'zustand';
import { AppState, SettingsSlice, UIThemeVariant } from '../types';
import { appStorageGet, appStorageSet } from '../../lib/appStorage';

function isUIThemeVariant(value: unknown): value is UIThemeVariant {
    return value === 'morandi' || value === 'bold';
}

function isThemeMode(value: unknown): value is SettingsSlice['themeMode'] {
    return value === 'light' || value === 'dark' || value === 'system';
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

    setSyncEnabled: (enabled) => {
        set({ isSyncEnabled: enabled });
        void appStorageSet({ isSyncEnabled: enabled })
            .catch((error) => console.error('[ChatHub] Failed to save sync setting:', error));
    },
    setDraftContent: (content) => set({ draftContent: content }),
    setUIThemeVariant: (variant) => {
        set({ uiThemeVariant: variant });
        void appStorageSet({ uiThemeVariant: variant })
            .catch((error) => console.error('[ChatHub] Failed to save UI theme:', error));
    },
    setThemeMode: (mode) => {
        set({ themeMode: mode });
        void appStorageSet({ themeMode: mode })
            .catch((error) => console.error('[ChatHub] Failed to save theme mode:', error));
    },
    setInputDisplayMode: (mode) => {
        set({ inputDisplayMode: mode });
        void appStorageSet({ inputDisplayMode: mode })
            .catch((error) => console.error('[ChatHub] Failed to save input display mode:', error));
    },
    setLastSendSummary: (summary) => set({ lastSendSummary: summary }),
    loadSettings: async () => {
        try {
            const result = await appStorageGet<{
                isSyncEnabled?: unknown;
                uiThemeVariant?: unknown;
                themeMode?: unknown;
                inputDisplayMode?: unknown;
            }>(['isSyncEnabled', 'uiThemeVariant', 'themeMode', 'inputDisplayMode']);
            if (typeof result.isSyncEnabled === 'boolean') {
                set({ isSyncEnabled: result.isSyncEnabled });
            }
            if (isUIThemeVariant(result.uiThemeVariant)) {
                set({ uiThemeVariant: result.uiThemeVariant });
            }
            if (isThemeMode(result.themeMode)) {
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
