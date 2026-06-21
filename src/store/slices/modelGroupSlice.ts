import { StateCreator } from 'zustand';
import { AppState, ModelGroupSlice, ModelGroup } from '../types';
import { ChatBot } from '../../types';

export const createModelGroupSlice: StateCreator<AppState, [], [], ModelGroupSlice> = (set, get) => ({
    modelGroups: [],

    saveModelGroup: (name, description) => {
        const state = get();
        const adapterIds = state.activeBots.map(b => b.id);

        if (adapterIds.length === 0) return;

        const group: ModelGroup = {
            id: crypto.randomUUID(),
            name,
            adapterIds,
            description,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const newGroups = [...state.modelGroups, group];
        set({ modelGroups: newGroups });
        chrome.storage.local.set({ modelGroups: newGroups });
    },

    applyModelGroup: (groupId, mode) => {
        const state = get();
        const group = state.modelGroups.find(g => g.id === groupId);
        if (!group) return;

        const adapters = state.availableAdapters;
        const groupBots: ChatBot[] = group.adapterIds
            .map(id => adapters.find(a => a.id === id))
            .filter((a): a is NonNullable<typeof a> => a !== undefined)
            .map(adapter => ({
                ...adapter,
                isActive: true,
                instanceId: crypto.randomUUID(),
            }));

        if (mode === 'replace') {
            // 替换：关闭当前所有模型，打开组合中的模型
            set({ activeBots: groupBots, selectedTargetInstanceIds: [] });
        } else {
            // 追加：在当前模型基础上追加组合中的模型（去重）
            const existingIds = new Set(state.activeBots.map(b => b.id));
            const newBots = groupBots.filter(b => !existingIds.has(b.id));
            // 追加模式下旧 ID 仍在，只清掉已失效的 selected targets
            const validSelected = state.selectedTargetInstanceIds.filter(id =>
                [...state.activeBots, ...newBots].some(b => b.instanceId === id)
            );
            set({ activeBots: [...state.activeBots, ...newBots], selectedTargetInstanceIds: validSelected });
        }

        setTimeout(() => get().saveActiveBots(), 0);
    },

    deleteModelGroup: (groupId) => {
        const state = get();
        const newGroups = state.modelGroups.filter(g => g.id !== groupId);
        set({ modelGroups: newGroups });
        chrome.storage.local.set({ modelGroups: newGroups });
    },

    renameModelGroup: (groupId, name) => {
        const state = get();
        const newGroups = state.modelGroups.map(g =>
            g.id === groupId ? { ...g, name, updatedAt: Date.now() } : g
        );
        set({ modelGroups: newGroups });
        chrome.storage.local.set({ modelGroups: newGroups });
    },

    loadModelGroups: async () => {
        try {
            const result = await chrome.storage.local.get(['modelGroups']);
            const groups = (result as { modelGroups?: ModelGroup[] }).modelGroups || [];
            set({ modelGroups: groups });
        } catch (error) {
            console.error('[ChatHub] Failed to load model groups:', error);
        }
    },
});
