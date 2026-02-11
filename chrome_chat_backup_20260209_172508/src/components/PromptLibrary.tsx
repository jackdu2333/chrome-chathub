import { useState } from 'react';
import { Search, Plus, Edit2, Trash2, X, Folder } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';
import { Prompt } from '../types';

interface PromptLibraryProps {
    className?: string;
    isOpen: boolean;
    onClose: () => void;
    isSidebarCollapsed?: boolean;
}

export function PromptLibrary({ className, isOpen, onClose, isSidebarCollapsed = false }: PromptLibraryProps) {
    const { prompts, addPrompt, updatePrompt, deletePrompt, setDraftContent } = useStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [editingPrompt, setEditingPrompt] = useState<Partial<Prompt> | null>(null);

    // Filter logic
    const filteredPrompts = prompts.filter(p =>
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Group by Category
    const groupedPrompts = filteredPrompts.reduce((acc, prompt) => {
        const category = prompt.category || '未分类';
        if (!acc[category]) acc[category] = [];
        acc[category].push(prompt);
        return acc;
    }, {} as Record<string, Prompt[]>);

    const handleSelect = (content: string) => {
        setDraftContent(content);
        onClose();
    };

    const handleSave = () => {
        if (!editingPrompt?.title || !editingPrompt?.content) return;

        if (editingPrompt.id) {
            updatePrompt(editingPrompt.id, editingPrompt);
        } else {
            addPrompt({
                id: crypto.randomUUID(),
                title: editingPrompt.title,
                content: editingPrompt.content,
                category: editingPrompt.category || '通用',
                lastUsed: Date.now()
            } as Prompt);
        }
        setEditingPrompt(null);
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('确定要删除此提示词吗？')) {
            deletePrompt(id);
        }
    };

    return (
        <div className={cn(
            "fixed top-0 bottom-0 w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shadow-xl transform transition-all duration-300 z-30 flex flex-col font-sans",
            isSidebarCollapsed ? "left-0" : "left-64",
            isOpen ? "translate-x-0" : "-translate-x-full",
            className
        )}>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm">
                <h2 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <Folder className="w-5 h-5 text-blue-500" />
                    提示词库
                </h2>
                <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Main Content Area */}
            {editingPrompt ? (
                /* Edit Form */
                <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">标题</label>
                        <input
                            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            value={editingPrompt.title || ''}
                            onChange={e => setEditingPrompt({ ...editingPrompt, title: e.target.value })}
                            placeholder="例如：代码审查"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">分类</label>
                        <input
                            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            value={editingPrompt.category || ''}
                            onChange={e => setEditingPrompt({ ...editingPrompt, category: e.target.value })}
                            placeholder="例如：编程"
                        />
                    </div>
                    <div className="flex-1 flex flex-col">
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">内容</label>
                        <textarea
                            className="flex-1 w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all leading-relaxed"
                            value={editingPrompt.content || ''}
                            onChange={e => setEditingPrompt({ ...editingPrompt, content: e.target.value })}
                            placeholder="输入提示词内容..."
                        />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => setEditingPrompt(null)}
                            className="flex-1 py-2 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!editingPrompt.title || !editingPrompt.content}
                            className="flex-1 py-2 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                        >
                            保存
                        </button>
                    </div>
                </div>
            ) : (
                /* List View */
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 space-y-3 bg-white dark:bg-gray-900 z-10">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="搜索提示词..."
                                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => setEditingPrompt({ title: '', content: '', category: '' })}
                            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl text-sm font-medium transition-colors border border-blue-200 dark:border-blue-800/50"
                        >
                            <Plus className="w-4 h-4" />
                            新建提示词
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
                        {Object.entries(groupedPrompts).map(([category, categoryPrompts]) => (
                            <div key={category}>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">{category}</h3>
                                <div className="space-y-3">
                                    {categoryPrompts.map(prompt => (
                                        <div
                                            key={prompt.id}
                                            className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer relative"
                                            onClick={() => handleSelect(prompt.content)}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm line-clamp-1">{prompt.title}</h4>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 -mr-1">
                                                    {!prompt.isSystem && (
                                                        <>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setEditingPrompt(prompt); }}
                                                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-blue-500 transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleDelete(prompt.id, e)}
                                                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-1 font-mono bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-md border border-gray-100 dark:border-gray-800/50">
                                                {prompt.content}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {filteredPrompts.length === 0 && (
                            <div className="text-center py-10 text-gray-400 dark:text-gray-600">
                                <p>未找到提示词。</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
