import { KeyboardEvent, useState, useRef, ClipboardEvent } from 'react';
import { Send, Link2, Link2Off, Plus, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';
import { broadcastMessage } from '../lib/broadcast';

interface UnifiedInputProps {
    // onTogglePrompts removed
}

export function UnifiedInput({ }: UnifiedInputProps) {
    const { isSyncEnabled, setSyncEnabled, reloadAllBots, draftContent, setDraftContent, isDarkMode } = useStore();
    const [selectedFiles, setSelectedFiles] = useState<{ name: string; type: string; data: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    return (
        <div className={cn(
            "absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl min-h-[72px] rounded-[20px] flex items-end px-4 py-3 gap-3 z-50 transition-all duration-300",
            "bg-white/80 dark:bg-[#2c2c2e]/80 backdrop-blur-2xl backdrop-saturate-200",
            "border border-white/20 dark:border-white/[0.08] shadow-2xl shadow-black/20",
            // macOS floating panel vibe
        )}>
            {/* Hidden File Input */}
            <input
                type="file"
                multiple
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileSelect}
            />

            {/* Section 1: Utility Buttons (Left) */}
            <div className="flex items-center gap-1 mb-1.5">
                <button
                    onClick={handleNewChat}
                    className="btn-icon p-2.5"
                    title="新对话"
                >
                    <Plus className="w-5 h-5" />
                </button>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-icon p-2.5"
                    title="上传文件"
                >
                    <Paperclip className="w-5 h-5" />
                </button>
            </div>

            {/* Section 3: Input Area (Middle) */}
            <div className={cn(
                "flex-1 rounded-[12px] flex flex-col justify-center px-4 transition-all duration-200 min-h-[44px]",
                isDarkMode
                    ? "bg-black/20 focus-within:bg-black/30 border border-transparent focus-within:border-white/10"
                    : "bg-black/5 focus-within:bg-black/10 border border-transparent focus-within:border-black/5"
            )}>
                {/* File Previews */}
                {selectedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-3 pb-1">
                        {selectedFiles.map((file, index) => (
                            <div key={index} className={cn(
                                "flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg border max-w-[200px]",
                                isDarkMode ? "bg-white/10 border-white/10" : "bg-white/50 border-black/5"
                            )}>
                                <div className="flex-shrink-0 text-blue-500">
                                    {file.type.startsWith('image/') ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                </div>
                                <span className="text-xs truncate">{file.name}</span>
                                <button
                                    onClick={() => handleRemoveFile(index)}
                                    className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <X className="w-3 h-3 opacity-70" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <textarea
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder="输入消息..."
                    className={cn(
                        "w-full bg-transparent border-none focus:ring-0 resize-none py-2.5 outline-none text-[15px] font-medium placeholder:font-normal leading-relaxed",
                        isDarkMode ? "text-white placeholder-white/30" : "text-black placeholder-black/40",
                        "[&::-webkit-scrollbar]:hidden" // Hide Chrome/Safari/Edge scrollbar
                    )}
                    style={{
                        scrollbarWidth: 'none',
                        height: 'auto',
                        minHeight: '44px',
                        maxHeight: '200px'
                    }}
                    rows={1}
                />
            </div>

            {/* Send Button */}
            <div className="mb-1">
                {(draftContent.trim() || selectedFiles.length > 0) && (
                    <button
                        onClick={handleSend}
                        className="btn-primary rounded-full p-2.5 shadow-lg shadow-blue-500/30"
                    >
                        <Send className="w-4 h-4 ml-0.5" />
                    </button>
                )}
            </div>

            {/* Section 4: Sync Toggle (Right) */}
            <div className="pl-2 border-l border-black/5 dark:border-white/5 mb-1.5">
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
