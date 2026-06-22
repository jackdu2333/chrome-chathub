import { StateCreator } from 'zustand';
import { AppState, UISlice } from '../types';

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
    gridLayout: 'split',
    isDarkMode: typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false,
    isInputCollapsed: false,

    // 工作区布局（默认 grid），启动时从 loadUIState 恢复
    layoutMode: 'grid',
    primaryInstanceId: null,

    // 发送目标默认发给全部窗口
    sendTargetMode: 'all',
    selectedTargetInstanceIds: [],

    setGridLayout: (layout) => set({ gridLayout: layout }),
    setDarkMode: (isDark) => set({ isDarkMode: isDark }),
    setInputCollapsed: (collapsed) => set({ isInputCollapsed: collapsed }),
    setLayoutMode: (mode) => {
        set({ layoutMode: mode });
        chrome.storage.local.set({ layoutMode: mode });
    },
    setPrimaryInstanceId: (id) => set({ primaryInstanceId: id }),
    setSendTargetMode: (mode) => {
        set({ sendTargetMode: mode });
        chrome.storage.local.set({ sendTargetMode: mode });
    },
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

// 启动时恢复持久化的 UI 状态
export async function loadUIState() {
    try {
        const result = await chrome.storage.local.get(['layoutMode', 'sendTargetMode']);
        const updates: Partial<UISlice> = {};
        if (result.layoutMode === 'grid' || result.layoutMode === 'primary-scroll'
            || result.layoutMode === 'focus' || result.layoutMode === 'vertical') {
            updates.layoutMode = result.layoutMode;
        }
        if (result.sendTargetMode === 'all' || result.sendTargetMode === 'focused'
            || result.sendTargetMode === 'selected') {
            updates.sendTargetMode = result.sendTargetMode;
        }
        if (Object.keys(updates).length > 0) {
            useStore.setState(updates);
        }
    } catch (error) {
        console.error('[ChatHub] Failed to load UI state:', error);
    }
}

// 延迟引用避免循环依赖
import { useStore } from '../index';
