import { KeyboardEvent } from 'react';
import { Send, Link2, Link2Off, Plus, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';
import { broadcastMessage } from '../lib/broadcast';

interface UnifiedInputProps {
    onTogglePrompts?: () => void;
}

export function UnifiedInput({ onTogglePrompts }: UnifiedInputProps) {
    const { isSyncEnabled, setSyncEnabled, reloadAllBots, draftContent, setDraftContent, isDarkMode } = useStore();

    const handleSend = () => {
        if (!draftContent.trim()) return;

        // Broadcast to all active iframes
        broadcastMessage('USER_MESSAGE', {
            text: draftContent,
            autoSubmit: isSyncEnabled
        });

        setDraftContent('');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleNewChat = () => {
        reloadAllBots();
    };

    return (
        <div className={cn(
            "absolute bottom-4 left-4 right-4 h-[90px] backdrop-blur-2xl border rounded-2xl flex items-center px-6 gap-4 z-50 shadow-lg",
            isDarkMode ? "bg-gray-900 border-white/10" : "bg-white/90 border-gray-200"
        )}>
            {/* Section 1: New Chat */}
            <button
                onClick={handleNewChat}
                className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors shrink-0",
                    isDarkMode ? "text-gray-300 hover:text-white hover:bg-white/10" : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                )}
                title="新对话"
            >
                <Plus className="w-5 h-5" />
                <span className="text-sm font-medium">新对话</span>
            </button>

            {/* Section 2: Prompts Library */}
            {onTogglePrompts && (
                <button
                    onClick={onTogglePrompts}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors shrink-0",
                        isDarkMode ? "text-gray-300 hover:text-blue-400 hover:bg-white/10" : "text-gray-700 hover:text-blue-600 hover:bg-blue-50"
                    )}
                    title="提示词库"
                >
                    <MessageSquare className="w-5 h-5" />
                    <span className="text-sm font-medium">提示词库</span>
                </button>
            )}

            {/* Section 3: Input Area (Flex-1) */}
            <div className={cn(
                "flex-1 h-14 rounded-lg flex items-center px-4 border transition-colors",
                isDarkMode ? "bg-gray-800/50 border-white/5 hover:border-white/10" : "bg-gray-100 border-gray-300 hover:border-gray-400"
            )}>
                <textarea
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入消息..."
                    className={cn(
                        "w-full bg-transparent border-none focus:ring-0 resize-none h-8 py-0 leading-8 outline-none text-base",
                        isDarkMode ? "text-gray-100 placeholder-gray-500" : "text-gray-900 placeholder-gray-400"
                    )}
                    style={{ minHeight: '32px' }}
                />
                {draftContent.trim() && (
                    <button
                        onClick={handleSend}
                        className="ml-2 p-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-500 transition-all shrink-0"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Section 4: Sync Toggle */}
            <button
                onClick={() => setSyncEnabled(!isSyncEnabled)}
                className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors shrink-0",
                    isSyncEnabled
                        ? "text-blue-400 bg-blue-500/10"
                        : isDarkMode
                            ? "text-gray-300 hover:text-white hover:bg-white/10"
                            : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                )}
                title={isSyncEnabled ? "同步发送开启" : "同步发送关闭"}
            >
                {isSyncEnabled ? <Link2 className="w-5 h-5" /> : <Link2Off className="w-5 h-5" />}
                <span className="text-sm font-medium">{isSyncEnabled ? "同步开启" : "同步关闭"}</span>
            </button>
        </div>
    );
}
