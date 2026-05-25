import { ChangeEvent, ClipboardEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Link2, Link2Off, Paperclip, PanelLeft, Plus, Send, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';
import { sendMessageBatch } from '../runtime/frameBridge';

interface UnifiedInputProps {
    isModelDrawerOpen: boolean;
    onToggleModelDrawer: () => void;
}

export function UnifiedInput({
    isModelDrawerOpen,
    onToggleModelDrawer,
}: UnifiedInputProps) {
    const { isSyncEnabled, setSyncEnabled, reloadAllBots, draftContent, setDraftContent, activeBots } = useStore();
    const [selectedFiles, setSelectedFiles] = useState<{ name: string; type: string; data: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    const windowCount = activeBots.length;

    const handleSend = async () => {
        if (!draftContent.trim() && selectedFiles.length === 0) return;

        await sendMessageBatch({
            instanceIds: activeBots.map(bot => bot.instanceId),
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
            void handleSend();
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

    const resizeTextarea = (element?: HTMLTextAreaElement | null) => {
        const target = element ?? textareaRef.current;
        if (!target) return;

        target.style.height = '0px';
        target.style.height = `${Math.min(target.scrollHeight, 88)}px`;
    };

    const handleDraftChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setDraftContent(e.target.value);
        resizeTextarea(e.target);
    };

    useEffect(() => {
        resizeTextarea();
    }, [draftContent]);

    return (
        <div className="input-safe-container">
            <div
                className={cn(
                    "input-capsule",
                    windowCount <= 1 ? "max-w-[1120px]" : "w-full"
                )}
            >
                <div className={cn(
                    "input-capsule-shell",
                    isFocused && "border-[#bec8d5]/25 shadow-[0_18px_42px_rgba(96,107,125,0.16)]"
                )}>
                    <input
                        type="file"
                        multiple
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileSelect}
                    />

                    <div className="flex flex-col gap-2 px-2.5 py-2.5">
                        {selectedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {selectedFiles.map((file, index) => (
                                    <div
                                        key={index}
                                        className="flex max-w-[220px] items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.045] px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                                    >
                                        <div className="flex-shrink-0 text-[#c2ccd6]">
                                            {file.type.startsWith('image/') ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                        </div>
                                        <span className="truncate text-sm text-slate-200">{file.name}</span>
                                        <button
                                            onClick={() => handleRemoveFile(index)}
                                            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <div className="flex shrink-0 items-center gap-1 rounded-[14px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.038),rgba(255,255,255,0.018))] px-1 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
                                <button
                                    onClick={onToggleModelDrawer}
                                    className={cn(
                                        "btn-icon flex h-9 items-center justify-center gap-2 px-3 text-slate-200",
                                        isModelDrawerOpen && "border-white/[0.05] bg-[rgba(183,200,191,0.16)] text-[#f1f6f3]"
                                    )}
                                    title="模型栏"
                                >
                                    <PanelLeft className="h-4 w-4" />
                                    <span className="hidden lg:inline text-[13px]">模型</span>
                                </button>

                                <button
                                    onClick={() => setSyncEnabled(!isSyncEnabled)}
                                    className={cn(
                                        "btn-icon flex h-9 items-center justify-center gap-2 px-3",
                                        isSyncEnabled
                                            ? "border-white/[0.05] bg-[rgba(183,200,191,0.16)] text-[#f1f6f3]"
                                            : "text-slate-400"
                                    )}
                                    title={isSyncEnabled ? "同步发送开启" : "同步发送关闭"}
                                >
                                    {isSyncEnabled ? <Link2 className="h-4.5 w-4.5" /> : <Link2Off className="h-4.5 w-4.5" />}
                                    <span className="hidden xl:inline text-[13px]">{isSyncEnabled ? '同步' : '草稿'}</span>
                                </button>

                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="btn-icon flex h-9 w-9 items-center justify-center text-slate-300"
                                    title="上传文件"
                                >
                                    <Paperclip className="h-4.5 w-4.5" />
                                </button>
                            </div>

                            <div
                                className={cn(
                                    "flex min-w-0 flex-1 items-center gap-3 rounded-[14px] border px-3 py-2 transition-all duration-300",
                                    "border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                                    isFocused && "border-[rgba(190,200,213,0.22)] bg-[linear-gradient(180deg,rgba(190,200,213,0.075),rgba(255,255,255,0.028))]"
                                )}
                            >
                                <textarea
                                    ref={textareaRef}
                                    value={draftContent}
                                    onChange={handleDraftChange}
                                    onKeyDown={handleKeyDown}
                                    onPaste={handlePaste}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    placeholder={isSyncEnabled ? "把消息发往所有窗口..." : "先写草稿，按 Enter 注入到当前窗口..."}
                                    className={cn(
                                        "min-w-0 flex-1 resize-none border-none bg-transparent outline-none focus:ring-0",
                                        "text-[15px] leading-6 text-white placeholder:text-slate-500",
                                        "[&::-webkit-scrollbar]:hidden"
                                    )}
                                    style={{
                                        scrollbarWidth: 'none',
                                        minHeight: '24px',
                                        maxHeight: '88px',
                                        height: '24px'
                                    }}
                                    rows={1}
                                />
                                <span className="hidden lg:inline shrink-0 rounded-full border border-white/[0.05] bg-white/[0.025] px-2.5 py-1 text-[11px] font-medium text-slate-400">
                                    {windowCount} 窗口
                                </span>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                                <button
                                    onClick={handleNewChat}
                                    className="btn-secondary h-10 rounded-full px-4 text-slate-200"
                                    title="开启新对话"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span className="hidden md:inline">新对话</span>
                                </button>

                                <button
                                    onClick={() => { void handleSend(); }}
                                    disabled={!draftContent.trim() && selectedFiles.length === 0}
                                    className={cn(
                                        "btn-primary flex h-10 min-w-[48px] items-center justify-center rounded-[14px] px-4 shrink-0",
                                        !draftContent.trim() && selectedFiles.length === 0 && "cursor-not-allowed opacity-50"
                                    )}
                                >
                                    <Send className="h-4.5 w-4.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
