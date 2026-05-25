import { Pin, PinOff, Settings as SettingsIcon, Sparkles, X } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { cn } from '../lib/utils';
import type { ServiceAdapter } from '../types';

interface SidebarProps {
    adapters: ServiceAdapter[];
    activeBotIds: string[];
    onToggleBot: (id: string) => void;
    onOpenSettings: () => void;
    isOpen: boolean;
    onClose: () => void;
}

export function Sidebar({
    adapters,
    activeBotIds,
    onToggleBot,
    onOpenSettings,
    isOpen,
    onClose,
}: SidebarProps) {
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; adapterId: string } | null>(null);

    const adapterPreferences = useStore(state => state.adapterPreferences);
    const togglePin = useStore(state => state.togglePin);

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

            // Stable sort based on original index in the adapters array
            const indexA = adapters.indexOf(a);
            const indexB = adapters.indexOf(b);
            return indexA - indexB;
        });
    }, [adapters, adapterPreferences]);

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

    const handleContextMenu = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, adapterId: id });
    };

    const handlePin = (id: string) => {
        togglePin(id);
        setContextMenu(null);
    };

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

                <div className="flex-1 overflow-y-auto px-3 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {(() => {
                        const pinnedAdapters = sortedAdapters.filter(a => adapterPreferences.find(p => p.id === a.id)?.isPinned);
                        const unpinnedAdapters = sortedAdapters.filter(a => !adapterPreferences.find(p => p.id === a.id)?.isPinned);

                        const renderAdapterItem = (adapter: ServiceAdapter) => {
                            const isActive = activeBotIds.includes(adapter.id);
                            const isPinned = adapterPreferences.find(p => p.id === adapter.id)?.isPinned;
                            const host = getAdapterHost(adapter);
                            const initials = adapter.name.substring(0, 2).toUpperCase();
                            const tone = getAdapterTone(adapter.id);

                            return (
                                <button
                                    key={adapter.id}
                                    onClick={() => onToggleBot(adapter.id)}
                                    onContextMenu={(e) => handleContextMenu(e, adapter.id)}
                                    className={cn(
                                        "sidebar-item group mb-2",
                                        isActive && "sidebar-item-active"
                                    )}
                                    title={adapter.name}
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
                                            {adapter.name}
                                        </div>
                                        <div className="mt-1 truncate text-[11px] text-slate-500">
                                            {host}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-2">
                                        {isActive ? (
                                            <span className="sidebar-item-badge">使用中</span>
                                        ) : isPinned ? (
                                            <Pin className="h-3.5 w-3.5 rotate-45 text-slate-500" />
                                        ) : null}
                                    </div>
                                </button>
                            );
                        };

                        return (
                            <>
                                        {pinnedAdapters.length > 0 && (
                                            <>
                                                <div className="px-2 pb-2 pt-3">
                                                    <h3 className="sidebar-section-title truncate">
                                                        常用模型
                                                    </h3>
                                                </div>
                                                {pinnedAdapters.map(renderAdapterItem)}
                                                <div className="h-4" />
                                            </>
                                )}

                                        {unpinnedAdapters.length > 0 && (
                                            <>
                                                <div className="px-2 pb-2 pt-3">
                                                    <h3 className="sidebar-section-title truncate">
                                                        {pinnedAdapters.length > 0 ? "全部模型" : "模型库"}
                                                    </h3>
                                                </div>
                                                {unpinnedAdapters.map(renderAdapterItem)}
                                            </>
                                        )}
                            </>
                        );
                    })()}
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
