import { useState, useRef, useEffect } from 'react';
import { MessageSquare, PanelLeft } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable';

import { Sidebar } from './components/Sidebar';
import { ChatFrame } from './components/ChatFrame';
import { SortableChatFrame } from './components/SortableChatFrame';
import { UnifiedInput } from './components/UnifiedInput';
import { PromptLibrary } from './components/PromptLibrary';
import { Settings } from './components/Settings';
import { useStore } from './store';
import { cn } from './lib/utils';
import type { ChatBot } from './types';
import { useBotDragAndDrop } from './hooks/useBotDragAndDrop';


function App() {
  const activeBots = useStore((state) => state.activeBots);
  const availableAdapters = useStore((state) => state.availableAdapters);
  const toggleBot = useStore((state) => state.toggleBot);
  const addCustomAdapter = useStore((state) => state.addCustomAdapter);
  const removeCustomAdapter = useStore((state) => state.removeCustomAdapter);
  const updateCustomAdapter = useStore((state) => state.updateCustomAdapter);

  const [isPromptsOpen, setIsPromptsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [focusedBotId, setFocusedBotId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const { sensors, activeDragId, handleDragStart, handleDragEnd } = useBotDragAndDrop();

  const handleToggleBot = (id: string) => {
    toggleBot(id);
  };

  // Auto-hide Sidebar Logic
  const sidebarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSidebarMouseEnter = () => {
    if (sidebarTimerRef.current) {
      clearTimeout(sidebarTimerRef.current);
      sidebarTimerRef.current = null;
    }
  };

  const handleSidebarMouseLeave = () => {
    // Only auto-hide if it's currently open
    if (!isSidebarCollapsed) {
      sidebarTimerRef.current = setTimeout(() => {
        setIsSidebarCollapsed(true);
      }, 10000); // 10 seconds
    }
  };

  // Sync sidebar state to body class for CSS variable calculations
  useEffect(() => {
    if (isSidebarCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  }, [isSidebarCollapsed]);

  // Auto-collapse sidebar when 4+ bots are active
  useEffect(() => {
    if (activeBots.length >= 4) {
      setIsSidebarCollapsed(true);
    }
  }, [activeBots.length]);

  const getDynamicGridClass = () => {
    const count = activeBots.length;
    if (count <= 1) return "chat-grid-cols-1";
    if (count === 2) return "chat-grid-cols-2";
    if (count === 3) return "chat-grid-cols-3";
    return "chat-grid-cols-4"; // 4 or more
  };

  return (
    <div
      className={cn(
        "flex h-screen w-screen overflow-hidden font-system transition-colors duration-300",
        // Global Bg: Transparent to reveal body's atmospheric gradient
        "bg-transparent text-gray-900 dark:text-gray-100"
      )}
    >
      {/* 1. Sidebar */}
      <Sidebar
        adapters={availableAdapters}
        activeBotIds={activeBots.map(b => b.id)}
        onToggleBot={handleToggleBot}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      />

      {/* 2. Main Content - Split into Chat Area + Input Bar */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* 2a. Chat Grid Container (grows to fill available space) */}
        <div className="flex-1 overflow-hidden px-0 pt-0 pb-[72px]">
          {/* Removed px-4 pt-1.5 to let grid handle padding via .chat-grid-container */}
          {activeBots.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                <span className="text-2xl">⚡️</span>
              </div>
              <p className="text-lg font-medium text-gray-500 dark:text-gray-400">暂无活跃对话</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">请从左侧栏选择一个 AI 服务开始</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div
                className={cn(
                  "chat-grid-container",
                  getDynamicGridClass()
                )}
              >
                <SortableContext
                  items={activeBots.map((b) => b.instanceId)}
                  strategy={rectSortingStrategy}
                >
                  {activeBots.map((bot) => {
                    const isFocused = focusedBotId === bot.id;
                    const isHidden = focusedBotId && !isFocused;

                    return (
                      <div
                        key={bot.instanceId}
                        className={cn(
                          "chat-grid-item min-h-0 min-w-0",
                          // If focused: just raise z-index above overlay, no size change
                          isFocused ? "relative z-40" : "",

                          // If hidden: use visibility:hidden to keep in grid flow (NOT hidden-visually which uses position:absolute)
                          isHidden ? "invisible" : ""
                        )}
                      >
                        {/* 
                            ALWAYS render SortableChatFrame to preserve component tree and iframe state.
                            We will handle "notify SortableChatFrame to disable drag" via props if needed,
                            or simply rely on key persistency.
                            disable the drag listeners INSIDE it.
                         */}
                        <SortableChatFrame
                          bot={bot}
                          isFocused={isFocused}
                          onToggleFocus={() => setFocusedBotId(isFocused ? null : bot.id)}
                          onRemove={() => handleToggleBot(bot.id)}
                        />
                      </div>
                    );
                  })}
                </SortableContext>
              </div>

              {/* Drag Overlay for smooth visual feedback */}
              <DragOverlay>
                {activeDragId ? (
                  <ChatFrame
                    bot={activeBots.find((b) => b.instanceId === activeDragId) as ChatBot}
                    isFocused={false}
                    onToggleFocus={() => { }}
                    onRemove={() => { }}
                    isDragging={true} // Add visual style for overlay
                    className="h-full opacity-90 cursor-grabbing"
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
          {/* 3. Unified Input Bar (Absolute Bottom - Inside Main Content) */}
          <UnifiedInput />
        </div>
      </div>

      {/* 4. Prompt Library Drawer */}
      <PromptLibrary
        isOpen={isPromptsOpen}
        onClose={() => setIsPromptsOpen(false)}
        isSidebarCollapsed={isSidebarCollapsed}
      />

      {/* Prompt Library Floating Button (Bottom Right) */}
      <button
        onClick={() => setIsPromptsOpen(!isPromptsOpen)}
        className={cn(
          "fixed bottom-[9px] right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl hover:scale-105 active:scale-95",
          "bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl",
          "border border-gray-200 dark:border-white/10",
          isPromptsOpen ? "text-blue-500 bg-white dark:bg-gray-700" : "text-gray-600 dark:text-gray-300"
        )}
        title="提示词库"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* 5. Settings Modal */}
      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        adapters={availableAdapters}
        onAddAdapter={addCustomAdapter}
        onRemoveAdapter={removeCustomAdapter}
        onUpdateAdapter={updateCustomAdapter}
      />

      {/* Floating Sidebar Toggle (Recovery for users who expect a button) */}
      <div
        className={cn(
          "fixed bottom-[9px] left-6 z-50 transition-all duration-300",
          isSidebarCollapsed ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
        )}
      >
        <button
          onClick={() => setIsSidebarCollapsed(false)}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-transform hover:scale-105 active:scale-95",
            "bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200 dark:border-white/10",
            "text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white"
          )}
          title="展开侧边栏"
        >
          <PanelLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Overlay for Focus Mode (Background dim) - NO backdrop-blur to prevent blurry text */}
      {focusedBotId && activeBots.length > 1 && (
        <div
          className="fixed inset-0 bg-black/40 z-30 pointer-events-none transition-opacity duration-300"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default App;
