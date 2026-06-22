import { useState } from 'react';
import { Stethoscope, X, CheckCircle2, XCircle, AlertTriangle, Loader2, Search, Wifi, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ChatBot } from '../types';
import { useFrameSessionStore } from '../runtime/useFrameSessionStore';
import { probeSelectors, requestFrameHello } from '../runtime/frameBridge';
import { FRAME_LOAD_PHASE_LABELS, FrameLoadPhase } from '../runtime/protocol';

// v1.2: phase 级别用户侧提示
const LOAD_PHASE_HINTS: Partial<Record<FrameLoadPhase, string>> = {
    'content-timeout': '脚本未连接。可能原因：站点权限不足、页面加载过慢。建议：点击重试连接，如仍失败再刷新窗口。',
    'selector-error': '没有找到输入框或发送按钮。可能是平台改版或未进入聊天页面。建议：确认已登录后点击重新检测。',
    'login-required': '当前平台可能未登录。请在该窗口完成登录后点击重试连接。',
    'permission-missing': '缺少该站点访问权限。请在设置中授权后重新加载窗口。',
    'adapter-not-found': '当前页面未匹配到可用适配器。请检查 URL 或自定义 Adapter 配置。',
};

interface AdapterDiagnosticsProps {
    bot: ChatBot;
    isOpen: boolean;
    onClose: () => void;
}

// 错误码 → 中文翻译（Phase 5 模块 G3）
const ERROR_CODE_TRANSLATIONS: Record<string, string> = {
    'SUBMISSION_NOT_VERIFIED': '消息已注入，但无法确认是否发送成功',
    'INPUT_NOT_FOUND': '没有找到输入框，可能是页面未加载完成或平台改版',
    'ELEMENT_NOT_FOUND': '没有找到目标元素，可能是 selector 失效',
    'FRAME_READY_TIMEOUT': 'iframe 已加载，但页面未在预期时间内完成就绪握手',
    'GEMINI_EMBED_LOGIN_REQUIRED': '请先在普通标签页登录 Gemini。Google 登录可能阻止嵌入式窗口或第三方 Cookie',
    'COMMAND_TIMEOUT': '命令超时，模型可能正在处理中或无响应',
    'ADAPTER_NOT_FOUND': '当前网页没有匹配的 Adapter，请在设置中添加自定义服务',
    'FRAME_NOT_AVAILABLE': 'iframe 不可用，可能已被关闭或导航到了其他页面',
    'READY_TIMEOUT': '页面就绪超时，selector 可能已失效',
    'UNKNOWN_ERROR': '未知错误',
};

function translateError(error?: string): string {
    if (!error) return '无';
    // 尝试精确匹配
    if (ERROR_CODE_TRANSLATIONS[error]) return ERROR_CODE_TRANSLATIONS[error];
    // 尝试模糊匹配（error 可能包含 step:code:message 格式）
    for (const [code, translation] of Object.entries(ERROR_CODE_TRANSLATIONS)) {
        if (error.includes(code)) return translation;
    }
    return error;
}

