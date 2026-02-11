# JackDu ChatHub - 系统详细设计说明书

**版本**: 1.0.0  
**更新日期**: 2026-02-09  
**项目名称**: JackDu ChatHub (多 AI 对话聚合器)

---

## 1. 技术栈与架构概览

### 1.1 技术栈
- **前端框架**: React 19 + TypeScript
- **状态管理**: Zustand
- **样式方案**: Tailwind CSS (核心: 极简主义, Apple 风格 UI)
- **图标库**: Lucide React
- **扩展规范**: Chrome Extension Manifest V3
- **构建工具**: Vite + CRXJS (Vite 插件)

### 1.2 系统架构图
```mermaid
graph TD
    subgraph "浏览器层 (Browser Layer)"
        UI["Main Entry (App.tsx)"]
        Store["Zustand Store (store.ts)"]
        Sidebar["Sidebar Component"]
        Input["Unified Input Component"]
    end

    subgraph "窗口层 (Frame Layer)"
        ChatFrame1["ChatFrame (Iframe 1)"]
        ChatFrame2["ChatFrame (Iframe 2)"]
    end

    subgraph "注入层 (Injection Layer)"
        CS1["Content Script (context of Bot 1)"]
        CS2["Content Script (context of Bot 2)"]
    end

    UI --> Store
    UI --> ChatFrame1
    UI --> ChatFrame2
    Input -- "postMessage" --> CS1
    Input -- "postMessage" --> CS2
    CS1 -- "DOM Control" --> AI1["AI Service Site 1"]
    CS2 -- "DOM Control" --> AI2["AI Service Site 2"]
```

---

## 2. 核心模块设计

### 2.1 主应用 (App.tsx)
负责整体布局管理容器。
- **Grid Layout**: 动态计算列数, 支持 `1x1` (单屏), `2x1` (分屏), `Grid` (多屏) 布局。
- **Overlay**: 处理全屏/聚焦模式 (Focus mode) 的遮罩逻辑。

### 2.2 状态管理 (store.ts)
使用 Zustand 实现轻量级持久化状态管理。
- **Persistence**: 与 `chrome.storage.local` 同步。
- **Actions**: 
    - `loadActiveBots()`: 从存储加载当前激活的 AI 实例。
    - `toggleBot()`: 切换 AI 服务挂载状态。
    - `reloadAllBots()`: 用于清空当前所有会话环境。
    - `saveActiveBots()`: 持久化当前用户的选择。

### 2.3 消息广播系统 (lib/broadcast.ts)
封装了 `postMessage` 通信逻辑。
- **机制**: 遍历页面上所有的 `iframe`, 通过 `contentWindow.postMessage` 发送统一指令。
- **安全**: 通信包含唯一的 `HubMessage` 类型验证。

### 2.4 注入脚本 (content/index.ts)
这是系统的"大脑", 运行在每个 AI 服务的页面上下文中。
- **Lifecycle**: 
    1. 页面加载时检测当前 HOST。
    2. 加载对应的 `ServiceAdapter` 配置。
    3. 监听来自 Hub 的 `USER_MESSAGE` 指令。
- **Native Value Setter**: 绕过 React/Vue 等框架的内部状态校验, 直接操作底层 DOM 的 `value` 属性原型。
- **Event Simulation**: 精确模拟 `Input`, `Change` 以及 `KeyboardEvent` (Enter 键) 操作。

---

## 3. 关键逻辑实现

### 3.1 绕过框架校验 (Native Setter)
某些 AI 网站（如 DeepSeek, ChatGPT）会对输入框进行状态捕获。直接修改 `textarea.value` 不会触发其内部 state 更新。
**实现细节**:
```typescript
const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 
    'value'
)?.set;
nativeSetter?.call(element, value);
element.dispatchEvent(new Event('input', { bubbles: true }));
```

### 3.2 同步多窗口提交
同步模式开启时 (`isSyncEnabled`), Content Script 在注入文字后立即执行 `simulateEnterKey`。
**优化策略**: 针对不同网站(如 DeepSeek) 简化了 `beforeinput` 事件, 采用最直接的 `keydown/keypress/keyup` 序列。

### 3.3 自动选择器探测 (lib/selectorDetector.ts)
当用户添加自定义站点时, 系统会尝试自动识别输入框和发送按钮。
- **得分算法**: 基于特定的元素特征（如 `id=textarea`, `placeholder` 关键词, `aria-label` 等）进行权重评分。

---

## 4. 数据结构 (types.ts)

### 4.1 ServiceAdapter (服务适配器)
定义了如何操作一个特定的 AI 网站。
```typescript
interface ServiceAdapter {
    id: string;
    name: string;
    url: string;
    inputSelector: string;  // 输入框 CSS 选择器
    submitSelector: string; // 提交按钮 CSS 选择器
}
```

### 4.2 StorageData (存储结构)
```typescript
interface StorageData {
    activeBotIds: string[];   // 记录开启的 AI
    isSyncEnabled: boolean;   // 全局同步开关
    customAdapters: ServiceAdapter[]; // 用户自定义的站点
}
```

---

## 5. UI/UX 设计规范 (Apple 极致简约)

### 5.1 底部输入栏设计 (UnifiedInput.tsx)
- **盒子模型**: `min-height: 48px`, `width: 80%`, `max-width: 800px`。
- **层深效果**: 80% 透明底色 + `backdrop-blur-xl` (毛玻璃) + 顶部 `white/20` 高光条。
- **实体化槽位**: 输入框区域 (`textarea` 容器) 采用 `rgba(0,0,0,0.2)` 背景, 产生视觉上的凹陷感。

### 5.2 窗口控制
- **Header**: 40px 高度, 双击可触发全屏覆盖逻辑。
- **Spacing**: 窗口间距 8-12px, 与底栏间距优化为 6px。

---

## 6. 开发者指南 (下一步优化建议)

1. **选择器弹性**: 随着 AI 网站 UI 更新, `rules.json` 中的选择器可能失效, 建议引入更动态的定位算法。
2. **Session 隔离**: 目前依赖浏览器默认的 Cookie 共享, 若需多账号登录, 可探索 Chrome `storage` 分区。
3. **性能**: 大量窗口同时加载时, 通过 `loading="lazy"` 或滚动可见性优化 CPU/GPU 资源分配。

---

## 7. 文件组织结构
```text
/src
  /background      # 后台服务脚本
  /components      # UI 组件 (Sidebar, UnifiedInput, ChatFrame)
  /content         # 注入脚本核心逻辑
  /lib             # 通用工具库 (广播、检测、辅助函数)
  /store.ts        # 全局状态 (Zustand)
  /types.ts        # 全局接口声明
  main.tsx         # 入口文件
  rules.json       # 跨域 Header 绕过规则
```
