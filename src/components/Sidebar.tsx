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
                isCollapsed ? "w-0" : "w-[220px]",
                className
            )}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Inner Sliding Container - macOS Sidebar Style */}
            <div className={cn(
                "absolute left-0 top-0 h-full border-r flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]",
                isCollapsed ? "-translate-x-full" : "translate-x-0",
                // Width update: 240px -> 260px -> 220px
                "w-[220px]",
                // Sidebar Bg: Light=White / Dark=#0A0A0A (Deep Dark)
                // Sidebar Border: Light=Gray-200 / Dark=White/6% (Subtle)
                "bg-white dark:bg-[#0A0A0A] border-r border-gray-200 dark:border-white/[0.06]",
                "shadow-2xl"
            )}>

                {/* Bot List (Moved to Top) */}
                <div className="flex-1 flex flex-col w-full px-2 py-3 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

                    {/* Render Group Utility */}
                    {(() => {
                        // Split adapters into Pinned and Unpinned
                        const pinnedAdapters = sortedAdapters.filter(a => adapterPreferences.find(p => p.id === a.id)?.isPinned);
                        const unpinnedAdapters = sortedAdapters.filter(a => !adapterPreferences.find(p => p.id === a.id)?.isPinned);

                        const renderAdapterItem = (adapter: ServiceAdapter) => {
                            const isActive = activeBotIds.includes(adapter.id);
                            const isPinned = adapterPreferences.find(p => p.id === adapter.id)?.isPinned;

                            return (
                                <button
                                    key={adapter.id}
                                    onClick={() => onToggleBot(adapter.id)}
                                    // Make sure context menu works
                                    onContextMenu={(e) => handleContextMenu(e, adapter.id)}
                                    className={cn(
                                        // Base layout: Height 34px, Padding 8px (approx via px-2 in parent + local if needed, keeping px-3 from old code or adjusting to px-2 (8px))
                                        // Prompt asks for padding 8px. "px-2" in tailwind is 8px.
                                        "w-full h-[34px] px-2 mx-0 justify-start transition-all duration-200 group relative flex-shrink-0 text-[14px] flex items-center gap-2 rounded-[6px] mb-1.5",

                                        // Active State
                                        isActive
                                            ? cn(
                                                // Light mode active
                                                "bg-blue-50 text-blue-600",
                                                // Dark mode active: Dark Glass (Critical Fix)
                                                // 1. Background: 5% White Transparency (Very dark, subtle)
                                                "dark:bg-white/[0.05]",
                                                // 2. Content: Pure White, Weight 700 (Bold), Sharp Contrast
                                                "dark:text-white dark:font-bold",
                                                // 3. Border: Subtle definition
                                                "dark:border-y dark:border-white/[0.05]",
                                                // Shadows/Glows removed for "cleaner" look mostly, preserving some light mode feel
                                                "shadow-sm dark:shadow-none"
                                            )
                                            // Default State
                                            : "hover:bg-gray-100 dark:hover:bg-white/[0.04] text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white"
                                    )}
                                    title={adapter.name}
                                >
                                    {/* Active Indicator (Left Edge) - Only visible when active */}
                                    {isActive && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[14px] w-[3px] bg-blue-500 rounded-r-[2px] shadow-[0_0_12px_2px_rgba(59,130,246,0.6)]" />
                                    )}

                                    {/* Icon Placeholder */}
                                    <div className={cn(
                                        "w-5 h-5 flex items-center justify-center transition-colors rounded-[5px]",
                                        // Remove borders for cleaner look? Prompt says "remove all high saturation color blocks... preserve subtle border gloss".
                                        // I'll keep the border but make it very subtle.
                                        "border opacity-90",
                                        isActive
                                            ? "border-blue-200 dark:border-white/10 text-blue-500 dark:text-white shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                                            : "border-gray-200 dark:border-white/10 text-gray-400 dark:text-white/60 group-hover:dark:text-white/70 group-hover:dark:border-white/20"
                                    )}>
                                        {/* Using local image if available or first char? The code uses char. */}
                                        {/* Ideally we'd use the actual icon if available in adapter service */}
                                        <span className="text-[10px] font-semibold">{adapter.name.substring(0, 1)}</span>
                                    </div>

                                    {/* Name */}
                                    <span className={cn(
                                        "truncate flex-1 text-left opacity-90",
                                        isActive ? "font-bold" : "font-semibold"
                                    )}>
                                        {adapter.name}
                                    </span>

                                    {/* Pin Indicator - Optional to keep, but section header implies it */}
                                    {isPinned && !pinnedAdapters.length && (
                                        <Pin className="w-3 h-3 opacity-50 rotate-45 stroke-[1.5]" />
                                    )}
                                </button>
                            );
                        };

                        return (
                            <>
                                {/* PINNED SECTION */}
                                {pinnedAdapters.length > 0 && (
                                    <>
                                        <div className="px-2 mt-2 mb-1">
                                            <h3 className="text-[11px] uppercase tracking-[1px] font-medium text-gray-400 dark:text-white/30 truncate">
                                                Favorites
                                            </h3>
                                        </div>
                                        {pinnedAdapters.map(renderAdapterItem)}

                                        {/* Spacer between sections */}
                                        <div className="h-4" />
                                    </>
                                )}

                                {/* ALL MODELS SECTION */}
                                {unpinnedAdapters.length > 0 && (
                                    <>
                                        {pinnedAdapters.length > 0 && (
                                            <div className="px-2 mt-2 mb-1">
                                                <h3 className="text-[11px] uppercase tracking-[1px] font-medium text-gray-400 dark:text-white/30 truncate">
                                                    Models
                                                </h3>
                                            </div>
                                        )}
                                        {unpinnedAdapters.map(renderAdapterItem)}
                                    </>
                                )}
                            </>
                        );
                    })()}
                </div>

                {/* Bottom Section - Controls (Moved from Top) */}
                <div className={cn(
                    "h-[60px] min-h-[60px] w-full flex items-center justify-between px-4",
                    // Changed from border-b to border-t
                    "border-t border-gray-100 dark:border-white/[0.06]",
                    "bg-gray-50/50 dark:bg-white/[0.02]"
                )}>
                    {/* Left: Settings Button */}
                    <button
                        onClick={onOpenSettings}
                        className="btn-icon w-[42px] h-[42px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                        title="设置"
                    >
                        <SettingsIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                    </button>

                    {/* Right: Collapse Button */}
                    <button
                        onClick={onToggleCollapse}
                        className="btn-icon w-[42px] h-[42px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                        title="收起侧边栏"
                    >
                        <PanelLeft className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                    </button>
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