export function AdapterDiagnostics({ bot, isOpen, onClose }: AdapterDiagnosticsProps) {
    const [probing, setProbing] = useState(false);

    const handleProbe = async () => {
        setProbing(true);
        await probeSelectors(bot.instanceId);
        setProbing(false);
    };
    const session = useFrameSessionStore(state => state.sessions[bot.instanceId]);

    if (!isOpen) return null;

    const status = session?.status ?? 'unknown';
    const capabilities = session?.capabilities;
    const host = (() => {
        try { return new URL(bot.url).hostname.replace(/^www\./, ''); } catch { return bot.url; }
    })();

    const statusConfig = {
        booting: { icon: Loader2, label: '准备中', tone: 'text-amber-400', spin: true },
        ready: { icon: CheckCircle2, label: '已就绪', tone: 'text-emerald-400', spin: false },
        busy: { icon: Loader2, label: '发送中', tone: 'text-blue-400', spin: true },
        error: { icon: XCircle, label: '异常', tone: 'text-red-400', spin: false },
        unsupported: { icon: AlertTriangle, label: '不支持', tone: 'text-slate-500', spin: false },
        unknown: { icon: AlertTriangle, label: '未知', tone: 'text-slate-500', spin: false },
    }[status] ?? { icon: AlertTriangle, label: status, tone: 'text-slate-500', spin: false };

    const StatusIcon = statusConfig.icon;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="relative w-[340px] max-w-[90%] rounded-2xl border border-white/[0.08] bg-[#1a1a1e]/95 p-5 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 text-[#c2ccd6]" />
                        <h3 className="text-[15px] font-semibold text-white">诊断面板</h3>
                    </div>
                    <button onClick={onClose} className="btn-icon">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* 基本信息 */}
                <div className="space-y-2.5">
                    <DiagRow label="模型" value={bot.name} />
                    <DiagRow label="域名" value={host} />
                    <DiagRow label="当前 URL" value={session?.url ?? bot.url} mono />

                    {/* 状态 */}
                    <div className="flex items-center justify-between border-t border-white/[0.06] pt-2.5">
                        <span className="text-[12px] text-slate-500">状态</span>
                        <div className={cn("flex items-center gap-1.5 text-[13px] font-medium", statusConfig.tone)}>
                            <StatusIcon className={cn("h-3.5 w-3.5", statusConfig.spin && "animate-spin")} />
                            {statusConfig.label}
                        </div>
                    </div>

                    {/* 加载阶段 */}
                    <div className="border-t border-white/[0.06] pt-2.5">
                        <span className="text-[12px] text-slate-500">加载阶段</span>
                        <div className="mt-1.5 text-[13px] text-slate-300">
                            {session?.loadPhase ? FRAME_LOAD_PHASE_LABELS[session.loadPhase] : '未知'}
                        </div>
                    </div>

                    {/* 健康检查 */}
                    {session?.health && (
                        <div className="border-t border-white/[0.06] pt-2.5">
                            <span className="text-[12px] text-slate-500">健康检查</span>
                            <div className="mt-1.5 space-y-1">
                                <HealthRow label="iframe 加载" ok={session.health.iframeLoaded} />
                                <HealthRow label="脚本连接" ok={session.health.contentConnected} />
                                <HealthRow label="平台识别" ok={session.health.adapterMatched} />
                                {session.health.readySelectorFound !== undefined && (
                                    <HealthRow label="Ready 选择器" ok={session.health.readySelectorFound} />
                                )}
                                {session.health.inputSelectorFound !== undefined && (
                                    <HealthRow label="输入框选择器" ok={session.health.inputSelectorFound} />
                                )}
                                {session.health.submitSelectorFound !== undefined && (
                                    <HealthRow label="发送按钮选择器" ok={session.health.submitSelectorFound} />
                                )}
                                {session.health.loginRequired !== undefined && (
                                    <HealthRow label="登录状态" ok={!session.health.loginRequired} />
                                )}
                                {session.health.permissionMissing !== undefined && (
                                    <HealthRow label="站点权限" ok={!session.health.permissionMissing} />
                                )}
                                {session.health.lastCheckedAt && (
                                    <div className="flex items-center justify-between pt-1">
                                        <span className="text-[10px] text-slate-600">最近检查</span>
                                        <span className="text-[10px] text-slate-600">
                                            {new Date(session.health.lastCheckedAt).toLocaleTimeString('zh-CN')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* v1.2: 用户侧提示 */}
                    {session?.loadPhase && LOAD_PHASE_HINTS[session.loadPhase] && (
                        <div className="border-t border-white/[0.06] pt-2.5">
                            <span className="text-[12px] text-slate-500">提示</span>
                            <div className="mt-1.5 rounded-lg border border-amber-500/15 bg-amber-950/20 px-3 py-2">
                                <p className="text-[12px] leading-5 text-amber-200/80">
                                    {LOAD_PHASE_HINTS[session.loadPhase]}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* 能力检测 */}
                    <div className="border-t border-white/[0.06] pt-2.5">
                        <span className="text-[12px] text-slate-500">能力检测</span>
                        <div className="mt-1.5 grid grid-cols-3 gap-2">
                            <CapBadge label="文本" ok={capabilities?.text} />
                            <CapBadge label="提交" ok={capabilities?.submit} />
                            <CapBadge label="文件" ok={capabilities?.files} />
                        </div>
                    </div>

                    {/* 最近错误 */}
                    {session?.lastError && (
                        <div className="border-t border-white/[0.06] pt-2.5">
                            <span className="text-[12px] text-slate-500">最近错误</span>
                            <div className="mt-1.5 rounded-lg border border-red-500/15 bg-red-950/30 px-3 py-2">
                                <div className="text-[12px] font-mono text-red-400/80">{session.lastError}</div>
                                <div className="mt-1 text-[12px] text-red-200/70">
                                    {translateError(session.lastError)}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 最近详情 / trace */}
                    {session?.lastDetail && (
                        <div className="border-t border-white/[0.06] pt-2.5">
                            <span className="text-[12px] text-slate-500">执行轨迹</span>
                            <div className="mt-1.5 max-h-[80px] overflow-y-auto rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2">
                                <pre className="whitespace-pre-wrap break-all text-[11px] font-mono text-slate-400">
                                    {session.lastDetail}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* Selector 信息 */}
                    <div className="border-t border-white/[0.06] pt-2.5">
                        <span className="text-[12px] text-slate-500">Selector 配置</span>
                        <div className="mt-1.5 space-y-1">
                            <SelectorRow label="输入框" value={typeof bot.inputSelector === 'string' ? bot.inputSelector : JSON.stringify(bot.inputSelector).slice(0, 80)} />
                            <SelectorRow label="发送按钮" value={typeof bot.submitSelector === 'string' ? bot.submitSelector : JSON.stringify(bot.submitSelector).slice(0, 80)} />
                            <SelectorRow label="就绪检测" value={bot.readySelector ? (typeof bot.readySelector === 'string' ? bot.readySelector : JSON.stringify(bot.readySelector).slice(0, 80)) : '未设置'} />
                        </div>
                    </div>

                    {/* 恢复操作 */}
                    <div className="border-t border-white/[0.06] pt-2.5">
                        <div className="flex gap-2">
                            {(session?.loadPhase === 'content-timeout' || session?.loadPhase === 'failed') && (
                                <button
                                    onClick={() => {
                                        useFrameSessionStore.getState().markLoadPhase(bot.instanceId, 'content-waiting');
                                        requestFrameHello(bot.instanceId);
                                    }}
                                    className={cn(
                                        "flex-1 rounded-lg border py-2 text-[12px] font-medium transition-all",
                                        "border-amber-500/20 bg-amber-950/20 text-amber-400/80 hover:bg-amber-950/40"
                                    )}
                                >
                                    <span className="flex items-center justify-center gap-1.5">
                                        <Wifi className="h-3 w-3" /> 重试连接
                                    </span>
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    useFrameSessionStore.getState().markBooting(bot.instanceId);
                                    // Trigger reload via callback not possible here — just reset phase
                                    useFrameSessionStore.getState().markLoadPhase(bot.instanceId, 'iframe-loading');
                                }}
                                className={cn(
                                    "flex-1 rounded-lg border py-2 text-[12px] font-medium transition-all",
                                    "border-slate-600/40 bg-slate-900/30 text-slate-400/80 hover:bg-slate-900/50"
                                )}
                                title="提示：完全刷新需在窗口标题栏点击刷新按钮"
                            >
                                <span className="flex items-center justify-center gap-1.5">
                                    <RefreshCw className="h-3 w-3" /> 重置状态
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* 探测按钮 */}
                    <div className="border-t border-white/[0.06] pt-2.5">
                        <button
                            onClick={handleProbe}
                            disabled={probing}
                            className={cn(
                                "w-full rounded-lg border py-2 text-[12px] font-medium transition-all",
                                probing
                                    ? "border-slate-700 text-slate-600 cursor-wait"
                                    : "border-blue-500/20 bg-blue-950/30 text-blue-400/80 hover:bg-blue-950/50"
                            )}
                        >
                            {probing ? (
                                <span className="flex items-center justify-center gap-1.5">
                                    <Loader2 className="h-3 w-3 animate-spin" /> 检测中...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-1.5">
                                    <Search className="h-3 w-3" /> 检测 Selector
                                </span>
                            )}
                        </button>
                    </div>

                    {/* 握手时间 */}
                    {session?.lastHandshakeAt && (
                        <div className="border-t border-white/[0.06] pt-2.5">
                            <DiagRow
                                label="最近握手"
                                value={new Date(session.lastHandshakeAt).toLocaleTimeString('zh-CN')}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function DiagRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-[12px] text-slate-500">{label}</span>
            <span className={cn("min-w-0 flex-1 truncate text-right text-[12px] text-slate-300", mono && "font-mono")}>
                {value}
            </span>
        </div>
    );
}

function CapBadge({ label, ok }: { label: string; ok?: boolean }) {
    return (
        <div className={cn(
            "flex items-center justify-center gap-1 rounded-lg border py-1.5 text-[11px] font-medium",
            ok
                ? "border-emerald-500/15 bg-emerald-950/30 text-emerald-400/80"
                : "border-slate-700/50 bg-slate-900/30 text-slate-600"
        )}>
            {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {label}
        </div>
    );
}

function SelectorRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start gap-2">
            <span className="shrink-0 text-[10px] text-slate-600">{label}</span>
            <code className="min-w-0 flex-1 truncate text-[10px] text-slate-500">{value}</code>
        </div>
    );
}


function HealthRow({ label, ok }: { label: string; ok?: boolean }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">{label}</span>
            {ok ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            ) : (
                <XCircle className="h-3 w-3 text-slate-600" />
            )}
        </div>
    );
}
