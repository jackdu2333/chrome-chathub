import { useState, useRef } from 'react';
import { MessageSquare, PanelLeft } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';

import { Sidebar } from './components/Sidebar';
import { ChatFrame } from './components/ChatFrame';
import { SortableChatFrame } from './components/SortableChatFrame'; // Import the new component
import { UnifiedInput } from './components/UnifiedInput';
import { PromptLibrary } from './components/PromptLibrary';
import { Settings } from './components/Settings';
import { useStore } from './store';
import { cn } from './lib/utils';
import type { ChatBot } from './types'; // Import ChatBot type here

function App() {
  const activeBots = useStore((state) => state.activeBots);
  const availableAdapters = useStore((state) => state.availableAdapters);
  const toggleBot = useStore((state) => state.toggleBot);
  const reorderBots = useStore((state) => state.reorderBots); // Get reorder action
  const addCustomAdapter = useStore((state) => state.addCustomAdapter);
  const removeCustomAdapter = useStore((state) => state.removeCustomAdapter);
  const updateCustomAdapter = useStore((state) => state.updateCustomAdapter);

  const [isPromptsOpen, setIsPromptsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [focusedBotId, setFocusedBotId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10, // 移动 10px 后才算拖拽，防止普通点击被误触发
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
    // Fix iframe interference by adding a class to body
    document.body.classList.add('is-dragging');
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    document.body.classList.remove('is-dragging');

    if (over && active.id !== over.id) {
      const oldIndex = activeBots.findIndex((bot) => bot.instanceId === active.id);
      const newIndex = activeBots.findIndex((bot) => bot.instanceId === over.id);
      reorderBots(oldIndex, newIndex);
    }
  };

  const handleToggleBot = (id: string) => {
    toggleBot(id);
  };


  // Grid / Layout Calculation
  // Responsive behavior:
  // - Mobile/Small: 1 column
  // - Medium: 2 columns (Field/Grid)
  // - Large: 3+ columns (Side-by-side)
  const getGridClass = () => {
    const count = activeBots.length;
    if (count <= 1) return "grid-cols-1";

    // For 2 bots: split screen (2 cols) usually
    if (count === 2) return "grid-cols-1 md:grid-cols-2";

    // For 3 bots: 
    // Small: 1 col
    // Medium: 2 cols (2 + 1) -> "田字格" style
    // Large: 3 cols (1 + 1 + 1) -> "纵向排列" (Side by side)
    if (count === 3) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

    // For 4+ bots:
    // Medium: 2 cols (2x2)
    // Large: 3 or 4 cols
    return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
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

  // Clear timer if manually toggled or component unmounts
  // We can wrap the toggle in a handler if we want to be precise,
  // but just clearing on enter/leave is the main requirement.

  const isDarkMode = useStore((state) => state.isDarkMode);

  return (
    <div
      className={cn(
        "flex h-screen w-screen overflow-hidden font-system",
        isDarkMode ? "bg-mac-dark text-mac-text-dark" : "bg-mac-light text-mac-text-light"
      )}
    // Removed inline style to rely on Tailwind classes
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
        <div className="flex-1 overflow-hidden p-4 pb-[120px]">
          {activeBots.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center">
                <span className="text-2xl">⚡️</span>
              </div>
              <p className="text-lg font-medium">暂无活跃对话</p>
              <p className="text-sm">请从左侧栏选择一个 AI 服务开始</p>
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
                  "grid gap-1 h-full transition-all duration-300 [grid-auto-rows:1fr] p-2 pb-0",
                  focusedBotId ? "grid-cols-1" : getGridClass()
                )}
              >
                <SortableContext
                  items={activeBots.map((b) => b.instanceId)}
                  strategy={rectSortingStrategy}
                >
                  {activeBots.map((bot) => {
                    // If focused, only show the focused bot
                    if (focusedBotId && focusedBotId !== bot.id) return null;

                    // If focused, render regular ChatFrame (no drag)
                    if (focusedBotId) {
                      return (
                        <ChatFrame
                          key={bot.instanceId}
                          bot={bot}
                          isFocused={true}
                          onToggleFocus={() => setFocusedBotId(null)}
                          onRemove={() => handleToggleBot(bot.id)}
                          className={cn(
                            "transition-all duration-300 min-h-0",
                            "h-full"
                          )}
                        />
                      );
                    }

                    // Otherwise render SortableChatFrame
                    return (
                      <SortableChatFrame
                        key={bot.instanceId}
                        bot={bot}
                        isFocused={false}
                        onToggleFocus={() => setFocusedBotId(bot.id)}
                        onRemove={() => handleToggleBot(bot.id)}
                      />
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
          "fixed bottom-9 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl hover:scale-105 active:scale-95",
          "bg-white/80 dark:bg-[#2c2c2e]/80 backdrop-blur-2xl backdrop-saturate-200",
          "border border-white/20 dark:border-white/[0.08] shadow-black/20",
          isPromptsOpen ? "text-blue-500 bg-white dark:bg-[#3a3a3c]" : "text-gray-600 dark:text-gray-300"
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

      {/* Floating Sidebar Toggle (Visible when collapsed) */}
      <div
        className={cn(
          "fixed bottom-9 left-6 z-50 transition-all duration-300",
          isSidebarCollapsed ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
        )}
      >
        <button
          onClick={() => setIsSidebarCollapsed(false)}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-105 active:scale-95",
            "bg-white/80 dark:bg-[#2c2c2e]/80 backdrop-blur-2xl backdrop-saturate-200 border border-white/20 dark:border-white/[0.08]",
            "text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white"
          )}
          title="展开侧边栏"
        >
          <PanelLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Overlay for Focus Mode (Background dim) */}
      {focusedBotId && activeBots.length > 1 && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 pointer-events-none transition-opacity duration-300"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default App;
