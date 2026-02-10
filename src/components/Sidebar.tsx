import { Settings as SettingsIcon, Pin, PinOff, PanelLeft } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { cn } from '../lib/utils';
import type { ServiceAdapter } from '../types';

interface SidebarProps {
    adapters: ServiceAdapter[];
    activeBotIds: string[];
    onToggleBot: (id: string) => void;
    // onTogglePrompts, // Unused
    // isPromptsOpen,   // Unused
    onOpenSettings: () => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    className?: string;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

export function Sidebar({
    adapters,
    activeBotIds,
    onToggleBot,
    // onTogglePrompts, // Unused
    // isPromptsOpen,   // Unused
    onOpenSettings,
    isCollapsed,
    onToggleCollapse,
    className,
    onMouseEnter,
    onMouseLeave
}: SidebarProps) {
    // const [isCollapsed, setIsCollapsed] = useState(false); // Relocated to App.tsx
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; adapterId: string } | null>(null);

    const adapterPreferences = useStore(state => state.adapterPreferences);
    const togglePin = useStore(state => state.togglePin);
    // const isDarkMode = useStore(state => state.isDarkMode); // Unused
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
                "relative h-full transition-[width] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] z-40 flex-shrink-0 min-w-0",
                isCollapsed ? "w-0" : "w-[240px]",
                className
            )}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Inner Sliding Container - macOS Sidebar Style */}
            <div className={cn(
                "absolute left-0 top-0 h-full w-[240px] border-r flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]",
                isCollapsed ? "-translate-x-full" : "translate-x-0",
                isCollapsed ? "-translate-x-full" : "translate-x-0",
                // Sidebar Bg: Light=White / Dark=Gray-950
                // Sidebar Border: Light=Gray-200 / Dark=White/10
                "bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-white/10",
                "shadow-2xl"
            )}>

                {/* Top Section - Header with Controls */}
                <div className={cn(
                    "h-[40px] min-h-[40px] w-full flex items-center justify-between px-3 border-b border-gray-100 dark:border-white/[0.05]",
                    "bg-gray-50/50 dark:bg-white/[0.02]"
                )}>
                    {/* Left: Settings Button */}
                    <button
                        onClick={onOpenSettings}
                        className="btn-icon w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                        title="设置"
                    >
                        <SettingsIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>

                    {/* Right: Collapse Button */}
                    <button
                        onClick={onToggleCollapse}
                        className="btn-icon w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                        title="收起侧边栏"
                    >
                        <PanelLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                {/* Bot List */}
                <div className="flex-1 flex flex-col gap-1 w-full px-2 py-3 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {sortedAdapters.map((adapter) => {
                        const isActive = activeBotIds.includes(adapter.id);
                        const isPinned = adapterPreferences.find(p => p.id === adapter.id)?.isPinned;

                        return (
                            <button
                                key={adapter.id}
                                onClick={() => onToggleBot(adapter.id)}
                                onContextMenu={(e) => handleContextMenu(e, adapter.id)}
                                className={cn(
                                    "w-full px-3 py-2 mx-0 justify-start transition-all duration-200 group relative flex-shrink-0 text-[13px] flex items-center gap-3 rounded-[8px]",
                                    isActive
                                        ? "bg-blue-50 text-blue-600 dark:bg-[#007AFF]/20 dark:text-white shadow-sm dark:shadow-[inset_0_0_12px_rgba(0,122,255,0.15)] ring-1 ring-blue-500/20 dark:ring-[#007AFF]/30"
                                        : "hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                )}
                                title={adapter.name}
                            >
                                {/* Icon Placeholder */}
                                <div className={cn(
                                    "w-5 h-5 flex items-center justify-center transition-colors rounded-[5px]",
                                    // Icon style update
                                    "border border-current opacity-90",
                                    isActive ? "text-blue-500 border-blue-500" : "text-gray-400 border-gray-300 dark:text-gray-500 dark:border-gray-600"
                                )}>
                                    <span className="text-[10px] font-medium opacity-90">{adapter.name.substring(0, 1)}</span>
                                </div>

                                {/* Name */}
                                <span className="truncate flex-1 text-left font-medium opacity-90">{adapter.name}</span>

                                {/* Pin Indicator */}
                                {isPinned && (
                                    <Pin className="w-3 h-3 opacity-50 rotate-45 stroke-[1.5]" />
                                )}
                            </button>
                        );
                    })}
                </div>

            </div>

            {/* Shift/Toggle Button Removed - Now in App.tsx floating */}
            {/* Context Menu outside? - contextMenu is currently rendered at the end of wrapper */}

            {/* Context Menu */}
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
