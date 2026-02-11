import { StateCreator } from 'zustand';
import { AppState, PromptSlice } from '../types';
import { Prompt, StorageData } from '../../types';

const DEFAULT_PROMPTS: Prompt[] = [
    { id: '1', title: '代码审查', content: '请审查此代码，找出错误和性能问题。', category: '编程', isSystem: true },
    { id: '2', title: '内容总结', content: '请用三点总结以下文本。', category: '写作', isSystem: true },
    { id: '3', title: '简单解释', content: '请像对五岁孩子一样解释这个概念。', category: '学习', isSystem: true },
];

export const createPromptSlice: StateCreator<AppState, [], [], PromptSlice> = (set) => ({
    prompts: [],
    draftContent: '',

    setDraftContent: (content) => set({ draftContent: content }),

    addPrompt: (prompt) => {
        set((state) => {
            const newPrompts = [...state.prompts, prompt];
            chrome.storage.local.set({ prompts: newPrompts });
            return { prompts: newPrompts };
        });
    },

    updatePrompt: (id, updates) => {
        set((state) => {
            const newPrompts = state.prompts.map(p => p.id === id ? { ...p, ...updates } : p);
            chrome.storage.local.set({ prompts: newPrompts });
            return { prompts: newPrompts };
        });
    },

    deletePrompt: (id) => {
        set((state) => {
            const newPrompts = state.prompts.filter(p => p.id !== id);
            chrome.storage.local.set({ prompts: newPrompts });
            return { prompts: newPrompts };
        });
    },

    loadPrompts: async () => {
        try {
            const result = await chrome.storage.local.get(['prompts']) as Partial<StorageData>;
            if (result.prompts && result.prompts.length > 0) {
                set({ prompts: result.prompts });
                console.log('[ChatHub] Loaded prompts:', result.prompts.length);
            } else {
                set({ prompts: DEFAULT_PROMPTS });
                console.log('[ChatHub] Using default prompts');
            }
        } catch (error) {
            console.error('[ChatHub] Failed to load prompts:', error);
            set({ prompts: DEFAULT_PROMPTS });
        }
    },
});
