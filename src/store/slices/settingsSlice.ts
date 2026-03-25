import { StateCreator } from 'zustand';
import { AppState, SettingsSlice } from '../types';

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsSlice> = (set) => ({
    isSyncEnabled: true,
    draftContent: '',
    setSyncEnabled: (enabled) => set({ isSyncEnabled: enabled }),
    setDraftContent: (content) => set({ draftContent: content }),
});
