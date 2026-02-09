import { useState } from 'react';
import { X, Plus, Wand2, Edit2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ServiceAdapter } from '../types';
import { DEFAULT_ADAPTERS } from '../types';

interface SettingsProps {
    isOpen: boolean;
    onClose: () => void;
    adapters: ServiceAdapter[];
    onAddAdapter: (adapter: ServiceAdapter) => void;
    onRemoveAdapter: (id: string) => void;
    onUpdateAdapter: (id: string, adapter: ServiceAdapter) => void;
}

export function Settings({ isOpen, onClose, adapters, onAddAdapter, onRemoveAdapter, onUpdateAdapter }: SettingsProps) {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [inputSelector, setInputSelector] = useState('textarea, input[type="text"], [contenteditable="true"]');
    const [submitSelector, setSubmitSelector] = useState('button[type="submit"]');
    const [detecting, setDetecting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Get custom adapters (not default ones)
    const customAdapters = adapters.filter(a =>
        !DEFAULT_ADAPTERS.some(defaultAdapter => defaultAdapter.id === a.id)
    );

    const handleAutoDetect = async () => {
        if (!url.trim()) {
            alert('请输入网址！');
            return;
        }

        setDetecting(true);

        try {
            // Create hidden iframe to load the URL and detect selectors
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = url;

            // Track if CSP error occurred
            let cspError = false;

            // Listen for CSP/iframe errors in console
            const originalError = console.error;
            const errorListener = (...args: any[]) => {
                const errorMsg = args.join(' ');
                if (errorMsg.includes('Content Security Policy') ||
                    errorMsg.includes('frame-ancestors') ||
                    errorMsg.includes('Refused to display')) {
                    cspError = true;
                }
                originalError.apply(console, args);
            };
            console.error = errorListener;

            document.body.appendChild(iframe);

            // Wait for iframe to load (or fail due to CSP)
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    // If we timeout and CSP error detected, treat as CSP failure
                    if (cspError) {
                        reject(new Error('CSP_BLOCKED'));
                    } else {
                        reject(new Error('Timeout waiting for page to load'));
                    }
                }, 3000); // Shorter timeout to detect CSP faster

                iframe.onload = () => {
                    clearTimeout(timeout);
                    // Check if CSP blocked content
                    setTimeout(() => {
                        if (cspError) {
                            reject(new Error('CSP_BLOCKED'));
                        } else {
                            resolve();
                        }
                    }, 500);
                };

                iframe.onerror = () => {
                    clearTimeout(timeout);
                    reject(new Error(cspError ? 'CSP_BLOCKED' : 'Failed to load page'));
                };
            });

            // Restore console.error
            console.error = originalError;

            // If we get here, iframe loaded successfully
            // Request selector detection from content script
            return new Promise<void>((resolve) => {
                const handleMessage = (event: MessageEvent) => {
                    if (event.data.type === 'SELECTORS_DETECTED') {
                        window.removeEventListener('message', handleMessage);
                        document.body.removeChild(iframe);

                        const detected = event.data.payload;
                        if (detected && detected.inputSelector && detected.submitSelector) {
                            setInputSelector(detected.inputSelector);
                            setSubmitSelector(detected.submitSelector);
                            alert(`✅ 自动检测成功！\n置信度: ${detected.confidence}%`);
                        } else {
                            alert('❌ 无法自动检测选择器。\n请手动输入。');
                        }

                        setDetecting(false);
                        resolve();
                    }
                };

                window.addEventListener('message', handleMessage);

                // Send detection request
                setTimeout(() => {
                    iframe.contentWindow?.postMessage({ type: 'DETECT_SELECTORS' }, '*');
                }, 1000);

                // Failsafe timeout
                setTimeout(() => {
                    if (iframe.parentNode) {
                        window.removeEventListener('message', handleMessage);
                        document.body.removeChild(iframe);
                        alert('⏱️ 检测超时。\n请重试或手动输入选择器。');
                        setDetecting(false);
                        resolve();
                    }
                }, 20000);
            });
        } catch (error) {
            console.error('[ChatHub] Auto-detect error:', error);

            // Handle CSP-specific errors
            if ((error as Error).message === 'CSP_BLOCKED') {
                const proceed = confirm(
                    `🔒 此网站禁止iframe嵌入 (CSP限制)\n\n` +
                    `解决方案:\n` +
                    `1. 点击"确定"在新标签页手动检测\n` +
                    `2. 点击"取消"手动输入选择器\n\n` +
                    `推荐使用Chrome开发者工具查找:\n` +
                    `• 输入框: textarea 或 contenteditable\n` +
                    `• 提交按钮: button[type="submit"]`
                );

                if (proceed) {
                    // Open in new tab for manual inspection
                    alert(
                        `📖 使用说明:\n\n` +
                        `1. 新标签页即将打开目标网站\n` +
                        `2. 按 F12 打开开发者工具\n` +
                        `3. 使用元素选择器(左上角箭头)点击:\n` +
                        `   - 输入框\n` +
                        `   - 发送按钮\n` +
                        `4. 复制其CSS选择器到此页面\n\n` +
                        `提示: 右键元素 → Copy → Copy selector`
                    );
                    window.open(url, '_blank');
                }

                setDetecting(false);
            } else {
                alert(`❌ 页面加载失败:\n${(error as Error).message}\n\n可能是由于安全限制。\n请手动输入选择器。`);
                setDetecting(false);
            }
        }
    };

    const handleSave = () => {
        if (!name.trim() || !url.trim()) {
            alert('名称和网址不能为空！');
            return;
        }

        const adapter: ServiceAdapter = {
            id: editingId || name.toLowerCase().replace(/\s+/g, '-'),
            name,
            url,
            inputSelector,
            submitSelector
        };

        if (editingId) {
            // Update existing
            onUpdateAdapter(editingId, adapter);
            setEditingId(null);
        } else {
            // Add new
            onAddAdapter(adapter);
        }

        // Reset form
        resetForm();
    };

    const handleEdit = (adapter: ServiceAdapter) => {
        setEditingId(adapter.id);
        setName(adapter.name);
        setUrl(adapter.url);
        setInputSelector(adapter.inputSelector);
        setSubmitSelector(adapter.submitSelector);

        // Scroll to form
        setTimeout(() => {
            document.getElementById('service-form')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleDelete = (id: string, name: string) => {
        const confirmed = confirm(`确定要删除 "${name}" 吗？\n\n这也将关闭当前打开的该服务。`);
        if (confirmed) {
            onRemoveAdapter(id);
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        resetForm();
    };

    const resetForm = () => {
        setName('');
        setUrl('');
        setInputSelector('textarea, input[type="text"], [contenteditable="true"]');
        setSubmitSelector('button[type="submit"]');
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Settings Components - macOS Sheet Style */}
            <div className={cn(
                "fixed right-0 top-0 h-full w-[400px] shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                "bg-mac-light/95 dark:bg-[#1e1e1e]/95 backdrop-blur-xl border-l border-black/5 dark:border-white/10",
                isOpen ? "translate-x-0" : "translate-x-full"
            )}>
                {/* Header */}
                <div className="h-[52px] px-6 flex items-center justify-between border-b border-black/5 dark:border-white/5 flex-shrink-0">
                    <h2 className="text-[17px] font-semibold text-mac-text-light dark:text-mac-text-dark">
                        {editingId ? '编辑服务' : '设置'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="btn-icon rounded-full"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                    {/* Custom Services List */}
                    {customAdapters.length > 0 && !editingId && (
                        <div className="space-y-4 mb-8">
                            <h3 className="text-[13px] font-medium text-gray-500 uppercase tracking-wide px-1">
                                已添加服务 ({customAdapters.length})
                            </h3>

                            <div className="space-y-2">
                                {customAdapters.map(adapter => (
                                    <div
                                        key={adapter.id}
                                        className="bg-white/50 dark:bg-white/5 rounded-xl p-3 border border-black/5 dark:border-white/5 hover:border-blue-500/30 transition-all group"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-[15px] font-medium text-mac-text-light dark:text-mac-text-dark truncate">
                                                    {adapter.name}
                                                </h4>
                                                <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                                    {adapter.url}
                                                </p>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(adapter)}
                                                    className="btn-icon text-blue-600 dark:text-blue-400"
                                                    title="编辑"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(adapter.id, adapter.name)}
                                                    className="btn-icon text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:bg-red-500/20"
                                                    title="删除"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add/Edit Form */}
                    <div id="service-form" className="space-y-5">
                        <h3 className="text-[13px] font-medium text-gray-500 uppercase tracking-wide px-1 mb-2">
                            {editingId ? '编辑详情' : '添加新服务'}
                        </h3>

                        {/* Name Input */}
                        <div>
                            <label className="block text-[13px] font-medium text-mac-text-light dark:text-gray-300 mb-1.5">
                                服务名称
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Kimi, Perplexity"
                                className="w-full px-3 py-2 bg-white/50 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg text-[15px] text-mac-text-light dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>

                        {/* URL Input */}
                        <div>
                            <label className="block text-[13px] font-medium text-mac-text-light dark:text-gray-300 mb-1.5">
                                网址 URL
                            </label>
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://example.com"
                                className="w-full px-3 py-2 bg-white/50 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg text-[15px] text-mac-text-light dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all mb-2"
                            />

                            {/* Auto-Detect Button */}
                            <button
                                onClick={handleAutoDetect}
                                disabled={!url.trim() || detecting}
                                className="w-full px-4 py-2 bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Wand2 className={`w-4 h-4 ${detecting ? 'animate-spin' : ''}`} />
                                {detecting ? '正在分析页面结构...' : '自动检测选择器'}
                            </button>
                        </div>

                        {/* Advanced Section */}
                        <div className="pt-4 border-t border-black/5 dark:border-white/5">
                            <h4 className="text-[13px] font-medium text-gray-400 mb-3">高级配置</h4>

                            {/* Input Selector */}
                            <div className="mb-4">
                                <label className="block text-[12px] text-gray-500 mb-1.5">
                                    输入框 Selectors
                                </label>
                                <input
                                    type="text"
                                    value={inputSelector}
                                    onChange={(e) => setInputSelector(e.target.value)}
                                    className="w-full px-3 py-2 bg-white/40 dark:bg-black/20 border border-black/5 dark:border-white/10 rounded-lg text-xs font-mono text-gray-600 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Submit Selector */}
                            <div>
                                <label className="block text-[12px] text-gray-500 mb-1.5">
                                    发送按钮 Selectors
                                </label>
                                <input
                                    type="text"
                                    value={submitSelector}
                                    onChange={(e) => setSubmitSelector(e.target.value)}
                                    className="w-full px-3 py-2 bg-white/40 dark:bg-black/20 border border-black/5 dark:border-white/10 rounded-lg text-xs font-mono text-gray-600 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-8 pb-4">
                        {editingId ? (
                            <>
                                <button
                                    onClick={handleCancelEdit}
                                    className="btn-secondary px-4 min-w-[80px]"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="btn-primary px-4 min-w-[80px]"
                                >
                                    保存修改
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleSave}
                                className="btn-primary w-full py-2.5"
                            >
                                <Plus className="w-4 h-4" />
                                添加服务
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
