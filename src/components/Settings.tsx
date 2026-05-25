import { useState } from 'react';
import { X, Plus, Edit2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ServiceAdapter } from '../types';
import { DEFAULT_ADAPTERS } from '../types';
import { useStore } from '../store';

interface SettingsProps {
    isOpen: boolean;
    onClose: () => void;
    adapters: ServiceAdapter[];
    onAddAdapter: (adapter: ServiceAdapter) => void;
    onRemoveAdapter: (id: string) => void;
    onUpdateAdapter: (id: string, adapter: ServiceAdapter) => void;
}

export function Settings({ isOpen, onClose, adapters, onAddAdapter, onRemoveAdapter, onUpdateAdapter }: SettingsProps) {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [inputSelector, setInputSelector] = useState('textarea, input[type="text"], [contenteditable="true"]');
    const [submitSelector, setSubmitSelector] = useState('button[type="submit"]');
    const [editingId, setEditingId] = useState<string | null>(null);
    const uiThemeVariant = useStore((state) => state.uiThemeVariant);
    const setUIThemeVariant = useStore((state) => state.setUIThemeVariant);
    const themeMode = useStore((state) => state.themeMode || 'system');
    const setThemeMode = useStore((state) => state.setThemeMode);

    // Get custom adapters (not default ones)
    const customAdapters = adapters.filter(a =>
        !DEFAULT_ADAPTERS.some(defaultAdapter => defaultAdapter.id === a.id)
    );

    const getSelectorInputValue = (selector: ServiceAdapter['inputSelector']) => {
        if (typeof selector === 'string') {
            return selector;
        }

        if (Array.isArray(selector)) {
            return selector
                .map(item => typeof item === 'string' ? item : item.selector)
                .join(', ');
        }

        return selector.selector;
    };

    const handleSave = () => {
        if (!name.trim() || !url.trim()) {
            alert('名称和网址不能为空！');
            return;
        }

        const adapter: ServiceAdapter = {
            id: editingId || name.toLowerCase().replace(/\s+/g, '-'),
            name,
            url,
            inputSelector,
            submitSelector
        };

        if (editingId) {
            // Update existing
            onUpdateAdapter(editingId, adapter);
            setEditingId(null);
        } else {
            // Add new
            onAddAdapter(adapter);
        }

        // Reset form
        resetForm();
    };

    const handleEdit = (adapter: ServiceAdapter) => {
        setEditingId(adapter.id);
        setName(adapter.name);
        setUrl(adapter.url);
        setInputSelector(getSelectorInputValue(adapter.inputSelector));
        setSubmitSelector(getSelectorInputValue(adapter.submitSelector));

        // Scroll to form
        setTimeout(() => {
            document.getElementById('service-form')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleDelete = (id: string, name: string) => {
        const confirmed = confirm(`确定要删除 "${name}" 吗？\n\n这也将关闭当前打开的该服务。`);
        if (confirmed) {
            onRemoveAdapter(id);
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        resetForm();
    };

    const resetForm = () => {
        setName('');
        setUrl('');
        setInputSelector('textarea, input[type="text"], [contenteditable="true"]');
        setSubmitSelector('button[type="submit"]');
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Settings Components - macOS Sheet Style */}
            <div className={cn(
                "fixed right-0 top-0 h-full w-[400px] max-w-full shadow-2xl z-[120] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                "bg-mac-light/95 dark:bg-[#1e1e1e]/95 backdrop-blur-xl border-l border-black/5 dark:border-white/10",
                isOpen ? "translate-x-0" : "translate-x-full"
            )}>
                {/* Header */}
                <div className="h-[52px] px-6 flex items-center justify-between border-b border-black/5 dark:border-white/5 flex-shrink-0">
                    <h2 className="text-[17px] font-semibold text-mac-text-light dark:text-mac-text-dark">
                        {editingId ? '编辑服务' : '设置'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="btn-icon rounded-full"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex flex-1 min-h-0 flex-col">
                    <div className="flex-1 overflow-y-auto px-5 pt-5 pb-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                        {/* 主题模式 */}
                        <div className="mb-5 rounded-xl border border-black/5 bg-white/45 p-4 dark:border-white/10 dark:bg-white/5">
                            <h3 className="text-[13px] font-medium uppercase tracking-wide text-gray-500">
                                主题模式
                            </h3>
                            <p className="mt-2 text-[12px] leading-5 text-gray-500 dark:text-gray-400">
                                选择扩展的颜色外观（可强制开启浅色模式）。
                            </p>
                            <div className="mt-3 grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => setThemeMode('light')}
                                    className={cn(
                                        "rounded-lg border py-2 text-center transition-all text-[13px] font-medium",
                                        themeMode === 'light'
                                            ? "border-[#bec8d5]/45 bg-[#bec8d5]/12 ring-1 ring-[#bec8d5]/40 text-mac-text-light dark:text-mac-text-dark"
                                            : "border-black/8 bg-white/40 hover:border-black/15 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 text-gray-500 dark:text-gray-400"
                                    )}
                                >
                                    浅色
                                </button>
                                <button
                                    onClick={() => setThemeMode('dark')}
                                    className={cn(
                                        "rounded-lg border py-2 text-center transition-all text-[13px] font-medium",
                                        themeMode === 'dark'
                                            ? "border-[#bec8d5]/45 bg-[#bec8d5]/12 ring-1 ring-[#bec8d5]/40 text-mac-text-light dark:text-mac-text-dark"
                                            : "border-black/8 bg-white/40 hover:border-black/15 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 text-gray-500 dark:text-gray-400"
                                    )}
                                >
                                    深色
                                </button>
                                <button
                                    onClick={() => setThemeMode('system')}
                                    className={cn(
                                        "rounded-lg border py-2 text-center transition-all text-[13px] font-medium",
                                        themeMode === 'system'
                                            ? "border-[#bec8d5]/45 bg-[#bec8d5]/12 ring-1 ring-[#bec8d5]/40 text-mac-text-light dark:text-mac-text-dark"
                                            : "border-black/8 bg-white/40 hover:border-black/15 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 text-gray-500 dark:text-gray-400"
                                    )}
                                >
                                    跟随系统
                                </button>
                            </div>
                        </div>

                        {/* UI 风格 */}
                        <div className="mb-5 rounded-xl border border-black/5 bg-white/45 p-4 dark:border-white/10 dark:bg-white/5">
                            <h3 className="text-[13px] font-medium uppercase tracking-wide text-gray-500">
                                UI 风格
                            </h3>
                            <p className="mt-2 text-[12px] leading-5 text-gray-500 dark:text-gray-400">
                                当前支持两版界面，可随时切换。`当前版` 保留现有莫兰迪质感，`大胆版` 使用更强的层次。
                            </p>
                            <div className="mt-4 grid grid-cols-1 gap-3">
                                <button
                                    onClick={() => setUIThemeVariant('morandi')}
                                    className={cn(
                                        "rounded-xl border px-3 py-3 text-left transition-all",
                                        uiThemeVariant === 'morandi'
                                            ? "border-[#bec8d5]/45 bg-[#bec8d5]/12 ring-1 ring-[#bec8d5]/40"
                                            : "border-black/8 bg-white/40 hover:border-black/15 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-[14px] font-semibold text-mac-text-light dark:text-mac-text-dark">
                                                当前版（莫兰迪）
                                            </div>
                                            <div className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                                                克制、清新、长期使用舒适。
                                            </div>
                                        </div>
                                        {uiThemeVariant === 'morandi' && (
                                            <span className="rounded-full border border-[#bec8d5]/50 bg-[#bec8d5]/18 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8fa1b4]">
                                                当前
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-3 flex gap-2">
                                        <span className="h-4 w-8 rounded-full bg-[#B5C4D1]" />
                                        <span className="h-4 w-8 rounded-full bg-[#C0D0C3]" />
                                        <span className="h-4 w-8 rounded-full bg-[#E2DCD3]" />
                                        <span className="h-4 w-8 rounded-full bg-[#DBC5C6]" />
                                    </div>
                                </button>
                                <button
                                    onClick={() => setUIThemeVariant('bold')}
                                    className={cn(
                                        "rounded-xl border px-3 py-3 text-left transition-all",
                                        uiThemeVariant === 'bold'
                                            ? "border-[#B5C4D1]/40 bg-[#222B36]/60 ring-1 ring-[#B5C4D1]/35"
                                            : "border-black/8 bg-white/40 hover:border-black/15 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-[14px] font-semibold text-mac-text-light dark:text-mac-text-dark">
                                                大胆版（高对比莫兰迪）
                                            </div>
                                            <div className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                                                夜间莫兰迪护眼版，层次更大胆但不刺眼。
                                            </div>
                                        </div>
                                        {uiThemeVariant === 'bold' && (
                                            <span className="rounded-full border border-[#B5C4D1]/45 bg-[#222B36]/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#C0D0C3]">
                                                当前
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-3 flex gap-2">
                                        <span className="h-4 w-8 rounded-full bg-[#222B36]" />
                                        <span className="h-4 w-8 rounded-full bg-[#26332A]" />
                                        <span className="h-4 w-8 rounded-full bg-[#36312D]" />
                                        <span className="h-4 w-8 rounded-full bg-[#382A2E]" />
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Custom Services List */}
                        {customAdapters.length > 0 && !editingId && (
                            <div className="space-y-4 mb-8">
                                <h3 className="text-[13px] font-medium text-gray-500 uppercase tracking-wide px-1">
                                    已添加服务 ({customAdapters.length})
                                </h3>

                                <div className="space-y-2">
                                    {customAdapters.map(adapter => (
                                        <div
                                            key={adapter.id}
                                            className="bg-white/50 dark:bg-white/5 rounded-xl p-3 border border-black/5 dark:border-white/5 hover:border-blue-500/30 transition-all group"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-[15px] font-medium text-mac-text-light dark:text-mac-text-dark truncate">
                                                        {adapter.name}
                                                    </h4>
                                                    <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                                        {adapter.url}
                                                    </p>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEdit(adapter)}
                                                        className="btn-icon text-blue-600 dark:text-blue-400"
                                                        title="编辑"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(adapter.id, adapter.name)}
                                                        className="btn-icon text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:bg-red-500/20"
                                                        title="删除"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Add/Edit Form */}
                        <div id="service-form" className="space-y-5">
                            <h3 className="text-[13px] font-medium text-gray-500 uppercase tracking-wide px-1 mb-2">
                                {editingId ? '编辑详情' : '添加新服务'}
                            </h3>

                            {/* Name Input */}
                            <div>
                                <label className="block text-[13px] font-medium text-mac-text-light dark:text-gray-300 mb-1.5">
                                    服务名称
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., Kimi, Perplexity"
                                    className="w-full px-3 py-2 bg-white/50 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg text-[15px] text-mac-text-light dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>

                            {/* URL Input */}
                            <div>
                                <label className="block text-[13px] font-medium text-mac-text-light dark:text-gray-300 mb-1.5">
                                    网址 URL
                                </label>
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://example.com"
                                    className="w-full px-3 py-2 bg-white/50 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg text-[15px] text-mac-text-light dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all mb-2"
                                />
                                <p className="text-[12px] leading-5 text-gray-500 dark:text-gray-400">
                                    请输入目标站点地址。选择器需要手动填写，建议在普通标签页打开目标网站后，用开发者工具复制输入框和发送按钮的 CSS Selector。
                                </p>
                            </div>

                            {/* Advanced Section */}
                            <div className="pt-4 border-t border-black/5 dark:border-white/5">
                                <h4 className="text-[13px] font-medium text-gray-400 mb-3">高级配置</h4>

                                {/* Input Selector */}
                                <div className="mb-4">
                                    <label className="block text-[12px] text-gray-500 mb-1.5">
                                        输入框 Selectors
                                    </label>
                                    <input
                                        type="text"
                                        value={inputSelector}
                                        onChange={(e) => setInputSelector(e.target.value)}
                                        className="w-full px-3 py-2 bg-white/40 dark:bg-black/20 border border-black/5 dark:border-white/10 rounded-lg text-xs font-mono text-gray-600 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 outline-none"
                                    />
                                </div>

                                {/* Submit Selector */}
                                <div>
                                    <label className="block text-[12px] text-gray-500 mb-1.5">
                                        发送按钮 Selectors
                                    </label>
                                    <input
                                        type="text"
                                        value={submitSelector}
                                        onChange={(e) => setSubmitSelector(e.target.value)}
                                        className="w-full px-3 py-2 bg-white/40 dark:bg-black/20 border border-black/5 dark:border-white/10 rounded-lg text-xs font-mono text-gray-600 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-black/5 bg-mac-light/95 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:border-white/5 dark:bg-[#1e1e1e]/95">
                        {editingId ? (
                            <>
                                <button
                                    onClick={handleCancelEdit}
                                    className="btn-secondary px-4 min-w-[80px]"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="btn-primary px-4 min-w-[80px]"
                                >
                                    保存修改
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleSave}
                                className="btn-primary w-full py-2.5"
                            >
                                <Plus className="w-4 h-4" />
                                添加服务
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
