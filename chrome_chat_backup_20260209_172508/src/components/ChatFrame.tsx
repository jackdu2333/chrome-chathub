import { useState, useRef } from 'react';
import { RefreshCw, Maximize2, Minimize2, XCircle, GripVertical } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ChatBot } from '../types';
import { useStore } from '../store';

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
                "relative flex flex-col rounded-2xl overflow-hidden border shadow-2xl transition-all duration-300 group",
                isDarkMode
                    ? "bg-gray-900/80 border-white/10 hover:border-white/20"
                    : "bg-white border-gray-200 hover:border-gray-300",
                isFocused ? "z-40 fixed inset-4 shadow-2xl ring-1 ring-white/10" : "w-full h-full hover:shadow-2xl",
                isDragging && "shadow-2xl ring-2 ring-blue-500/50 scale-[1.02] rotate-1", // Visual feedback when dragging (overlay)
                className
            )}
        >
            {/* Header / Toolbar */}
            <div
                className={cn(
                    "h-10 flex items-center px-3 gap-2 border-b flex-shrink-0 transition-all duration-200 opacity-100 translate-y-0",
                    isDarkMode ? "bg-gray-900 border-gray-800" : "bg-gray-50 border-gray-200"
                )}
                onDoubleClick={onToggleFocus}
                title="双击标题栏放大"
            >
                {/* Drag Handle - Force Render for Debug */}
                <div
                    {...(dragListeners || {})}
                    className={cn(
                        "cursor-grab active:cursor-grabbing p-1 rounded hover:bg-white/10 transition-colors mr-1 flex-shrink-0",
                        isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
                    )}
                    title="按住拖拽排序"
                    style={{ display: 'flex' }} // Force display
                >
                    <GripVertical size={18} />
                </div>

                {/* Title Badge */}
                <div className="mr-auto flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                    <span className={cn(
                        "text-xs font-bold",
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                    )}>{bot.name}</span>
                </div>

                <button
                    onClick={handleReload}
                    className={cn(
                        "p-1.5 rounded-lg transition-colors",
                        isDarkMode ? "text-gray-400 hover:bg-gray-800 hover:text-white" : "text-gray-500 hover:bg-gray-200 hover:text-gray-900"
                    )}
                    title="重新加载"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                </button>

                <button
                    onClick={onToggleFocus}
                    className={cn(
                        "p-1.5 rounded-lg transition-colors",
                        isDarkMode ? "text-gray-400 hover:bg-gray-800 hover:text-white" : "text-gray-500 hover:bg-gray-200 hover:text-gray-900"
                    )}
                    title={isFocused ? "最小化" : "最大化 (聚焦模式)"}
                >
                    {isFocused ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>

                <button
                    onClick={onRemove}
                    className={cn(
                        "p-1.5 rounded-lg transition-colors",
                        isDarkMode ? "text-gray-400 hover:bg-red-500/10 hover:text-red-400" : "text-gray-500 hover:bg-red-50 hover:text-red-500"
                    )}
                    title="关闭窗口"
                >
                    <XCircle className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Webview / Iframe */}
            <div className="flex-1 bg-white relative">
                <iframe
                    key={`${bot.instanceId}-${reloadKey}`}
                    ref={iframeRef}
                    src={bot.url}
                    className="w-full h-full border-none"
                    style={{
                        width: '100%',
                        height: '100%',
                        minWidth: '100%',
                        minHeight: '100%'
                    }}
                    allow="microphone; camera; clipboard-write; fullscreen"
                    title={bot.name}
                />


            </div>
        </div>
    );
}
