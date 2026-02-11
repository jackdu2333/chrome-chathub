import { useState, useRef } from 'react';
import { RefreshCw, Maximize2, Minimize2, XCircle, GripVertical } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';
import type { ChatBot } from '../types';

interface ChatFrameProps {
    bot: ChatBot;
    isFocused: boolean;
    onToggleFocus: () => void;
    onRemove: () => void;
    className?: string;
    // New props for DnD
    dragListeners?: any; // Dnd-kit listeners (without attributes)
    isDragging?: boolean;
}

export function ChatFrame({ bot, isFocused, onToggleFocus, onRemove, className, dragListeners, isDragging }: ChatFrameProps) {
    const [reloadKey, setReloadKey] = useState(0);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const isDarkMode = useStore(state => state.isDarkMode);

    const handleReload = () => {
        setReloadKey(prev => prev + 1);
    };

    return (
        // 1. 卡片主容器 (Anchor/Placeholder) - Always stays in grid flow
        <div
            className={cn(
                "relative h-full w-full", // Occupy grid space
                className
            )}
        >
            {/* 2. 内容包装器 (Content Wrapper) - Pops out when focused */}
            {/* Swapping from static/relative to fixed MIGHT cause reload in some browsers, 
                 but it's safer than destroying the parent. 
                 To be extra safe, we make it 'absolute' usually, and 'fixed' when focused? 
                 Actually 'h-full w-full' implies static flow. 
                 Let's try: Always 'absolute' inside the relative anchor? 
                 No, simple is best first. */}
            <div
                className={cn(
                    "flex flex-col overflow-hidden bg-white dark:bg-gray-900 transition-all duration-300",
                    "border border-gray-200/50 dark:border-white/10",

                    isFocused
                        ? "fixed top-4 left-4 right-4 bottom-[88px] z-40 rounded-2xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10" // Pop out with safe bottom zone
                        : "absolute inset-0 w-full h-full rounded-2xl hover:shadow-lg dark:hover:shadow-none shadow-md", // Stay in anchor

                    isDragging && "shadow-2xl ring-2 ring-blue-500/50 scale-[1.02] rotate-1 z-50 cursor-grabbing"
                )}
            >
                {/* 3. 标题栏区域 (Header / Drag Handle) */}
                <div
                    className={cn(
                        "flex-shrink-0 h-8 flex items-center px-3 gap-2",
                        "border-b border-gray-100 dark:border-white/5 bg-white/50 dark:bg-gray-800/50",
                        "transition-all duration-200 backdrop-blur-md select-none"
                    )}
                    onDoubleClick={onToggleFocus}
                    title="双击标题栏放大"
                >
                    {/* ... Header Content ... */}
                    {/* Drag Handle */}
                    <div
                        {...(dragListeners || {})}
                        className={cn(
                            "cursor-grab active:cursor-grabbing p-1 rounded-md transition-colors mr-1 flex-shrink-0",
                            "hover:bg-gray-200/50 dark:hover:bg-white/5",
                            "text-gray-400 dark:text-gray-500"
                        )}
                        title="按住拖拽排序"
                        style={{ display: 'flex' }}
                    >
                        <GripVertical className="w-4 h-4" />
                    </div>

                    <div className="mr-auto flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></span>
                        <span className="text-xs font-medium tracking-wide text-gray-700 dark:text-gray-200">
                            {bot.name}
                        </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleReload}
                            className="btn-icon hover:bg-gray-200 dark:hover:bg-white/10 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                            title="重新加载"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>

                        <button
                            onClick={onToggleFocus}
                            className="btn-icon hover:bg-gray-200 dark:hover:bg-white/10 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                            title={isFocused ? "最小化" : "最大化"}
                        >
                            {isFocused ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>

                        <button
                            onClick={onRemove}
                            className="btn-icon hover:bg-red-100 dark:hover:bg-red-500/20 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                            title="关闭窗口"
                        >
                            <XCircle className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* 4. 网页内容区域 (Iframe Wrapper) */}
                <div className="flex-1 relative min-h-0 bg-transparent">
                    <iframe
                        key={`${bot.instanceId}-${reloadKey}`}
                        ref={iframeRef}
                        src={bot.url}
                        className="absolute inset-0 w-full h-full border-none bg-transparent"
                        allow="microphone; camera; clipboard-write; fullscreen"
                        title={bot.name}
                        style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
                    />
                </div>
            </div>
        </div>
    );
}
