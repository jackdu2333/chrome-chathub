# 系统详细设计说明书 (System Detailed Design Specification)

**版本**: 1.0  
**日期**: 2026-02-08  
**项目**: Chrome 对话拓展 (All-in-One AI Chat Sidebar)

---

## 1. 项目概述 (Project Overview)

本项目是一个基于 Chrome Extension (Manifest V3) 的 AI 聚合对话工具。其核心目标是提供一个统一的界面（侧边栏或全屏页），允许用户同时与多个主流 AI 聊天机器人（如 ChatGPT, Claude, Gemini, Kimi 等）进行对话。

### 核心价值
- **多模型并发**: 在同一屏幕上对比不同 AI 的回答。
- **统一输入**: 通过底部统一的输入栏，一键发送消息给所有激活的 AI 窗口。
- **自定义扩展**: 用户可以添加任意 Web 聊天界面作为新的 "Bot"，只需提供 URL 和 DOM 选择器。
- **提示词管理**: 内置提示词库，支持快速调用和管理常用指令。

---

## 2. 技术架构 (Technical Architecture)

### 2.1 技术栈 (Tech Stack)
- **前端框架**: [React 18](https://react.dev/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **语言**: [TypeScript](https://www.typescriptlang.org/)
- **样式方案**: [Tailwind CSS](https://tailwindcss.com/) (支持 Dark Mode)
- **状态管理**: [Zustand](https://github.com/pmndrs/zustand) (轻量级、Hooks 风格)
- **图标库**: [Lucide React](https://lucide.dev/)
- **UI 组件**: 自研 Apple 风格（圆角、模糊背景、阴影）

### 2.2 扩展架构 (Extension Architecture)
遵循 **Manifest V3** 规范：
- **Side Panel**: 主要 UI 入口（`index.html`），承载 React 应用。
- **Content Script**: 注入到目标 AI 网站（iframe 内），负责接收主窗口指令（填入文本、点击发送）并执行 DOM 操作。
- **Background Script**: 处理跨域请求规则（Declarative Net Request）以允许 iframe 嵌入（移除 `X-Frame-Options` 等头），以及处理 Tab/Window 间的消息协调。
- **Storage**: 使用 `chrome.storage.local` 进行数据持久化（保存用户配置、自定义 Bot、提示词）。

---

## 3. 核心模块设计 (Core Modules)

### 3.1 全局状态管理 (`src/store.ts`)
使用 Zustand 管理单一数据源，主要状态包括：
- `activeBots`: 当前激活（显示在网格中）的机器人列表。
- `availableAdapters`: 所有可用适配器（包含预设和自定义）。
- `isSyncEnabled`: 是否开启同步发送模式。
- `prompts`: 提示词列表数据。
- `draftContent`: 统一输入框的草稿内容（用于 Prompt Library 与 Input Bar 同步）。
- `adapterPreferences`: 用户偏好（置顶顺序、Pin 状态）。

### 3.2 侧边栏 (`src/components/Sidebar.tsx`)
**功能**: 导航与服务管理。
- **服务列表**: 渲染 `availableAdapters`，点击图标 toggle 激活状态。
- **右键菜单**: 支持置顶/取消置顶 (`ContextMenu.tsx`)。
- **交互**: 支持折叠/展开（Sliding Drawer 效果），折叠时宽度为 0 但保留 Toggle 按钮。
- **入口**: 底部包含【设置】入口，顶部包含【提示词库】入口。

### 3.3 主聊天区域 (`src/components/ChatFrame.tsx` & `App.tsx`)
**功能**: 承载 iframe 并管理布局。
- **Grid Layout**: 根据 `activeBots` 数量自动计算网格列数 (1列, 2列分屏, 3列田字格/并排, 4列等)。
- **ChatFrame**:
  - 每个 Bot 对应一个 `<iframe>`。
  - 顶部 Toolbar: 包含名称、刷新按钮、关闭按钮、缩放按钮（Focus Mode）。
  - **Focus Mode**: 点击缩放，该 Bot 占满全屏，其他 Bot 隐藏（背景变暗）。
  - **Iframe 管理**: 使用 `instanceId` 作为 key，确保重置时强制刷新 iframe。

### 3.4 统一输入栏 (`src/components/UnifiedInput.tsx`)
**功能**: 全局输入与控制中心。
- **同步发送**: 监听 Enter 键，将 `draftContent` 通过 `broadcastMessage` 发送给所有 iframe。
- **样式**: 悬浮式设计，背景高斯模糊 (Backdrop Blur)。
- **集成**:
  - 左侧: 同步开关、提示词库开关。
  - 右侧: 新对话（重置所有 iframe）。

### 3.5 提示词库 (`src/components/PromptLibrary.tsx`)
**功能**: 管理常用 Prompt。
- **数据流**: 直接读取/写入 Store 的 `prompts`。
- **UI**: 侧滑抽屉面板 (Drawer)，支持分类折叠。
- **交互**:
  - 点击条目 -> 填充到 `UnifiedInput` 并关闭库。
  - 搜索 -> 实时过滤标题/内容/分类。
  - CRUD -> 新增、编辑、删除（系统预设除外）。

### 3.6 设置与自定义服务 (`src/components/Settings.tsx`)
**功能**: 添加非预设的 AI 网站。
- **自动检测 (Auto-Detect)**:
  - 核心逻辑: 创建隐藏 iframe -> 注入脚本 -> 遍历 DOM 寻找最优 `textarea` 和 `button[submit]` 选择器 -> 返回主窗口。
  - 容错: 处理 CSP (Content Security Policy) 拦截，提供手动在新标签页检测的引导。
- **手动添加**: 用户输入名称、URL、CSS 选择器。

---

## 4. 数据结构定义 (`src/types.ts`)

### 4.1 服务适配器 (ServiceAdapter)
定义如何连接一个 AI 网站：
```typescript
interface ServiceAdapter {
    id: string;          // 唯一标识 (如 'chatgpt', 'custom-1')
    name: string;        // 显示名称
    url: string;         // 目标 URL
    inputSelector: string;  // 输入框 CSS 选择器
    submitSelector: string; // 提交按钮 CSS 选择器
    icon?: string;       // (可选) 图标 URL
}
```

### 4.2 聊天实例 (ChatBot)
运行时状态，继承自 `ServiceAdapter`：
```typescript
interface ChatBot extends ServiceAdapter {
    isActive: boolean;   // 是否在网格中显示
    instanceId: string;  // 实例 ID (每次刷新重新生成)
}
```

### 4.3 提示词 (Prompt)
```typescript
interface Prompt {
    id: string;
    title: string;       // 标题 (如 "代码审查")
    content: string;     // 具体内容
    category: string;    // 分类 (如 "编程", "写作")
    isSystem?: boolean;  // 是否为只读系统预设
    lastUsed?: number;   // 最后使用时间 (用于排序)
}
```

---

## 5. 关键业务流程

### 5.1 消息同步机制
1. **输入**: 用户在 `UnifiedInput` 输入文本。
2. **触发**: 用户按 Enter 或点击发送。
3. **广播**: 主窗口调用 `lib/broadcast.ts` -> `broadcastMessage('USER_MESSAGE', { text, autoSubmit })`。
4. **接收**: 每个 iframe 内的 `content/index.ts` 监听到 `message` 事件。
   - 验证 `event.origin` 防止恶意调用。
5. **执行**:
   - `document.querySelector(adapter.inputSelector)` -> 设置 `value` -> 触发 `input` 事件（模拟 React/Vue 输入）。
   - 如果 `autoSubmit` 为 true -> `document.querySelector(adapter.submitSelector).click()`。

### 5.2 布局自适应
- **App.tsx Component**:
  - 监听 `activeBots.length`。
  - `length === 1`: `grid-cols-1`
  - `length === 2`: `md:grid-cols-2` (分屏)
  - `length === 3`: `lg:grid-cols-3` (三列)
  - ...
- **Sidebar**:
  - `isCollapsed` 状态控制宽度 (`w-16` vs `w-0`)。
  - 主内容区自动填充剩余空间 (`flex-1`).

---

## 6. 开发进展与完成度

### ✅ 已完成功能 (Completed)
1.  **基础框架**: React + Vite + Tailwind 架构搭建完成。
2.  **多路对话**: 支持任意数量 Bot 分屏显示，支持 Focus 模式放大。
3.  **自定义服务**: 支持用户添加任意 URL，包含简单的 CSS 选择器自动检测功能。
4.  **消息同步**: 实现了跨域 iframe 的消息注入，解决了 React/Vue 框架下的输入事件触发问题。
5.  **提示词库**: 完整的 CRUD 管理，支持分类、搜索、一键填充。
6.  **UI/UX**:
    - 全面汉化 (Localization)。
    - Apple-style 视觉风格 (模糊背景、圆角、阴影)。
    - 侧边栏折叠动画。
    - 输入框视觉优化 (去重影)。
7.  **数据持久化**: 所有配置同步保存至 Chrome Storage。

### 🚧 待办/优化 (Future Work)
1.  **云端同步**: 目前仅本地存储，未来可支持 Google 账号同步配置。
2.  **更强的自动检测**: 当前选择器检测逻辑较简单，可引入 LLM 辅助分析 DOM。
3.  **截图/OCR**: 允许从主窗口截图并发送给 AI（需配合 Vision 模型）。
4.  **插件系统**: 允许第三方开发者提交适配器配置。

---

## 7. 目录结构说明

```
/src
  /components     # UI 组件
    Sidebar.tsx       # 左侧导航
    ChatFrame.tsx     # 单个 AI 窗口
    UnifiedInput.tsx  # 底部输入栏
    PromptLibrary.tsx # 提示词库面板
    Settings.tsx      # 设置/添加服务面板
    ContextMenu.tsx   # 右键菜单封装
  /lib            # 工具库
    utils.ts          # ClassName 合并等
    broadcast.ts      # 消息广播逻辑
  /content        # Content Script
    index.ts          # 注入 iframe 的脚本
  App.tsx         # 主应用入口 (布局管理)
  store.ts        # Zustand 全局状态定义
  types.ts        # TypeScript 类型定义
  manifest.json   # Chrome 扩展配置
```

---

此文档旨在帮助 AI 理解项目全貌，进行二次开发时请参考此架构。
