import { AdapterPreference, ChatBot, ServiceAdapter } from '../types';

export type UIThemeVariant = 'morandi' | 'bold';

// 发送目标模式：用户手动选择消息发送到哪些窗口
export type SendTargetMode = 'all' | 'focused' | 'selected';

// 工作区布局模式
export type WorkspaceLayoutMode = 'grid' | 'primary-secondary' | 'focus' | 'vertical';



// 发送结果反馈（每次发送后生成一份摘要）
export interface SendResultItem {
    instanceId: string;
    botName: string;
    success: boolean;
    error?: string;
    timestamp: number;
}

export interface LastSendSummary {
    total: number;
    successCount: number;
    failedCount: number;
    items: SendResultItem[];
}


// 模型组合：用户保存的常用模型组（非自动推荐，完全由用户管理）
export interface ModelGroup {
    id: string;
    name: string;
    adapterIds: string[];
    description?: string;
    createdAt: number;
    updatedAt: number;
}

export interface BotSlice {
    activeBots: ChatBot[];
    availableAdapters: ServiceAdapter[];
    adapterPreferences: AdapterPreference[];
    
    toggleBot: (adapterId: string) => void;
    reloadAllBots: () => void;
    addCustomAdapter: (adapter: ServiceAdapter) => void;
    removeCustomAdapter: (id: string) => void;
    updateCustomAdapter: (id: string, adapter: ServiceAdapter) => void;
    loadCustomAdapters: () => Promise<void>;
    loadActiveBots: () => Promise<void>;
    saveActiveBots: () => void;
    
    // Preferences
    loadPreferences: () => Promise<void>;
    togglePin: (id: string) => void;
    updateAdapterOrder: (id: string, newOrder: number) => void;
    reorderBots: (oldIndex: number, newIndex: number) => void;
}

export interface UISlice {
    gridLayout: 'single' | 'split' | 'grid';
    isDarkMode: boolean;
    isInputCollapsed: boolean;
    // 工作区布局
    layoutMode: WorkspaceLayoutMode;
    setLayoutMode: (mode: WorkspaceLayoutMode) => void;
    // 发送目标状态
    sendTargetMode: SendTargetMode;
    selectedTargetInstanceIds: string[];
    setGridLayout: (layout: 'single' | 'split' | 'grid') => void;
    setDarkMode: (isDark: boolean) => void;
    setInputCollapsed: (collapsed: boolean) => void;
    setSendTargetMode: (mode: SendTargetMode) => void;
    toggleSelectedTarget: (instanceId: string) => void;
    clearSelectedTargets: () => void;
}

export interface SettingsSlice {
    isSyncEnabled: boolean;
    draftContent: string;
    uiThemeVariant: UIThemeVariant;
    themeMode: 'light' | 'dark' | 'system';
    // 输入框显示方式：始终显示 / 自动隐藏
    inputDisplayMode: 'always' | 'auto-hide';
    // 发送结果反馈
    lastSendSummary: LastSendSummary | null;
    setSyncEnabled: (enabled: boolean) => void;
    setDraftContent: (content: string) => void;
    setUIThemeVariant: (variant: UIThemeVariant) => void;
    setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
    setInputDisplayMode: (mode: 'always' | 'auto-hide') => void;
    setLastSendSummary: (summary: LastSendSummary | null) => void;
    loadSettings: () => Promise<void>;
}


export interface ModelGroupSlice {
    modelGroups: ModelGroup[];
    saveModelGroup: (name: string, description?: string) => void;
    applyModelGroup: (groupId: string, mode: 'replace' | 'append') => void;
    deleteModelGroup: (groupId: string) => void;
    renameModelGroup: (groupId: string, name: string) => void;
    loadModelGroups: () => Promise<void>;
}

export type AppState = BotSlice & UISlice & SettingsSlice & ModelGroupSlice;
