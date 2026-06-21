import { StateCreator } from 'zustand';
import { AppState, UISlice } from '../types';

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
    gridLayout: 'split',
    isDarkMode: typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false,
    isInputCollapsed: false,

    // 工作区布局（默认 grid）
    layoutMode: 'grid',

    // 发送目标默认发给全部窗口
    sendTargetMode: 'all',
    selectedTargetInstanceIds: [],

    setGridLayout: (layout) => set({ gridLayout: layout }),
    setDarkMode: (isDark) => set({ isDarkMode: isDark }),
    setInputCollapsed: (collapsed) => set({ isInputCollapsed: collapsed }),
    setLayoutMode: (mode) => set({ layoutMode: mode }),
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
