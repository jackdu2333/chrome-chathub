import { ChangeEvent, ClipboardEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Link2, Link2Off, LoaderCircle, Paperclip, PanelLeft, Plus, RotateCcw, Send, Target, X, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';
import { sendMessageBatch } from '../runtime/frameBridge';
import type { SendResultItem, SendTargetMode } from '../store/types';
import type { UploadPayload } from '../runtime/protocol';
import { useFrameSessionStore } from '../runtime/useFrameSessionStore';
import {
    MAX_FILE_COUNT,
    MAX_FILE_SIZE_BYTES,
    MAX_TOTAL_FILE_SIZE_BYTES,
    validateUploadSelection,
    type UploadLimitViolation,
} from '../lib/uploadLimits';

interface UnifiedInputProps {
    isModelDrawerOpen: boolean;
    onToggleModelDrawer: () => void;
    focusedInstanceId: string | null;
    setFocusedInstanceId: (id: string | null) => void;
}

// 发送模式标签
const SEND_MODE_LABELS: Record<SendTargetMode, { short: string; icon: typeof Target }> = {
    all: { short: '全部', icon: Target },
    focused: { short: '当前', icon: Target },
    selected: { short: '自选', icon: Target },
};

interface SelectedFile extends UploadPayload {
    id: string;
    size: number;
}

interface BatchPayload {
    instanceIds: string[];
    text: string;
    autoSubmit: boolean;
    selectedFiles: SelectedFile[];
}

function formatMegabytes(bytes: number) {
    return Math.round(bytes / 1024 / 1024);
}

function getUploadViolationMessage(violation: UploadLimitViolation) {
    switch (violation.code) {
        case 'TOO_MANY_FILES':
            return `最多选择 ${MAX_FILE_COUNT} 个文件。`;
        case 'FILE_TOO_LARGE':
            return `${violation.fileName} 超过单文件 ${formatMegabytes(MAX_FILE_SIZE_BYTES)} MB 限制。`;
        case 'TOTAL_TOO_LARGE':
            return `附件总大小不能超过 ${formatMegabytes(MAX_TOTAL_FILE_SIZE_BYTES)} MB。`;
    }
}

export function UnifiedInput({
    isModelDrawerOpen,
    onToggleModelDrawer,
    focusedInstanceId,
}: UnifiedInputProps) {
    const {
        isSyncEnabled, setSyncEnabled, reloadAllBots,
        draftContent, setDraftContent, activeBots,
        isInputCollapsed, setInputCollapsed,
        // 发送目标
        sendTargetMode, setSendTargetMode,
        selectedTargetInstanceIds,
        // 发送结果
        setLastSendSummary,
        // 输入框显示模式
        inputDisplayMode,
    } = useStore();

    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
    const [isSending, setIsSending] = useState(false);
    const [retryBatch, setRetryBatch] = useState<BatchPayload | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const sendInFlightRef = useRef(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    // toast 反馈
    const [toast, setToast] = useState<{ type: 'success' | 'partial' | 'error'; message: string; detail?: string } | null>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // 仅 auto-hide 模式才走折叠逻辑
    useEffect(() => {
        if (inputDisplayMode === 'always') {
            setInputCollapsed(false);
            return;
        }

        const isDraftEmpty = !draftContent.trim() && selectedFiles.length === 0;
        const needsCollapse = !isHovered && !isFocused && isDraftEmpty && !isModelDrawerOpen;

        if (needsCollapse) {
            const timer = setTimeout(() => {
                setInputCollapsed(true);
            }, 800);
            return () => clearTimeout(timer);
        } else {
            setInputCollapsed(false);
        }
    }, [isHovered, isFocused, draftContent, selectedFiles.length, isModelDrawerOpen, setInputCollapsed, inputDisplayMode]);

    // 计算发送目标
    const resolveTargetInstanceIds = (mode: SendTargetMode = sendTargetMode): string[] => {
        if (mode === 'all') {
            return activeBots.map(bot => bot.instanceId);
        }
        if (mode === 'focused') {
            return focusedInstanceId ? [focusedInstanceId] : [];
        }
        // selected 模式
        return selectedTargetInstanceIds;
    };

    // 发送目标描述文本
    const targetDescription = (): string => {
        const count = resolveTargetInstanceIds().length;
        if (count === 0) return '未选择目标';

        if (sendTargetMode === 'focused' && focusedInstanceId) {
            const bot = activeBots.find(b => b.instanceId === focusedInstanceId);
            return bot ? `当前窗口 · ${bot.name}` : '当前窗口';
        }
        if (sendTargetMode === 'selected') return `自选 ${count} 个`;
        return `全部 ${count} 个`;
    };

    // 显示 toast
    const showToast = (type: 'success' | 'partial' | 'error', message: string, detail?: string) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ type, message, detail });
        toastTimerRef.current = setTimeout(() => setToast(null), 4000);
    };

    const clearRetryState = () => {
        setRetryBatch(null);
    };

    const executeBatch = async (payload: BatchPayload) => {
        if (sendInFlightRef.current) return;
        if (payload.instanceIds.length === 0) {
            showToast('error', '请先选择发送目标，输入内容已保留');
            return;
        }

        if (payload.selectedFiles.length > 0) {
            const sessions = useFrameSessionStore.getState().sessions;
            const unsupportedInstanceIds = payload.instanceIds.filter((instanceId) => {
                const session = sessions[instanceId];
                return session && session.status !== 'booting' && !session.capabilities.files;
            });
            if (unsupportedInstanceIds.length > 0) {
                const unsupportedNames = unsupportedInstanceIds
                    .map((instanceId) => activeBots.find((bot) => bot.instanceId === instanceId)?.name)
                    .filter((botName): botName is string => Boolean(botName));
                showToast('error', `${unsupportedNames.join('、') || `${unsupportedInstanceIds.length} 个窗口`}不支持附件，本次未发送`);
                return;
            }
        }

        sendInFlightRef.current = true;
        setIsSending(true);
        setRetryBatch(null);

        try {
            const results = await sendMessageBatch({
                instanceIds: payload.instanceIds,
                text: payload.text,
                autoSubmit: payload.autoSubmit,
                files: payload.selectedFiles.map(({ name, type, data }) => ({ name, type, data })),
            });

            const botMap = new Map(activeBots.map(b => [b.instanceId, b.name]));
            const items: SendResultItem[] = results.map(r => ({
                instanceId: r.instanceId,
                botName: botMap.get(r.instanceId) ?? 'Unknown',
                success: r.success,
                error: r.error,
                timestamp: Date.now(),
            }));

            const successCount = items.filter(i => i.success).length;
            const failedItems = items.filter(i => !i.success);
            setLastSendSummary({
                total: items.length,
                successCount,
                failedCount: failedItems.length,
                items,
            });

            if (failedItems.length > 0) {
                setRetryBatch({
                    ...payload,
                    instanceIds: failedItems.map((item) => item.instanceId),
                });
                if (successCount > 0) {
                    showToast('partial', `已处理 ${successCount} 个，失败 ${failedItems.length} 个，输入和附件已保留`);
                } else {
                    showToast('error', '全部窗口处理失败，输入和附件已保留', failedItems[0]?.error);
                }
                return;
            }

            if (draftContent === payload.text) {
                setDraftContent('');
            }
            setSelectedFiles((currentFiles) => currentFiles === payload.selectedFiles ? [] : currentFiles);
            showToast('success', payload.autoSubmit
                ? `已发送到 ${successCount} 个模型`
                : `已填充 ${successCount} 个模型，未自动发送`);
        } catch (error) {
            setRetryBatch(payload);
            showToast('error', '发送失败，输入和附件已保留', error instanceof Error ? error.message : 'UNKNOWN_ERROR');
        } finally {
            sendInFlightRef.current = false;
            setIsSending(false);
        }
    };

    const handleSend = (modeOverride?: SendTargetMode) => {
        if (!draftContent.trim() && selectedFiles.length === 0) return;
        const effectiveMode = modeOverride ?? sendTargetMode;
        if (modeOverride) setSendTargetMode(modeOverride);
        void executeBatch({
            instanceIds: resolveTargetInstanceIds(effectiveMode),
            text: draftContent,
            autoSubmit: isSyncEnabled,
            selectedFiles,
        });
    };

    const handleRetry = () => {
        if (retryBatch) {
            void executeBatch(retryBatch);
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.nativeEvent.isComposing) return;

        // Cmd/Ctrl+Shift+Enter: 只发送到当前窗口
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
            e.preventDefault();
            void handleSend('focused');
            return;
        }
        // Cmd/Ctrl+Enter: 发送到全部模型
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void handleSend('all');
            return;
        }
        // Enter: 按当前模式发送
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
        }
    };

    const handleNewChat = () => {
        clearRetryState();
        reloadAllBots();
    };

    const processFiles = async (files: File[]) => {
        const violation = validateUploadSelection(selectedFiles, files);
        if (violation) {
            showToast('error', getUploadViolationMessage(violation));
            return;
        }

        try {
            const processedFiles = await Promise.all(files.map(file => {
            return new Promise<SelectedFile>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (typeof reader.result !== 'string') {
                        reject(new Error('FILE_READ_FAILED'));
                        return;
                    }
                    resolve({
                        id: crypto.randomUUID(),
                        name: file.name,
                        type: file.type,
                        data: reader.result,
                        size: file.size,
                    });
                };
                reader.onerror = () => reject(reader.error ?? new Error('FILE_READ_FAILED'));
                reader.readAsDataURL(file);
            });
            }));
            setSelectedFiles(prev => [...prev, ...processedFiles]);
            clearRetryState();
        } catch (error) {
            showToast('error', '读取附件失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR');
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            await processFiles(Array.from(e.target.files));
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
            e.preventDefault();
            await processFiles(Array.from(e.clipboardData.files));
        }
    };

    const handleRemoveFile = (id: string) => {
        setSelectedFiles(prev => prev.filter(file => file.id !== id));
        clearRetryState();
    };

    const resizeTextarea = (element?: HTMLTextAreaElement | null) => {
        const target = element ?? textareaRef.current;
        if (!target) return;

        target.style.height = '0px';
        target.style.height = `${Math.min(target.scrollHeight, 88)}px`;
    };

    const handleDraftChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setDraftContent(e.target.value);
        clearRetryState();
        resizeTextarea(e.target);
    };

    useEffect(() => {
        resizeTextarea();
    }, [draftContent]);

    const windowCount = activeBots.length;
    const hasNoTargets = resolveTargetInstanceIds().length === 0;
    const hasPayload = draftContent.trim().length > 0 || selectedFiles.length > 0;
    const sendDisabled = !hasPayload || hasNoTargets || isSending;

    // 循环切换发送模式
    const cycleSendMode = () => {
        const modes: SendTargetMode[] = ['all', 'focused', 'selected'];
        const currentIndex = modes.indexOf(sendTargetMode);
        setSendTargetMode(modes[(currentIndex + 1) % modes.length]);
    };

    return (
        <>
            {/* Invisible Hover Sensor Zone */}
            {isInputCollapsed && (
                <div
                    className="fixed bottom-0 left-0 right-0 h-4 z-[99] cursor-pointer pointer-events-auto"
                    onMouseEnter={() => setIsHovered(true)}
                />
            )}

            {/* Toast 反馈 */}
            {toast && (
                <div className="fixed bottom-[96px] left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className={cn(
                        "flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm font-medium shadow-2xl backdrop-blur-xl",
                        toast.type === 'success' && "border-emerald-500/20 bg-emerald-950/80 text-emerald-200",
                        toast.type === 'partial' && "border-amber-500/20 bg-amber-950/80 text-amber-200",
                        toast.type === 'error' && "border-red-500/20 bg-red-950/80 text-red-200",
                    )}>
                        {toast.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                        {toast.type === 'partial' && <AlertTriangle className="h-4 w-4 shrink-0" />}
                        {toast.type === 'error' && <AlertCircle className="h-4 w-4 shrink-0" />}
                        <span>{toast.message}</span>
                        {toast.detail && (
                            <span className="max-w-[300px] truncate text-xs opacity-60" title={toast.detail}>
                                {toast.detail}
                            </span>
                        )}
                    </div>
                </div>
            )}

            <div
                className={cn(
                    "input-safe-container transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    isInputCollapsed ? "translate-y-[calc(100%+24px)] opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
                )}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
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
                        disabled={isSending}
                        onChange={handleFileSelect}
                    />

                    <div className="flex flex-col gap-2 px-2.5 py-2.5">
                        {selectedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {selectedFiles.map((file) => (
                                    <div
                                        key={file.id}
                                        className="flex max-w-[220px] items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.045] px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                                    >
                                        <div className="flex-shrink-0 text-[#c2ccd6]">
                                            {file.type.startsWith('image/') ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                        </div>
                                        <span className="truncate text-sm text-slate-200">{file.name}</span>
                                        <button
                                            onClick={() => handleRemoveFile(file.id)}
                                            disabled={isSending}
                                            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
                                            aria-label={`移除附件 ${file.name}`}
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {retryBatch && (
                            <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-950/30 px-3 py-2 text-[12px] text-amber-200">
                                <span>{retryBatch.instanceIds.length} 个窗口处理失败，输入和附件已保留。</span>
                                <button
                                    type="button"
                                    onClick={handleRetry}
                                    disabled={isSending}
                                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-white hover:bg-white/10 disabled:opacity-50"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    仅重试失败窗口
                                </button>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <div className="flex shrink-0 items-center gap-1 rounded-[14px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.038),rgba(255,255,255,0.018))] px-1 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
                                <button
                                    onClick={onToggleModelDrawer}
                                    disabled={isSending}
                                    data-model-trigger
                                    className={cn(
                                        "btn-icon flex h-9 items-center justify-center gap-2 px-3 text-slate-200",
                                        isModelDrawerOpen && "border-white/[0.05] bg-[rgba(183,200,191,0.16)] text-[#f1f6f3]"
                                    )}
                                    title="模型栏"
                                >
                                    <PanelLeft className="h-4 w-4" />
                                    <span className="hidden lg:inline text-[13px]">模型</span>
                                </button>

                                {/* 发送目标模式切换 */}
                                <button
                                    onClick={cycleSendMode}
                                    className={cn(
                                        "btn-icon flex h-9 items-center justify-center gap-1.5 px-3 transition-all",
                                        hasNoTargets
                                            ? "text-amber-400/80"
                                            : "text-[#f1f6f3] border-white/[0.05] bg-[rgba(183,200,191,0.16)]"
                                    )}
                                    title={`发送目标：${targetDescription()}（点击切换）`}
                                >
                                    <Target className="h-4 w-4" />
                                    <span className="hidden lg:inline text-[13px]">
                                        {SEND_MODE_LABELS[sendTargetMode].short}
                                    </span>
                                </button>

                                <button
                                    onClick={() => {
                                        setSyncEnabled(!isSyncEnabled);
                                        clearRetryState();
                                    }}
                                    disabled={isSending}
                                    className={cn(
                                        "btn-icon flex h-9 items-center justify-center gap-2 px-3",
                                        isSyncEnabled
                                            ? "border-white/[0.05] bg-[rgba(183,200,191,0.16)] text-[#f1f6f3]"
                                            : "text-slate-400"
                                    )}
                                    title={isSyncEnabled ? "同步发送（自动提交）" : "仅填充目标窗口，不自动发送"}
                                    aria-pressed={isSyncEnabled}
                                >
                                    {isSyncEnabled ? <Link2 className="h-4.5 w-4.5" /> : <Link2Off className="h-4.5 w-4.5" />}
                                    <span className="hidden xl:inline text-[13px]">{isSyncEnabled ? '同步' : '仅填充'}</span>
                                </button>

                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isSending}
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
                                    disabled={isSending}
                                    placeholder={hasNoTargets ? "请先选择发送目标..." : isSyncEnabled ? "把消息发往目标窗口..." : "填充目标窗口，但不自动发送..."}
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
                                {/* 发送目标描述 */}
                                <span className={cn(
                                    "hidden lg:inline shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                                    hasNoTargets
                                        ? "border-amber-500/20 bg-amber-950/30 text-amber-400/80"
                                        : "border-white/[0.05] bg-white/[0.025] text-slate-400"
                                )}>
                                    {targetDescription()}
                                </span>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                                <button
                                    onClick={handleNewChat}
                                    disabled={isSending}
                                    className="btn-secondary h-10 rounded-full px-4 text-slate-200"
                                    title="开启新对话"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span className="hidden md:inline">新对话</span>
                                </button>

                                <button
                                    onClick={() => { void handleSend(); }}
                                    disabled={sendDisabled}
                                    aria-label={isSending ? "正在处理" : isSyncEnabled ? "发送到目标窗口" : "填充目标窗口"}
                                    aria-busy={isSending}
                                    className={cn(
                                        "btn-primary flex h-10 min-w-[48px] items-center justify-center rounded-[14px] px-4 shrink-0",
                                        sendDisabled && "cursor-not-allowed opacity-50"
                                    )}
                                >
                                    {isSending
                                        ? <LoaderCircle className="h-4.5 w-4.5 animate-spin" />
                                        : <Send className="h-4.5 w-4.5" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
}
