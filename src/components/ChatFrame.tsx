import { useEffect, useState, useRef } from 'react';
import { RefreshCw, Maximize2, Minimize2, XCircle, GripVertical, Check } from 'lucide-react';

import { cn } from '../lib/utils';
import { useStore } from '../store';
import type { ChatBot } from '../types';
import { registerFrame, unregisterFrame } from '../runtime/frameRegistry';
import { requestFrameHello } from '../runtime/frameBridge';
import { useFrameSessionStore } from '../runtime/useFrameSessionStore';

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
    // selected 模式：发送目标勾选
    const sendTargetMode = useStore(state => state.sendTargetMode);
    const selectedTargetInstanceIds = useStore(state => state.selectedTargetInstanceIds);
    const toggleSelectedTarget = useStore(state => state.toggleSelectedTarget);
    const isSelected = selectedTargetInstanceIds.includes(bot.instanceId);
    const showSelectCheckbox = sendTargetMode === 'selected';

    const ensureSession = useFrameSessionStore(state => state.ensureSession);
    const markBooting = useFrameSessionStore(state => state.markBooting);
    const markIframeLoaded = useFrameSessionStore(state => state.markIframeLoaded);
    const updateRuntimeStatus = useFrameSessionStore(state => state.updateRuntimeStatus);
    const session = useFrameSessionStore(state => state.sessions[bot.instanceId]);

    const host = (() => {
        try {
            return new URL(bot.url).hostname.replace(/^www\./, '');
        } catch {
            return bot.url;
        }
    })();

    const initials = bot.name.substring(0, 2).toUpperCase();

    const handleReload = () => {
        markBooting(bot.instanceId);
        setReloadKey(prev => prev + 1);
    };

    useEffect(() => {
        ensureSession({
            instanceId: bot.instanceId,
            adapterId: bot.id,
            botName: bot.name,
            url: bot.url,
        });
    }, [bot.id, bot.instanceId, bot.name, bot.url, ensureSession]);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) {
            return;
        }

        registerFrame(bot.instanceId, iframe);
        requestFrameHello(bot.instanceId);

        return () => {
            unregisterFrame(bot.instanceId);
        };
    }, [bot.instanceId, reloadKey]);

    useEffect(() => {
        if (!session?.iframeLoadedAt || session.status !== 'booting') {
            return;
        }

        const timeoutMs = bot.id === 'gemini' ? 20000 : 25000;
        const timer = window.setTimeout(() => {
            const latest = useFrameSessionStore.getState().sessions[bot.instanceId];
            if (!latest || latest.status !== 'booting') {
                return;
            }

            const isGemini = bot.id === 'gemini';
            updateRuntimeStatus(bot.instanceId, {
                status: 'error',
                timestamp: Date.now(),
                reason: isGemini ? 'GEMINI_EMBED_LOGIN_REQUIRED' : 'FRAME_READY_TIMEOUT',
                detail: isGemini
                    ? '请先在普通标签页登录 Gemini。Google 登录可能阻止嵌入式窗口或第三方 Cookie。'
                    : 'iframe 已加载，但页面未在预期时间内完成就绪握手。',
            });
        }, timeoutMs);

        return () => window.clearTimeout(timer);
    }, [bot.id, bot.instanceId, session?.iframeLoadedAt, session?.status, updateRuntimeStatus]);

    const statusTone = session?.status ?? 'booting';
    const isGeminiLoginRequired = session?.lastError === 'GEMINI_EMBED_LOGIN_REQUIRED';
    const statusLabel = session?.lastError === 'GEMINI_EMBED_LOGIN_REQUIRED'
        ? '需登录'
        : statusTone === 'ready'
        ? '已就绪'
        : statusTone === 'busy'
            ? '发送中'
            : statusTone === 'error'
                ? '异常'
                : statusTone === 'unsupported'
                    ? '不支持'
                    : '准备中';
    const statusClassName = isGeminiLoginRequired
        ? 'bg-[#d6c6a9] ring-[3px] ring-[rgba(214,198,169,0.12)]'
        : statusTone === 'ready'
        ? 'bg-[#b7c8bf] ring-[3px] ring-[rgba(183,200,191,0.12)]'
        : statusTone === 'busy'
            ? 'bg-[#bec8d5] ring-[3px] ring-[rgba(190,200,213,0.12)]'
            : statusTone === 'error'
                ? 'bg-[#cfaeae] ring-[3px] ring-[rgba(207,174,174,0.12)]'
                : statusTone === 'unsupported'
                    ? 'bg-slate-500'
                    : 'bg-[#d6c6a9] ring-[3px] ring-[rgba(214,198,169,0.12)]';

    return (
        <div
            className={cn(
                "relative h-full w-full",
                className
            )}
        >
            <div
                className={cn(
                    "frame-shell transition-all duration-300",
                    isFocused
                        ? "frame-shell-focused fixed bottom-[76px] left-3 right-3 top-3 z-40"
                        : "absolute inset-0 w-full h-full",
                    isDragging && "scale-[1.01] rotate-[0.6deg] z-50 cursor-grabbing"
                )}
            >
                <div
                    className={cn(
                        "frame-header select-none"
                    )}
                    onDoubleClick={onToggleFocus}
                    title="双击标题栏放大"
                >
                    <div
                        {...(dragListeners || {})}
                        className={cn(
                            "mr-1 flex h-6.5 w-6.5 flex-shrink-0 cursor-grab items-center justify-center rounded-full border border-white/[0.05] bg-white/[0.02] text-slate-400 transition-colors active:cursor-grabbing",
                            "hover:border-white/[0.1] hover:bg-white/[0.06] hover:text-white"
                        )}
                        title="按住拖拽排序"
                        style={{ display: 'flex' }}
                    >
                        <GripVertical className="w-4 h-4" />
                    </div>

                    <div className="mr-auto flex min-w-0 items-center gap-2">
                        <div className="flex h-6.5 w-6.5 items-center justify-center rounded-[9px] border border-white/[0.07] bg-gradient-to-br from-[#d8cbc1]/22 via-[#cdc0c7]/12 to-[#bec8d5]/12 text-[10px] font-semibold text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                            {initials}
                        </div>
                        <div
                            className="window-title truncate text-[13px] font-semibold text-white/92"
                            title={`${bot.name} · ${host}`}
                        >
                            {bot.name}
                        </div>
                        <span
                            className="frame-status-pill"
                            title={session?.lastError || session?.lastDetail || statusLabel}
                        >
                            <span className={cn("h-1.5 w-1.5 rounded-full", statusClassName)} />
                            {statusLabel}
                        </span>
                    </div>

                    {/* selected 模式下的勾选框 */}
                    {showSelectCheckbox && (
                        <button
                            onClick={() => toggleSelectedTarget(bot.instanceId)}
                            className={cn(
                                "ml-1 flex h-5 w-5 items-center justify-center rounded-[6px] border transition-all",
                                isSelected
                                    ? "border-[#bec8d5]/40 bg-[#bec8d5]/20 text-white"
                                    : "border-white/[0.12] bg-transparent text-transparent hover:border-white/[0.25]"
                            )}
                            title={isSelected ? "取消选择" : "选为发送目标"}
                        >
                            <Check className="h-3 w-3" />
                        </button>
                    )}

                    <div className="flex items-center gap-0">
                        <button
                            onClick={handleReload}
                            className="btn-icon scale-[0.92]"
                            title="重新加载"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>

                        <button
                            onClick={onToggleFocus}
                            className="btn-icon scale-[0.92]"
                            title={isFocused ? "最小化" : "最大化"}
                        >
                            {isFocused ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>

                        <button
                            onClick={onRemove}
                            className="btn-icon scale-[0.92] text-slate-400 hover:bg-[#cfaeae]/[0.12] hover:text-[#f1dede]"
                            title="关闭窗口"
                        >
                            <XCircle className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="relative flex-1 min-h-0 bg-transparent">
                    <iframe
                        key={`${bot.instanceId}-${reloadKey}`}
                        ref={iframeRef}
                        src={bot.url}
                        className="absolute inset-0 h-full w-full border-none bg-transparent"
                        allow="microphone; camera; clipboard-write; fullscreen"
                        title={bot.name}
                        style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
                        onLoad={() => {
                            markIframeLoaded(bot.instanceId);
                            const latest = useFrameSessionStore.getState().sessions[bot.instanceId];
                            if (!latest || latest.status !== 'ready') {
                                markBooting(bot.instanceId);
                            }
                            requestFrameHello(bot.instanceId);
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
