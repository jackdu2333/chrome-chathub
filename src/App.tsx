import { useState } from 'react';
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

  const isDarkMode = useStore((state) => state.isDarkMode);

  return (
    <div
      className={cn(
        "flex h-screen w-screen overflow-hidden font-sans",
        isDarkMode ? "bg-gray-900 text-gray-100" : "text-gray-900"
      )}
      style={!isDarkMode ? { backgroundColor: '#6d8db6' } : undefined}
    >
      {/* 1. Sidebar */}
      <Sidebar
        adapters={availableAdapters}
        activeBotIds={activeBots.map(b => b.id)}
        onToggleBot={handleToggleBot}
        onTogglePrompts={() => setIsPromptsOpen(!isPromptsOpen)}
        isPromptsOpen={isPromptsOpen}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
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
          <UnifiedInput onTogglePrompts={() => setIsPromptsOpen(!isPromptsOpen)} />
        </div>
      </div>

      {/* 4. Prompt Library Drawer */}
      <PromptLibrary
        isOpen={isPromptsOpen}
        onClose={() => setIsPromptsOpen(false)}
        isSidebarCollapsed={isSidebarCollapsed}
      />

      {/* 5. Settings Modal */}
      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        adapters={availableAdapters}
        onAddAdapter={addCustomAdapter}
        onRemoveAdapter={removeCustomAdapter}
        onUpdateAdapter={updateCustomAdapter}
      />

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
