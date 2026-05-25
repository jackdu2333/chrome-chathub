import { StateCreator } from 'zustand';
import { AppState, UISlice } from '../types';

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
    gridLayout: 'split',
    isDarkMode: typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false,
    isInputCollapsed: false,

    setGridLayout: (layout) => set({ gridLayout: layout }),
    setDarkMode: (isDark) => set({ isDarkMode: isDark }),
    setInputCollapsed: (collapsed) => set({ isInputCollapsed: collapsed }),
});
