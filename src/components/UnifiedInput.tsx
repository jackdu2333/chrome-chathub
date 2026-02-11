import { KeyboardEvent, useState, useRef, ClipboardEvent } from 'react';
import { Send, Link2, Link2Off, Plus, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';
import { broadcastMessage } from '../lib/broadcast';

interface UnifiedInputProps {
    // onTogglePrompts removed
}

export function UnifiedInput({ }: UnifiedInputProps) {
    const { isSyncEnabled, setSyncEnabled, reloadAllBots, draftContent, setDraftContent, activeBots } = useStore();
    const [selectedFiles, setSelectedFiles] = useState<{ name: string; type: string; data: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    const windowCount = activeBots.length;

    const handleSend = () => {
        if (!draftContent.trim() && selectedFiles.length === 0) return;

        // Broadcast to all active iframes
        broadcastMessage('USER_MESSAGE', {
            text: draftContent,
            autoSubmit: isSyncEnabled,
            files: selectedFiles
        });

        setDraftContent('');
        setSelectedFiles([]);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.nativeEvent.isComposing) return;

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleNewChat = () => {
        reloadAllBots();
    };

    const processFiles = async (files: File[]) => {
        const processedFiles = await Promise.all(files.map(file => {
            return new Promise<{ name: string; type: string; data: string }>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve({
                        name: file.name,
                        type: file.type,
                        data: reader.result as string
                    });
                };
                reader.readAsDataURL(file);
            });
        }));
        setSelectedFiles(prev => [...prev, ...processedFiles]);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            await processFiles(Array.from(e.target.files));
        }
        // Reset input so same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
        // Check for files in clipboard
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
            e.preventDefault(); // Prevent default paste behavior (e.g. pasting file name)
            await processFiles(Array.from(e.clipboardData.files));
        }
    };

    const handleRemoveFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    /* 
       Refactored Layout: 
       Wrapped in .input-safe-container to handle positioning constrained by sidebar and right buttons.
    */
    return (
        <div className="input-safe-container">
            <div
                className={cn(
                    // Inner Capsule Class
                    "input-capsule",

                    // Visual Style & Layout
                    "min-h-[54px] rounded-[24px] px-4 py-3 gap-4",

                    // Dynamic Sizing Logic
                    // Zen Mode: Fixed 800px width (centered by flex container)
                    // Panorama Mode: 100% width (fills safe area)
                    windowCount <= 1 ? "w-[800px]" : "w-full",

                    // Visual Style: Linear Glass
                    // Dark mode default requested: bg-[#0f0f10cc]
                    "bg-[#0f0f10cc] backdrop-blur-[20px] backdrop-saturate-150",
                    "border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.4)]",

                    // Active Border Glow
                    isFocused && "border-blue-500/30 ring-1 ring-blue-500/30"
                )}
            >
                {/* Hidden File Input */}
                <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                />

                {/* 👈 Left Zone: Sync | Attach | Divider */}
                <div className="flex items-center gap-2 mb-0.5 shrink-0">
                    {/* Sync Toggle */}
                    <button
                        onClick={() => setSyncEnabled(!isSyncEnabled)}
                        className={cn(
                            "btn-icon w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-300",
                            isSyncEnabled
                                ? "text-[#3b82f6] bg-blue-500/10 hover:bg-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                        )}
                        title={isSyncEnabled ? "同步发送开启" : "同步发送关闭"}
                    >
                        {isSyncEnabled ? <Link2 className="w-5 h-5" /> : <Link2Off className="w-5 h-5 opacity-70" />}
                    </button>

                    {/* Attach Button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="btn-icon w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all"
                        title="上传文件"
                    >
                        <Paperclip className="w-5 h-5" />
                    </button>

                    {/* Divider */}
                    <div className="w-[1px] h-5 bg-white/10 mx-1" />
                </div>

                {/* 👉 Middle Zone: Input | Send */}
                <div className={cn(
                    "flex-1 flex flex-col justify-center transition-all duration-200 min-h-[38px] relative",
                )}>
                    {/* File Previews */}
                    {selectedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 pb-2">
                            {selectedFiles.map((file, index) => (
                                <div key={index} className={cn(
                                    "flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg border max-w-[200px]",
                                    "bg-white/5 border-white/10"
                                )}>
                                    <div className="flex-shrink-0 text-blue-500">
                                        {file.type.startsWith('image/') ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                    </div>
                                    <span className="text-xs truncate text-gray-300">{file.name}</span>
                                    <button
                                        onClick={() => handleRemoveFile(index)}
                                        className="p-0.5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-end gap-2">
                        <textarea
                            value={draftContent}
                            onChange={(e) => setDraftContent(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            placeholder="输入消息..."
                            className={cn(
                                "flex-1 bg-transparent border-none focus:ring-0 resize-none py-1.5 outline-none text-[16px] font-normal leading-relaxed",
                                "text-white placeholder-white/20",
                                "[&::-webkit-scrollbar]:hidden"
                            )}
                            style={{
                                scrollbarWidth: 'none',
                                height: 'auto',
                                minHeight: '28px',
                                maxHeight: '200px'
                            }}
                            rows={1}
                        />

                        {/* Send Button (Inside Middle Zone, next to input as standard UI usually puts it) */}
                        {(draftContent.trim() || selectedFiles.length > 0) && (
                            <button
                                onClick={handleSend}
                                className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl p-2 shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 shrink-0"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* 👉 Right Zone: New Chat */}
                <div className="flex items-center mb-0.5 shrink-0 pl-2">
                    <button
                        onClick={handleNewChat}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-white hover:bg-white/5 transition-all"
                        title="开启新对话"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="hidden sm:inline">新对话</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
