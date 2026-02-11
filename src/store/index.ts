import { create } from 'zustand';
import { AppState } from './types';
import { createBotSlice } from './slices/botSlice';
import { createUISlice } from './slices/uiSlice';
import { createPromptSlice } from './slices/promptSlice';
import { createSettingsSlice } from './slices/settingsSlice';

export * from './types';


export const useStore = create<AppState>((...a) => ({
    ...createBotSlice(...a),
    ...createUISlice(...a),
    ...createPromptSlice(...a),
    ...createSettingsSlice(...a),
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
