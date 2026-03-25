import { useState, useEffect } from 'react';
import { Layers3 } from 'lucide-react';
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
import { Settings } from './components/Settings';
import { useStore } from './store';
import { cn } from './lib/utils';
import type { ChatBot } from './types';
import { useBotDragAndDrop } from './hooks/useBotDragAndDrop';
import { useFrameProtocolBridge } from './runtime/useFrameProtocolBridge';

function App() {
  useFrameProtocolBridge();

  const activeBots = useStore((state) => state.activeBots);
  const availableAdapters = useStore((state) => state.availableAdapters);
  const toggleBot = useStore((state) => state.toggleBot);
  const addCustomAdapter = useStore((state) => state.addCustomAdapter);
  const removeCustomAdapter = useStore((state) => state.removeCustomAdapter);
  const updateCustomAdapter = useStore((state) => state.updateCustomAdapter);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [focusedBotId, setFocusedBotId] = useState<string | null>(null);
  const [isModelDrawerOpen, setIsModelDrawerOpen] = useState(false);

  const { sensors, activeDragId, handleDragStart, handleDragEnd } = useBotDragAndDrop();

  const handleToggleBot = (id: string) => {
    toggleBot(id);
  };

  const toggleModelDrawer = () => {
    setIsModelDrawerOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (isModelDrawerOpen) {
        setIsModelDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModelDrawerOpen]);

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
        "relative flex h-screen w-screen overflow-hidden font-system transition-colors duration-300",
        "bg-transparent text-slate-100"
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] h-[380px] w-[380px] rounded-full bg-sky-500/6 blur-3xl" />
        <div className="absolute right-[-6%] top-[6%] h-[240px] w-[240px] rounded-full bg-blue-500/6 blur-3xl" />
        <div className="absolute bottom-[-24%] left-[32%] h-[320px] w-[320px] rounded-full bg-cyan-400/3 blur-3xl" />
      </div>

      <Sidebar
        adapters={availableAdapters}
        activeBotIds={activeBots.map(b => b.id)}
        onToggleBot={handleToggleBot}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isOpen={isModelDrawerOpen}
        onClose={() => setIsModelDrawerOpen(false)}
      />

      <div className="relative flex h-full min-w-0 flex-1 flex-col p-3">
        <div className="workspace-canvas relative flex h-full min-h-0 flex-col">
          <div className="flex-1 min-h-0 overflow-hidden pb-[76px]">
            {activeBots.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/[0.08] bg-white/[0.03]">
                  <Layers3 className="h-7 w-7 text-sky-300" />
                </div>
                <h2 className="font-display text-[28px] font-semibold text-white">
                  选择模型开始并行对话
                </h2>
                <p className="mt-3 max-w-[540px] text-[15px] leading-7 text-slate-400">
                  聊天窗口会出现在这里，方便你同时比较多个 AI 的输出结果。
                </p>
                <button
                  onClick={() => setIsModelDrawerOpen(true)}
                  className="btn-secondary mt-6 h-11 rounded-full px-5 text-slate-100"
                >
                  打开模型栏
                </button>
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
                            isFocused ? "relative z-40" : "",
                            isHidden ? "invisible" : ""
                          )}
                        >
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

                <DragOverlay>
                  {activeDragId ? (
                    <ChatFrame
                      bot={activeBots.find((b) => b.instanceId === activeDragId) as ChatBot}
                      isFocused={false}
                      onToggleFocus={() => { }}
                      onRemove={() => { }}
                      isDragging={true}
                      className="h-full opacity-90 cursor-grabbing"
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </div>

          <UnifiedInput
            isModelDrawerOpen={isModelDrawerOpen}
            onToggleModelDrawer={toggleModelDrawer}
          />
        </div>
      </div>

      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        adapters={availableAdapters}
        onAddAdapter={addCustomAdapter}
        onRemoveAdapter={removeCustomAdapter}
        onUpdateAdapter={updateCustomAdapter}
      />

      {focusedBotId && activeBots.length > 1 && (
        <div
          className="fixed inset-0 z-30 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(2,6,23,0.18),rgba(2,6,23,0.62))] transition-opacity duration-300"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default App;
