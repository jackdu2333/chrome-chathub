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
        <div
            className={cn(
                // 1. 卡片主容器 (The Frame Container)
                "relative flex flex-col h-full overflow-hidden", // Flex 布局锁定 & 物理切割
                "rounded-2xl transition-all duration-300 group",

                // Color mappings:
                // Bg: Light=White / Dark=Gray-900
                // Border: Light=Gray-200/50 / Dark=White/10
                "bg-white dark:bg-gray-900",
                "border border-gray-200/50 dark:border-white/10",

                // 状态样式
                isFocused ? "z-40 fixed inset-4 shadow-2xl ring-1 ring-black/5 dark:ring-white/10" : "w-full hover:shadow-lg dark:hover:shadow-none shadow-md dark:shadow-none",
                isDragging && "shadow-2xl ring-2 ring-blue-500/50 scale-[1.02] rotate-1 z-50",
                className
            )}
        >
            {/* 2. 标题栏区域 (Header / Drag Handle) */}
            <div
                className={cn(
                    "flex-shrink-0 h-8 flex items-center px-3 gap-2", // 布局 & 高度: h-9 -> h-8 (32px)

                    // Color mappings:
                    // Header Border: Light=Gray-100 / Dark=White/5
                    // Header Bg: Light=White/50 / Dark=Gray-800/50
                    "border-b border-gray-100 dark:border-white/5 bg-white/50 dark:bg-gray-800/50",

                    "transition-all duration-200 backdrop-blur-md select-none"
                )}
                onDoubleClick={onToggleFocus}
                title="双击标题栏放大"
            >
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

            {/* 3. 网页内容区域 (Iframe Wrapper) */}
            <div className="flex-1 relative min-h-0 bg-transparent">
                <iframe
                    key={`${bot.instanceId}-${reloadKey}`}
                    ref={iframeRef}
                    src={bot.url}
                    className="absolute inset-0 w-full h-full border-none bg-transparent" // Iframe 属性
                    allow="microphone; camera; clipboard-write; fullscreen"
                    title={bot.name}
                    style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
                />
            </div>
        </div>
    );
}
