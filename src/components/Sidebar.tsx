import { MessageSquare, Settings as SettingsIcon, ChevronLeft, ChevronRight, Pin, PinOff } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { cn } from '../lib/utils';
import type { ServiceAdapter } from '../types';

// ... imports

interface SidebarProps {
    adapters: ServiceAdapter[];
    activeBotIds: string[];
    onToggleBot: (id: string) => void;
    onTogglePrompts: () => void;
    isPromptsOpen: boolean;
    onOpenSettings: () => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    className?: string;
}

export function Sidebar({
    adapters,
    activeBotIds,
    onToggleBot,
    onTogglePrompts,
    isPromptsOpen,
    onOpenSettings,
    isCollapsed,
    onToggleCollapse,
    className
}: SidebarProps) {
    // const [isCollapsed, setIsCollapsed] = useState(false); // Relocated to App.tsx
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; adapterId: string } | null>(null);

    const adapterPreferences = useStore(state => state.adapterPreferences);
    const togglePin = useStore(state => state.togglePin);
    const isDarkMode = useStore(state => state.isDarkMode);
    // const updateAdapterOrder = useStore(state => state.updateAdapterOrder); // For future manual sorting

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
                "relative h-full transition-[width] duration-300 ease-in-out z-40 flex-shrink-0 min-w-0",
                isCollapsed ? "w-0" : "w-64",
                className
            )}
        >
            {/* Inner Sliding Container - Holds content */}
            <div className={cn(
                "absolute left-0 top-0 h-full w-64 border-r flex flex-col py-4 gap-4 transition-transform duration-300 ease-in-out",
                isCollapsed ? "-translate-x-full" : "translate-x-0",
                isDarkMode ? "bg-gray-900 border-gray-800" : "bg-gray-100 border-gray-200"
            )}>

                {/* Top Section */}
                <div className={cn(
                    "px-4 border-b w-full flex flex-col gap-3 pb-6",
                    isDarkMode ? "border-gray-800" : "border-gray-200"
                )}>
                    <h2 className={cn(
                        "text-xs font-bold uppercase tracking-wider px-2",
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                    )}>功能</h2>
                    <button
                        onClick={onTogglePrompts}
                        className={cn(
                            "w-full p-3 rounded-xl transition-all duration-200 group relative flex items-center gap-3",
                            isPromptsOpen
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                : isDarkMode
                                    ? "text-blue-500 bg-blue-500/10 hover:bg-gray-800"
                                    : "text-blue-600 bg-blue-50 hover:bg-blue-100"
                        )}
                        title="提示词库"
                    >
                        <MessageSquare className="w-5 h-5" />
                        <span className="font-medium text-sm">提示词库</span>
                    </button>
                </div>

                {/* Bot List */}
                <div className="flex-1 flex flex-col gap-2 w-full px-4 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <h2 className={cn(
                        "text-xs font-bold uppercase tracking-wider px-2 mb-1",
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                    )}>AI 模型</h2>
                    {sortedAdapters.map((adapter) => {
                        const isActive = activeBotIds.includes(adapter.id);
                        const isPinned = adapterPreferences.find(p => p.id === adapter.id)?.isPinned;

                        return (
                            <button
                                key={adapter.id}
                                onClick={() => onToggleBot(adapter.id)}
                                onContextMenu={(e) => handleContextMenu(e, adapter.id)}
                                className={cn(
                                    "w-full p-2 rounded-xl flex items-center gap-3 transition-all duration-200 group relative border flex-shrink-0",
                                    isActive
                                        ? isDarkMode
                                            ? "bg-gray-800 text-white border-gray-700 shadow-inner"
                                            : "bg-white text-gray-900 border-gray-300 shadow-sm"
                                        : isDarkMode
                                            ? "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 border-transparent"
                                            : "text-gray-600 hover:bg-white/50 hover:text-gray-900 border-transparent"
                                )}
                                title={adapter.name}
                            >
                                {/* Icon Placeholder or Image */}
                                <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-300 border",
                                    isActive
                                        ? isDarkMode
                                            ? "bg-gray-700 border-gray-600"
                                            : "bg-gray-100 border-gray-300"
                                        : isDarkMode
                                            ? "bg-gray-800 border-gray-700"
                                            : "bg-gray-200 border-gray-300"
                                )}>
                                    {/* Assuming icon is a URL or we map it. For now, text fallback */}
                                    <span className="font-bold text-xs">{adapter.name.substring(0, 2)}</span>
                                </div>

                                {/* Name */}
                                <span className="font-medium text-sm truncate flex-1 text-left">{adapter.name}</span>

                                {/* Active Indicator Dot */}
                                {isActive && (
                                    <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                )}

                                {/* Pin Indicator (Small dot or icon) */}
                                {isPinned && (
                                    <Pin className="w-3 h-3 text-yellow-500 absolute top-2 right-2" strokeWidth={3} />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Settings Button (Bottom) */}
                <div className={cn(
                    "mt-auto px-4 py-4 border-t w-full",
                    isDarkMode ? "border-gray-800" : "border-gray-200"
                )}>
                    <button
                        onClick={onOpenSettings}
                        className={cn(
                            "w-full p-3 rounded-xl transition-all duration-200 group relative flex items-center gap-3",
                            isDarkMode
                                ? "text-gray-400 hover:text-white hover:bg-gray-800"
                                : "text-gray-600 hover:text-gray-900 hover:bg-white"
                        )}
                        title="设置"
                    >
                        <SettingsIcon className="w-5 h-5" />
                        <span className="font-medium text-sm">设置</span>
                    </button>
                </div>
            </div>

            {/* Toggle Button - Attached to the right edge of sliding container */}
            <button
                onClick={onToggleCollapse}
                className={cn(
                    "absolute left-full top-1/2 -translate-y-1/2 w-6 h-12 border-y border-r rounded-r-lg flex items-center justify-center transition-all shadow-md z-50 cursor-pointer",
                    isDarkMode
                        ? "bg-gray-900 border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800"
                        : "bg-gray-100 border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-white"
                )}
                title={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
                style={{ marginLeft: -1 }} // Small overlap to blend borders
            >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                >
                    <ContextMenuItem
                        onClick={() => handlePin(contextMenu.adapterId)}
                        icon={adapterPreferences.find(p => p.id === contextMenu.adapterId)?.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                    >
                        {adapterPreferences.find(p => p.id === contextMenu.adapterId)?.isPinned ? "取消置顶" : "置顶"}
                    </ContextMenuItem>
                </ContextMenu>
            )}
        </div>
    );
}
