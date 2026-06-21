import { StateCreator } from 'zustand';
import { AppState, UISlice } from '../types';

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
    gridLayout: 'split',
    isDarkMode: typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false,
    isInputCollapsed: false,

    // 发送目标默认发给全部窗口
    sendTargetMode: 'all',
    selectedTargetInstanceIds: [],

    setGridLayout: (layout) => set({ gridLayout: layout }),
    setDarkMode: (isDark) => set({ isDarkMode: isDark }),
    setInputCollapsed: (collapsed) => set({ isInputCollapsed: collapsed }),
    setSendTargetMode: (mode) => set({ sendTargetMode: mode }),
    toggleSelectedTarget: (instanceId) =>
        set((state) => {
            const exists = state.selectedTargetInstanceIds.includes(instanceId);
            return {
                selectedTargetInstanceIds: exists
                    ? state.selectedTargetInstanceIds.filter((id) => id !== instanceId)
                    : [...state.selectedTargetInstanceIds, instanceId],
            };
        }),
    clearSelectedTargets: () => set({ selectedTargetInstanceIds: [] }),
});
