import { create } from 'zustand';
import { AppState } from './types';
import { createBotSlice } from './slices/botSlice';
import { createUISlice } from './slices/uiSlice';
import { createSettingsSlice } from './slices/settingsSlice';
import { createModelGroupSlice } from './slices/modelGroupSlice';
import { loadUIState } from './slices/uiSlice';
import { appStorageGet, appStorageRemove, appStorageSet } from '../lib/appStorage';

export * from './types';


export const useStore = create<AppState>((...a) => ({
    ...createBotSlice(...a),
    ...createUISlice(...a),
    ...createSettingsSlice(...a),
    ...createModelGroupSlice(...a),
}));

// Initialize store with saved data
(async () => {
    // Load custom adapters first
    await useStore.getState().loadCustomAdapters();
    await useStore.getState().loadPreferences();
    await useStore.getState().loadSettings();
    await useStore.getState().loadModelGroups();
    await loadUIState();
    // Migration: prompt library 已移除，用 flag 确保只清理一次
    const migrationResult = await appStorageGet<{ _migration_prompts_removed?: boolean }>(['_migration_prompts_removed']);
    if (!migrationResult._migration_prompts_removed) {
        await appStorageRemove(['prompts']);
        await appStorageSet({ '_migration_prompts_removed': true });
    }
    // Then load active bots (needs adapters to be loaded)
    await useStore.getState().loadActiveBots();
})();
