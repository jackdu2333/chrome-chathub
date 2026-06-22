import { useState, useEffect, useMemo } from 'react';
import { Layers3, LayoutGrid, PanelLeftClose, Focus, Rows3 } from 'lucide-react';
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
import { resolvePrimaryBot, resolveSecondaryBots } from './lib/resolveTargets';
import { useBotDragAndDrop } from './hooks/useBotDragAndDrop';
import { useFrameProtocolBridge } from './runtime/useFrameProtocolBridge';

function App() {
  useFrameProtocolBridge();

  const activeBots = useStore((state) => state.activeBots);
  const availableAdapters = useStore((state) => state.availableAdapters);
  const isInputCollapsed = useStore((state) => state.isInputCollapsed);
  const toggleBot = useStore((state) => state.toggleBot);
  const addCustomAdapter = useStore((state) => state.addCustomAdapter);
  const removeCustomAdapter = useStore((state) => state.removeCustomAdapter);
  const updateCustomAdapter = useStore((state) => state.updateCustomAdapter);
  const uiThemeVariant = useStore((state) => state.uiThemeVariant);
  const themeMode = useStore((state) => state.themeMode || 'system');
  const setDarkMode = useStore((state) => state.setDarkMode);
  const layoutMode = useStore((state) => state.layoutMode);
  const setLayoutMode = useStore((state) => state.setLayoutMode);
  const primaryInstanceId = useStore((state) => state.primaryInstanceId);
  const setPrimaryInstanceId = useStore((state) => state.setPrimaryInstanceId);

  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateTheme = () => {
      let isDark = false;
      if (themeMode === 'system') {
        isDark = mediaQuery.matches;
      } else {
        isDark = themeMode === 'dark';
      }
      
      if (isDark) {
        root.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        root.classList.remove('dark');
        document.body.classList.remove('dark');
      }
      setDarkMode(isDark);
    };

    updateTheme();

    const handleThemeChange = () => {
      if (themeMode === 'system') {
        updateTheme();
      }
    };

    mediaQuery.addEventListener('change', handleThemeChange);
    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  }, [themeMode, setDarkMode]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [focusedInstanceId, setFocusedInstanceId] = useState<string | null>(null);
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

  // 清理失效的 focusedInstanceId
  useEffect(() => {
    if (focusedInstanceId && !activeBots.some(bot => bot.instanceId === focusedInstanceId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFocusedInstanceId(null);
    }
  }, [activeBots, focusedInstanceId]);

  // v1.1: 清理失效的 primaryInstanceId
  useEffect(() => {
    if (primaryInstanceId && !activeBots.some(bot => bot.instanceId === primaryInstanceId)) {
      setPrimaryInstanceId(null);
    }
  }, [activeBots, primaryInstanceId, setPrimaryInstanceId]);

  useEffect(() => {
    document.body.classList.toggle('ui-variant-bold', uiThemeVariant === 'bold');
    return () => {
      document.body.classList.remove('ui-variant-bold');
    };
  }, [uiThemeVariant]);

  // v1.1: primary-scroll 布局的主窗口/副窗口解析
  const isPrimaryScroll = layoutMode === 'primary-scroll' && activeBots.length >= 3;
  const primaryBot = useMemo(
    () => isPrimaryScroll ? resolvePrimaryBot(activeBots, primaryInstanceId) : null,
    [isPrimaryScroll, activeBots, primaryInstanceId]
  );
  const secondaryBots = useMemo(
    () => isPrimaryScroll ? resolveSecondaryBots(activeBots, primaryInstanceId) : [],
    [isPrimaryScroll, activeBots, primaryInstanceId]
  );

  const getDynamicGridClass = () => {
    const count = activeBots.length;
    // primary-scroll 在 3+ 窗口时走独立渲染分支，不返回 grid class
    if (layoutMode === 'focus' && count >= 2) return "chat-grid-container chat-layout-focus";
    if (layoutMode === 'vertical') return "chat-grid-container chat-layout-vertical";
    if (count <= 1) return "chat-grid-cols-1";
    if (count === 2) return "chat-grid-cols-2";
    if (count === 3) return "chat-grid-cols-3";
    return "chat-grid-cols-4";
  };

  return (
    <div
      className={cn(
        "relative flex h-screen w-screen overflow-hidden font-system transition-colors duration-300",
        "bg-transparent text-[var(--text-strong)]"
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={cn(
            "absolute left-[-12%] top-[-12%] h-[420px] w-[420px] rounded-full blur-3xl",
            uiThemeVariant === 'bold' ? "bg-[#382A2E]/32" : "bg-[#d8cbc1]/14"
          )}
        />
        <div
          className={cn(
            "absolute right-[-8%] top-[4%] h-[280px] w-[280px] rounded-full blur-3xl",
            uiThemeVariant === 'bold' ? "bg-[#26332A]/32" : "bg-[#b7c8bf]/12"
          )}
        />
        <div
          className={cn(
            "absolute bottom-[-26%] left-[30%] h-[360px] w-[360px] rounded-full blur-3xl",
            uiThemeVariant === 'bold' ? "bg-[#36312D]/30" : "bg-[#bec8d5]/10"
          )}
        />
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
          {/* 布局切换器：浮动左上角 */}
          {activeBots.length >= 2 && (
            <div className="pointer-events-auto absolute left-3 top-3 z-30 flex items-center gap-0.5 rounded-full border border-white/[0.06] bg-black/30 p-0.5 opacity-60 backdrop-blur-sm transition-opacity hover:opacity-100">
              {([
                { mode: 'grid', icon: LayoutGrid, label: '均分' },
                { mode: 'primary-scroll', icon: PanelLeftClose, label: '主次横滑' },
                { mode: 'focus', icon: Focus, label: '焦点' },
                { mode: 'vertical', icon: Rows3, label: '纵向' },
              ] as const).map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setLayoutMode(mode)}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full transition-all",
                    layoutMode === mode
                      ? "bg-[#bec8d5]/20 text-[#f1f6f3]"
                      : "text-slate-500 hover:text-slate-300"
                  )}
                  title={label}
                >
                  <Icon className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
          <div
            className={cn(
              "flex-1 min-h-0 overflow-hidden transition-all duration-300",
              isInputCollapsed ? "pb-[4px]" : "pb-[60px]"
            )}
          >
            {activeBots.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/[0.08] bg-white/[0.03]">
                  <Layers3 className={cn("h-7 w-7", uiThemeVariant === 'bold' ? "text-[#B5C4D1]" : "text-[#c2ccd6]")} />
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
            ) : isPrimaryScroll && primaryBot ? (
              /* v1.1: 主次横滑布局 — 3+ 窗口时独立渲染 */
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="chat-layout-primary-scroll">
                  {/* 主窗口 */}
                  <div className="chat-layout-primary-scroll-main">
                    <SortableContext items={[primaryBot.instanceId]} strategy={rectSortingStrategy}>
                      <div className="chat-grid-item min-h-0 min-w-0 h-full">
                        <SortableChatFrame
                          bot={primaryBot}
                          isFocused={focusedInstanceId === primaryBot.instanceId}
                          onToggleFocus={() => setFocusedInstanceId(
                            focusedInstanceId === primaryBot.instanceId ? null : primaryBot.instanceId
                          )}
                          onRemove={() => handleToggleBot(primaryBot.id)}
                        />
                      </div>
                    </SortableContext>
                  </div>

                  {/* 副窗口横向滑动区 */}
                  <div className="chat-layout-primary-scroll-secondary">
                    {secondaryBots.length > 1 && (
                      <div className="absolute right-4 top-1 z-10 rounded-full bg-black/40 px-2.5 py-0.5 text-[10px] text-slate-400 backdrop-blur-sm">
                        滑动查看 · {secondaryBots.length} 个
                      </div>
                    )}
                    <SortableContext items={secondaryBots.map(b => b.instanceId)} strategy={rectSortingStrategy}>
                      {secondaryBots.map((bot) => (
                        <div
                          key={bot.instanceId}
                          className="chat-layout-primary-scroll-secondary-item"
                        >
                          <SortableChatFrame
                            bot={bot}
                            isFocused={focusedInstanceId === bot.instanceId}
                            onToggleFocus={() => setFocusedInstanceId(
                              focusedInstanceId === bot.instanceId ? null : bot.instanceId
                            )}
                            onRemove={() => handleToggleBot(bot.id)}
                            onSetPrimary={() => setPrimaryInstanceId(bot.instanceId)}
                          />
                        </div>
                      ))}
                    </SortableContext>
                  </div>
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
            ) : (
              /* 标准网格布局 */
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
                      const isFocused = focusedInstanceId === bot.instanceId;
                      const isHidden = focusedInstanceId && !isFocused;

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
                            onToggleFocus={() => setFocusedInstanceId(isFocused ? null : bot.instanceId)}
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
            focusedInstanceId={focusedInstanceId}
            setFocusedInstanceId={setFocusedInstanceId}
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

      {focusedInstanceId && activeBots.length > 1 && (
        <div
          className={cn(
            "fixed inset-0 z-30 pointer-events-none transition-opacity duration-300",
            uiThemeVariant === 'bold'
              ? "bg-[radial-gradient(circle_at_center,rgba(181,196,209,0.12),rgba(34,43,54,0.72))]"
              : "bg-[radial-gradient(circle_at_center,rgba(214,208,201,0.08),rgba(7,6,10,0.58))]"
          )}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default App;
