# Chrome ChatHub

> 手动选择模型的多 AI 对比工作台。用户自己选模型、选发送范围、观察对比。工具不替用户做决定。

Chrome 扩展：单一界面同时与多个 AI 服务对话，统一输入广播到所有窗口，支持文件上传、拖拽排序、macOS 风格 UI。

## 核心功能

- **多窗口 AI 聚合**：响应式网格布局，iframe 嵌入第三方 AI 网站
- **发送目标系统**：全部窗口 / 当前窗口 / 自选窗口三种模式，明确知道发给了谁
- **草稿保护**：部分失败时保留草稿，全部成功才清空
- **发送结果反馈**：toast 提示成功/部分失败/全部失败，失败原因可查看
- **模型搜索与分组**：按名称/域名/标签搜索，按通用/中文/编程/搜索分类分组
- **模型组合**：保存常用对比组合，一键替换或追加
- **模型栏**：macOS 风格 drawer，置顶按钮外显，稳定等级标记
- **布局系统**：均分 / 主次 / 焦点 / 纵向四种布局模式
- **诊断面板**：每个窗口可查看状态、能力检测、错误码中文解释、selector 配置
- **自定义 Adapter**：添加/编辑/删除 AI 服务，支持 selector 测试
- **键盘快捷键**：Enter 发送 / Cmd+Ctrl+Enter 发全部 / Cmd+Ctrl+Shift+Enter 发当前

## 已适配服务

ChatGPT / Gemini / 豆包 / 千问 / 文心一言 / Kimi / DeepSeek / ChatGLM / Copilot / Claude / Tabbit

## Tech Stack

| 层 | 技术 |
|---|---|
| 前端框架 | React 19 + TypeScript |
| 状态管理 | Zustand（chrome.storage.local 持久化，4 slice 架构）|
| 样式 | Tailwind CSS（macOS 风格 glassmorphism）|
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable |
| 图标 | Lucide React |
| 构建 | Vite + CRXJS |
| 测试 | Vitest |
| 扩展规范 | Chrome Extension Manifest V3 |

## Getting Started

### Prerequisites

```bash
node -v   # Node.js 18+
npm -v
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```
Output: `dist/` folder.

### Load into Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist` folder

### Test

```bash
npm test              # vitest run
npm run check         # lint + test + build
```

## Architecture

```
浏览器层 (App.tsx + Zustand Store)
  ↓
窗口层 (ChatFrame iframe)
  ↓ postMessage
注入层 (Content Script + Drivers)
  ↓ DOM Control
AI 服务网站
```

**Store 架构（4 slices）：**
- `botSlice` — activeBots, adapter CRUD, 偏好
- `uiSlice` — 布局模式, 发送目标模式, 聚焦状态
- `settingsSlice` — 同步开关, 草稿, 主题, 输入框模式, 发送结果
- `modelGroupSlice` — 模型组合 CRUD + 持久化

**Driver 架构：** 按站点拆分（openai/doubao/chatglm/qianwen/gemini/generic），配置 + driver 双层结构。

## Design System

- **Font**: System Stack (`-apple-system`, `BlinkMacSystemFont`)
- **Theme**: Dynamic Light/Dark mode + 手动切换 + 高对比度浅色模式
- **UI 风格**: 莫兰迪 / 大胆版（高对比莫兰迪）

## Repository

- **远程**: `git@github.com:jackdu2333/chrome-chathub.git`
- **版本**: 3.9.0
