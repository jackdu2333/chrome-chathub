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

export function PromptLibrary({ className, isOpen, onClose }: PromptLibraryProps) {
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
            "fixed top-0 bottom-0 w-[320px] shadow-2xl transform transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] z-30 flex flex-col font-system",
            "bg-mac-light/95 dark:bg-[#1e1e1e]/95 backdrop-blur-xl border-l border-black/5 dark:border-white/10",
            "right-0",
            isOpen ? "translate-x-0" : "translate-x-full",
            className
        )}>
            {/* Header */}
            <div className="h-[52px] px-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between flex-shrink-0">
                <h2 className="text-[15px] font-semibold text-mac-text-light dark:text-mac-text-dark flex items-center gap-2">
                    <Folder className="w-4 h-4 text-blue-500" />
                    提示词库
                </h2>
                <button onClick={onClose} className="btn-icon">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Main Content Area */}
            {editingPrompt ? (
                /* Edit Form */
                <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
                    <div>
                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">标题</label>
                        <input
                            className="w-full px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/20 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                            value={editingPrompt.title || ''}
                            onChange={e => setEditingPrompt({ ...editingPrompt, title: e.target.value })}
                            placeholder="例如：代码审查"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">分类</label>
                        <input
                            className="w-full px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/20 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                            value={editingPrompt.category || ''}
                            onChange={e => setEditingPrompt({ ...editingPrompt, category: e.target.value })}
                            placeholder="例如：编程"
                        />
                    </div>
                    <div className="flex-1 flex flex-col">
                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">内容</label>
                        <textarea
                            className="flex-1 w-full p-3 rounded-lg border border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/20 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none resize-none transition-all leading-relaxed font-mono"
                            value={editingPrompt.content || ''}
                            onChange={e => setEditingPrompt({ ...editingPrompt, content: e.target.value })}
                            placeholder="输入提示词内容..."
                        />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => setEditingPrompt(null)}
                            className="btn-secondary flex-1"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!editingPrompt.title || !editingPrompt.content}
                            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            保存
                        </button>
                    </div>
                </div>
            ) : (
                /* List View */
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 space-y-3 flex-shrink-0">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="搜索..."
                                className="w-full pl-9 pr-3 py-1.5 bg-black/5 dark:bg-white/10 border-none rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-400"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => setEditingPrompt({ title: '', content: '', category: '' })}
                            className="btn-secondary w-full justify-center"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            新建提示词
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                        {Object.entries(groupedPrompts).map(([category, categoryPrompts]) => (
                            <div key={category}>
                                <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1 sticky top-0 bg-mac-light/95 dark:bg-[#1e1e1e]/95 backdrop-blur-xl z-10 py-1">{category}</h3>
                                <div className="space-y-2">
                                    {categoryPrompts.map(prompt => (
                                        <div
                                            key={prompt.id}
                                            className="group bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-[10px] p-3 hover:border-blue-400/50 dark:hover:border-blue-500/50 hover:shadow-sm transition-all cursor-pointer relative"
                                            onClick={() => handleSelect(prompt.content)}
                                        >
                                            <div className="flex justify-between items-start mb-1.5">
                                                <h4 className="font-medium text-[13px] text-gray-900 dark:text-gray-200 line-clamp-1">{prompt.title}</h4>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 -mr-1">
                                                    {!prompt.isSystem && (
                                                        <>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setEditingPrompt(prompt); }}
                                                                className="btn-icon p-1 h-6 w-6"
                                                            >
                                                                <Edit2 className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleDelete(prompt.id, e)}
                                                                className="btn-icon p-1 h-6 w-6 hover:text-red-600 dark:hover:text-red-400"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-[12px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed opacity-80">
                                                {prompt.content}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
