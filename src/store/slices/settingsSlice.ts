import { StateCreator } from 'zustand';
import { AppState, SettingsSlice } from '../types';

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsSlice> = (set) => ({
    isSyncEnabled: true,
    setSyncEnabled: (enabled) => set({ isSyncEnabled: enabled }),
});
