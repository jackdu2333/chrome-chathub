import { useState } from 'react';
import { X, Plus, Wand2, Edit2, Trash2 } from 'lucide-react';
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
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                onClick={onClose}
            />

            {/* Settings Panel */}
            <div className="fixed right-0 top-0 h-full w-96 bg-gray-900 border-l border-gray-800 shadow-2xl z-50 flex flex-col">
                {/* Header */}
                <div className="h-16 px-6 flex items-center justify-between border-b border-gray-800">
                    <h2 className="text-lg font-bold text-white">
                        {editingId ? '编辑服务' : '自定义服务'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Custom Services List */}
                    {customAdapters.length > 0 && !editingId && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-gray-400">
                                    已添加服务 ({customAdapters.length})
                                </h3>
                            </div>

                            {customAdapters.map(adapter => (
                                <div
                                    key={adapter.id}
                                    className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-white font-medium truncate">
                                                {adapter.name}
                                            </h4>
                                            <p className="text-xs text-gray-400 truncate mt-1">
                                                {adapter.url}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleEdit(adapter)}
                                                className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                                                title="编辑"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(adapter.id, adapter.name)}
                                                className="p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
                                                title="删除"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div className="border-t border-gray-700 pt-4 mt-4" />
                        </div>
                    )}

                    {/* Add/Edit Form */}
                    <div id="service-form" className="space-y-6">
                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                服务名称 *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Kimi, Perplexity"
                                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        {/* URL */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                网址 URL *
                            </label>
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://example.com"
                                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />

                            {/* Auto-Detect Button */}
                            <button
                                onClick={handleAutoDetect}
                                disabled={!url.trim() || detecting}
                                className="mt-3 w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                                <Wand2 className={`w-4 h-4 ${detecting ? 'animate-spin' : ''}`} />
                                {detecting ? '检测中...' : '🪄 自动检测选择器'}
                            </button>
                            <p className="mt-2 text-xs text-gray-500">
                                自动查找输入框和发送按钮选择器
                            </p>
                        </div>

                        {/* Advanced Section */}
                        <div className="pt-4 border-t border-gray-800">
                            <h3 className="text-sm font-semibold text-gray-400 mb-4">高级选项 (可选)</h3>

                            {/* Input Selector */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    输入框 CSS 选择器
                                </label>
                                <input
                                    type="text"
                                    value={inputSelector}
                                    onChange={(e) => setInputSelector(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    输入框的 CSS 选择器
                                </p>
                            </div>

                            {/* Submit Selector */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    发送按钮 CSS 选择器
                                </label>
                                <input
                                    type="text"
                                    value={submitSelector}
                                    onChange={(e) => setSubmitSelector(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    发送按钮的 CSS 选择器
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-6">
                        {editingId ? (
                            <>
                                <button
                                    onClick={handleCancelEdit}
                                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    保存修改
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
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
