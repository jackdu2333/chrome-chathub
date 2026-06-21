import { Pin, PinOff, Settings as SettingsIcon, Sparkles, X, Search } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { cn } from '../lib/utils';
import type { ServiceAdapter, AdapterCategory } from '../types';

interface SidebarProps {
    adapters: ServiceAdapter[];
    activeBotIds: string[];
    onToggleBot: (id: string) => void;
    onOpenSettings: () => void;
    isOpen: boolean;
    onClose: () => void;
}

// 分类展示标签
const CATEGORY_LABELS: Record<AdapterCategory, string> = {
    general: '通用模型',
    chinese: '中文模型',
    coding: '编程模型',
    search: '搜索模型',
    'long-context': '长文本模型',
    custom: '自定义',
};

export function Sidebar({
    adapters,
    activeBotIds,
    onToggleBot,
    onOpenSettings,
    isOpen,
    onClose,
}: SidebarProps) {
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; adapterId: string } | null>(null);
    const [searchKeyword, setSearchKeyword] = useState('');

    const adapterPreferences = useStore(state => state.adapterPreferences);
    const togglePin = useStore(state => state.togglePin);

    const getAdapterHost = (adapter: ServiceAdapter) => {
        try {
            return new URL(adapter.url).hostname.replace(/^www\./, '');
        } catch {
            return 'custom-service';
        }
    };

    const getAdapterTone = (adapterId: string) => {
        const tones = [
            "from-[#d8cbc1]/24 to-[#efe5dd]/8 text-[#f7f3ef]",
            "from-[#b7c8bf]/24 to-[#d7e0db]/8 text-[#f1f5f2]",
            "from-[#cdc0c7]/22 to-[#e4dce2]/8 text-[#f5f0f4]",
            "from-[#bec8d5]/22 to-[#dde4ed]/8 text-[#f2f5f8]",
            "from-[#cec4b6]/22 to-[#e6ddd1]/8 text-[#f6f2ec]",
        ];
        const sum = Array.from(adapterId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return tones[sum % tones.length];
    };

    // 排序：置顶优先，然后按原始顺序
    const sortedAdapters = useMemo(() => {
        return [...adapters].sort((a, b) => {
            const prefA = adapterPreferences.find(p => p.id === a.id);
            const prefB = adapterPreferences.find(p => p.id === b.id);
            const pinnedA = prefA?.isPinned ?? false;
            const pinnedB = prefB?.isPinned ?? false;
            if (pinnedA !== pinnedB) return pinnedA ? -1 : 1;
            const orderA = prefA?.order ?? 0;
            const orderB = prefB?.order ?? 0;
            if (orderA !== orderB) return orderA - orderB;
            return adapters.indexOf(a) - adapters.indexOf(b);
        });
    }, [adapters, adapterPreferences]);

    // 搜索过滤
    const filteredAdapters = useMemo(() => {
        const keyword = searchKeyword.trim().toLowerCase();
        if (!keyword) return sortedAdapters;

        return sortedAdapters.filter(adapter => {
            return [
                adapter.name,
                adapter.displayName,
                adapter.url,
                adapter.category,
                ...(adapter.tags ?? []),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(keyword);
        });
    }, [sortedAdapters, searchKeyword]);

    // 分组：常用（置顶）→ 按 category 分组的全部
    const groupedAdapters = useMemo(() => {
        const pinned = filteredAdapters.filter(a => adapterPreferences.find(p => p.id === a.id)?.isPinned);
        const unpinned = filteredAdapters.filter(a => !adapterPreferences.find(p => p.id === a.id)?.isPinned);

        // 未置顶的按 category 分组
        const groups: Record<string, ServiceAdapter[]> = {};
        for (const adapter of unpinned) {
            const cat = adapter.category ?? 'general';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(adapter);
        }

        return { pinned, groups };
    }, [filteredAdapters, adapterPreferences]);

    const handleContextMenu = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, adapterId: id });
    };

    const handlePin = (id: string) => {
        togglePin(id);
        setContextMenu(null);
    };

    // 渲染单个 adapter 项
    const renderAdapterItem = (adapter: ServiceAdapter) => {
        const isActive = activeBotIds.includes(adapter.id);
        const isPinned = adapterPreferences.find(p => p.id === adapter.id)?.isPinned;
        const host = getAdapterHost(adapter);
        const displayName = adapter.displayName ?? adapter.name;
        const initials = adapter.name.substring(0, 2).toUpperCase();
        const tone = getAdapterTone(adapter.id);

        return (
            <div
                key={adapter.id}
                className={cn(
                    "sidebar-item group mb-2",
                    isActive && "sidebar-item-active"
                )}
                title={adapter.name}
            >
                <button
                    onClick={() => onToggleBot(adapter.id)}
                    onContextMenu={(e) => handleContextMenu(e, adapter.id)}
                    className="flex w-full items-center gap-3"
                >
                    {isActive && (
                        <div className="absolute left-0 top-1/2 h-7 w-[2px] -translate-y-1/2 rounded-full bg-[#bec8d5] shadow-[0_0_12px_rgba(190,200,213,0.32)]" />
                    )}

                    <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-[14px] border text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                        "bg-gradient-to-br",
                        tone,
                        isActive ? "border-[#bec8d5]/25" : "border-white/[0.08]"
                    )}>
                        {initials}
                    </div>

                    <div className="min-w-0 flex-1 text-left">
                        <div className={cn(
                            "truncate text-[13px] font-medium",
                            isActive ? "text-white" : "text-slate-100"
                        )}>
                            {displayName}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                            <span className="truncate text-[11px] text-slate-500">{host}</span>
                            {/* 稳定等级标记 */}
                            {adapter.stabilityLevel === 'fragile' && (
                                <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-400/80">
                                    易失效
                                </span>
                            )}
                        </div>
                    </div>
                </button>

                <div className="flex items-center gap-1">
                    {isActive && (
                        <span className="sidebar-item-badge mr-1">使用中</span>
                    )}
                    {/* 置顶按钮外显 */}
                    <button
                        onClick={() => handlePin(adapter.id)}
                        className={cn(
                            "rounded-full p-1.5 transition-all",
                            isPinned
                                ? "text-[#bec8d5] opacity-100"
                                : "text-slate-600 opacity-0 group-hover:opacity-100 hover:text-slate-300"
                        )}
                        title={isPinned ? "取消置顶" : "置顶"}
                    >
                        <Pin className={cn("h-3.5 w-3.5", isPinned && "rotate-45")} />
                    </button>
                </div>
            </div>
        );
    };

    // 分类顺序
    const categoryOrder: AdapterCategory[] = ['general', 'chinese', 'coding', 'search', 'long-context', 'custom'];

    return (
        <div
            className={cn(
                "pointer-events-none fixed inset-x-0 top-0 bottom-[76px] z-50",
                isOpen && "pointer-events-auto"
            )}
        >
            <button
                type="button"
                aria-label="关闭模型栏"
                onClick={onClose}
                className={cn(
                    "absolute inset-0 bg-slate-950/24 transition-opacity duration-200",
                    isOpen ? "opacity-100" : "opacity-0"
                )}
            />

            <div className={cn(
                "sidebar-shell transition-transform duration-200 ease-[cubic-bezier(0.22,0.61,0.36,1)]",
                isOpen ? "translate-x-0" : "-translate-x-[calc(100%+24px)]",
            )}>
                <div className="px-3 pb-3 pt-3">
                    <div className="sidebar-brand">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/[0.07] bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                                    <Sparkles className="h-4.5 w-4.5 text-[#c2ccd6]" />
                                </div>
                                <div>
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                                        Models
                                    </div>
                                    <div className="mt-1 text-[18px] font-semibold text-white">
                                        模型栏
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={onClose}
                                className="btn-icon mt-0.5"
                                title="关闭模型栏"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-3 text-[12px] text-slate-400">
                            已激活 {activeBotIds.length} 个模型
                        </div>
                    </div>
                </div>

                {/* 搜索框 */}
                <div className="px-3 pb-2">
                    <div className="flex items-center gap-2 rounded-[12px] border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                        <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                        <input
                            type="text"
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            placeholder="搜索模型名称、域名、标签..."
                            className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-slate-200 placeholder:text-slate-600 outline-none focus:ring-0"
                        />
                        {searchKeyword && (
                            <button
                                onClick={() => setSearchKeyword('')}
                                className="shrink-0 rounded-full p-0.5 text-slate-500 hover:text-slate-300"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-3 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {/* 搜索无结果 */}
                    {filteredAdapters.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Search className="mb-3 h-6 w-6 text-slate-700" />
                            <p className="text-[13px] text-slate-600">没有找到匹配的模型</p>
                        </div>
                    )}

                    {/* 常用模型（置顶） */}
                    {groupedAdapters.pinned.length > 0 && (
                        <>
                            <div className="px-2 pb-2 pt-3">
                                <h3 className="sidebar-section-title truncate">常用模型</h3>
                            </div>
                            {groupedAdapters.pinned.map(renderAdapterItem)}
                            <div className="h-4" />
                        </>
                    )}

                    {/* 按 category 分组 */}
                    {categoryOrder.map(cat => {
                        const items = groupedAdapters.groups[cat];
                        if (!items || items.length === 0) return null;

                        return (
                            <div key={cat}>
                                <div className="px-2 pb-2 pt-3">
                                    <h3 className="sidebar-section-title truncate">
                                        {CATEGORY_LABELS[cat]}
                                    </h3>
                                </div>
                                {items.map(renderAdapterItem)}
                            </div>
                        );
                    })}
                </div>

                <div className={cn(
                    "flex h-[76px] min-h-[76px] w-full items-center justify-between px-3",
                    "border-t border-white/[0.06] bg-white/[0.02]"
                )}>
                    <button
                        onClick={onOpenSettings}
                        className="btn-secondary h-11 flex-1 justify-center"
                        title="设置"
                    >
                        <SettingsIcon className="h-4 w-4" />
                        设置
                    </button>
                </div>
            </div>

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                >
                    <ContextMenuItem
                        onClick={() => handlePin(contextMenu.adapterId)}
                        icon={adapterPreferences.find(p => p.id === contextMenu.adapterId)?.isPinned ? <PinOff size={12} /> : <Pin size={12} />}
                    >
                        {adapterPreferences.find(p => p.id === contextMenu.adapterId)?.isPinned ? "取消置顶" : "置顶"}
                    </ContextMenuItem>
                </ContextMenu>
            )}
        </div>
    );
}
