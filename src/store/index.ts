import { create } from 'zustand';
import { AppState } from './types';
import { createBotSlice } from './slices/botSlice';
import { createUISlice } from './slices/uiSlice';
import { createSettingsSlice } from './slices/settingsSlice';
import { createModelGroupSlice } from './slices/modelGroupSlice';

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
    // Prompt library has been removed; clear stale prompt storage once during startup.
    await chrome.storage.local.remove(['prompts']);
    // Then load active bots (needs adapters to be loaded)
    await useStore.getState().loadActiveBots();
})();
