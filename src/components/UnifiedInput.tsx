import { KeyboardEvent } from 'react';
import { Send, Link2, Link2Off, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';
import { broadcastMessage } from '../lib/broadcast';

interface UnifiedInputProps {
    // onTogglePrompts removed
}

export function UnifiedInput({ }: UnifiedInputProps) {
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
            "absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl h-[72px] rounded-[20px] flex items-center px-4 gap-3 z-50 transition-all duration-300",
            "bg-white/80 dark:bg-[#2c2c2e]/80 backdrop-blur-2xl backdrop-saturate-200",
            "border border-white/20 dark:border-white/[0.08] shadow-2xl shadow-black/20",
            // macOS floating panel vibe
        )}>
            {/* Section 1: Utility Buttons (Left) */}
            <div className="flex items-center gap-1">
                <button
                    onClick={handleNewChat}
                    className="btn-icon p-2.5"
                    title="新对话"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            {/* Section 3: Input Area (Middle) */}
            <div className={cn(
                "flex-1 h-11 rounded-[12px] flex items-center px-4 transition-all duration-200",
                isDarkMode
                    ? "bg-black/20 focus-within:bg-black/30 border border-transparent focus-within:border-white/10"
                    : "bg-black/5 focus-within:bg-black/10 border border-transparent focus-within:border-black/5"
            )}>
                <textarea
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入消息..."
                    className={cn(
                        "w-full bg-transparent border-none focus:ring-0 resize-none h-full py-2.5 outline-none text-[15px] font-medium placeholder:font-normal",
                        isDarkMode ? "text-white placeholder-white/30" : "text-black placeholder-black/40",
                        "[&::-webkit-scrollbar]:hidden" // Hide Chrome/Safari/Edge scrollbar
                    )}
                    style={{ scrollbarWidth: 'none' }} // Hide Firefox scrollbar
                />
            </div>

            {/* Send Button */}
            {draftContent.trim() && (
                <button
                    onClick={handleSend}
                    className="btn-primary rounded-full p-2.5 shadow-lg shadow-blue-500/30"
                >
                    <Send className="w-4 h-4 ml-0.5" />
                </button>
            )}

            {/* Section 4: Sync Toggle (Right) */}
            <div className="pl-2 border-l border-black/5 dark:border-white/5">
                <button
                    onClick={() => setSyncEnabled(!isSyncEnabled)}
                    className={cn(
                        "btn-icon p-2.5",
                        isSyncEnabled && "text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/30"
                    )}
                    title={isSyncEnabled ? "同步发送开启" : "同步发送关闭"}
                >
                    {isSyncEnabled ? <Link2 className="w-5 h-5" /> : <Link2Off className="w-5 h-5 opacity-70" />}
                </button>
            </div>
        </div>
    );
}
