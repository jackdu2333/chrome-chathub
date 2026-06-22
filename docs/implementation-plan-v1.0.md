# Chrome ChatHub 改进实施方案 v1.0

> SSOT 文档。所有 Phase 的设计决策、数据结构、文件级落点和验收标准以此为准。
> 计划书原文存档于 Obsidian 00_Inbox/ChatHub改进计划书-v1.0.md

## 产品定位

**手动选择模型的多 AI 对比工作台。** 用户自己选模型、自己选发送范围、自己观察对比。工具不替用户做决定。

明确不做：自动选模型、智能调度、AI 路由、agent 调度。

---

## 当前代码结构（实际，截至 2026-06-21）

```
src/
  store/
    index.ts          # create<AppState> 合并三个 slice
    types.ts          # AppState = BotSlice & UISlice & SettingsSlice
    slices/
      botSlice.ts     # activeBots, toggleBot, reloadAllBots, adapter CRUD
      uiSlice.ts      # gridLayout, isDarkMode, isInputCollapsed
      settingsSlice.ts # isSyncEnabled, draftContent, theme
  runtime/
    protocol.ts       # FrameStatus, DriverCapabilities, 消息协议
    frameBridge.ts    # sendMessageBatch (返回每实例成败结果)
    frameRegistry.ts  # iframe 注册表
    useFrameSessionStore.ts # FrameSession 状态机
    useFrameProtocolBridge.ts
  components/
    UnifiedInput.tsx  # 统一输入框（当前发全部 active bots）
    Sidebar.tsx       # 模型栏
    ChatFrame.tsx     # 单个 AI 窗口
    Settings.tsx      # 设置面板
  types.ts            # ServiceAdapter, ChatBot, DEFAULT_ADAPTERS
  App.tsx             # 主入口，focusedBotId 状态在此
```

关键发现（与计划书对齐）：
- store 已经按 slice 拆分，计划书提到的 slice 路径**完全吻合**。
- `sendMessageBatch` 已返回 `{ instanceId, success, error }[]`，但 `UnifiedInput.handleSend` **没有消费返回值**，直接清空草稿。
- `App.tsx` 用 `focusedBotId`（绑定 bot.id 模型类型），不是 `focusedInstanceId`。
- `UnifiedInput.handleSend` 硬编码 `activeBots.map(bot => bot.instanceId)`，无发送目标选择。

---

## Phase 1：核心体验修复（v3.3.0）

### Issue 1：发送目标系统重构

#### 数据结构变更

**`src/store/types.ts` — UISlice 新增字段：**

```typescript
// 发送目标模式
export type SendTargetMode = 'all' | 'focused' | 'selected';

// UISlice 接口新增
export interface UISlice {
  // ... existing
  sendTargetMode: SendTargetMode;
  selectedTargetInstanceIds: string[];
  setSendTargetMode: (mode: SendTargetMode) => void;
  toggleSelectedTarget: (instanceId: string) => void;
  clearSelectedTargets: () => void;
}
```

**`src/App.tsx` — focusedBotId → focusedInstanceId：**

```typescript
const [focusedInstanceId, setFocusedInstanceId] = useState<string | null>(null);

// 窗口聚焦判断改为按 instanceId
const isFocused = focusedInstanceId === bot.instanceId;
const isHidden = focusedInstanceId && !isFocused;
```

#### UnifiedInput 发送逻辑重构

```typescript
const resolveTargetInstanceIds = (): string[] => {
  if (sendTargetMode === 'all') {
    return activeBots.map(bot => bot.instanceId);
  }
  if (sendTargetMode === 'focused') {
    return focusedInstanceId ? [focusedInstanceId] : [];
  }
  // selected
  return selectedTargetInstanceIds;
};

const targetInstanceIds = resolveTargetInstanceIds();
if (targetInstanceIds.length === 0) {
  showToast('请先选择发送目标');
  return;
}
```

#### UI 新增

输入框左侧显示当前发送目标：
- "发送到：全部 3 个模型"
- "发送到：当前窗口 Claude"
- "发送到：自选 2 个模型"

发送模式切换器（segmented control 或 dropdown）。

#### 验收标准
- 不开任何模型时，发送按钮禁用
- 当前窗口模式只发送给聚焦窗口
- 全部窗口模式发送给所有已打开模型
- 自选模式只发送给勾选模型
- 无目标时不禁发，提示"请先选择发送目标"
- 发送失败时不清空草稿

### Issue 2：发送结果反馈与草稿保护

#### 数据结构变更

**`src/store/types.ts` — SettingsSlice 新增字段：**

```typescript
export interface SendResultItem {
  instanceId: string;
  botName: string;
  success: boolean;
  error?: string;
  timestamp: number;
}

export interface LastSendSummary {
  total: number;
  successCount: number;
  failedCount: number;
  items: SendResultItem[];
}

// SettingsSlice 新增
export interface SettingsSlice {
  // ... existing
  lastSendSummary: LastSendSummary | null;
  setLastSendSummary: (summary: LastSendSummary | null) => void;
}
```

#### UnifiedInput handleSend 重构

```typescript
const results = await sendMessageBatch({
  instanceIds: targetInstanceIds,
  text: draftContent,
  autoSubmit: isSyncEnabled,
  files: selectedFiles
});

const botMap = new Map(activeBots.map(b => [b.instanceId, b.name]));
const items: SendResultItem[] = results.map(r => ({
  instanceId: r.instanceId,
  botName: botMap.get(r.instanceId) ?? 'Unknown',
  success: r.success,
  error: r.error,
  timestamp: Date.now(),
}));

const summary: LastSendSummary = {
  total: items.length,
  successCount: items.filter(i => i.success).length,
  failedCount: items.filter(i => !i.success).length,
  items,
};
setLastSendSummary(summary);

// 只有全部成功才清空草稿
if (summary.failedCount === 0) {
  setDraftContent('');
  setSelectedFiles([]);
}
```

#### Toast 反馈

| 场景 | 文案 |
|---|---|
| 全部成功 | "已发送到 3 个模型" |
| 部分失败 | "已发送 2 个，失败 1 个：Gemini 需登录" |
| 全部失败 | "发送失败，草稿已保留" |

#### 验收标准
- 发送成功后有明确反馈
- 部分失败时草稿不清空
- 失败模型可见
- 失败原因可 hover 查看

### Issue 6（Phase 1 附带）：输入框默认常驻

当前 `UnifiedInput` 会自动折叠。Phase 1 新增设置开关，默认"始终显示"。

#### 数据结构
```typescript
// SettingsSlice 新增
inputDisplayMode: 'always' | 'auto-hide';
setInputDisplayMode: (mode: 'always' | 'auto-hide') => void;
```

#### 逻辑变更
`isInputCollapsed` 的计算加入 `inputDisplayMode` 判断：`auto-hide` 模式才走折叠逻辑。

---

## Phase 2-6（后续版本）

| Phase | 版本 | 模块 | 核心文件 |
|---|---|---|---|
| 2 | v3.4.0 | C: 模型选择面板 + H: adapter 稳定性 | Sidebar.tsx, types.ts |
| 3 | v3.5.0 | D: 模型组合 | 新增 modelGroupSlice, Sidebar.tsx |
| 4 | v3.6.0 | E: 布局系统 | App.tsx, index.css, ChatFrame.tsx |
| 5 | v3.7.0 | G: 诊断面板 | ChatFrame.tsx, 新增 AdapterDiagnostics.tsx |
| 6 | v3.8.0 | I: 安全权限 + J: 测试 | manifest.json, frameBridge.ts, tests/ |

详细方案见 Obsidian 存档计划书原文。

---

## 实施顺序（Phase 1）

1. `src/store/types.ts`：新增 SendTargetMode、SendResultItem、LastSendSummary、inputDisplayMode 类型
2. `src/store/slices/uiSlice.ts`：新增 sendTargetMode 状态和 setter
3. `src/store/slices/settingsSlice.ts`：新增 lastSendSummary、inputDisplayMode 状态
4. `src/App.tsx`：focusedBotId → focusedInstanceId，传递给 UnifiedInput
5. `src/components/UnifiedInput.tsx`：重构 handleSend，消费返回值，草稿保护，发送目标 UI
6. `npm run build` 验证
7. git commit

---

## 实施完成记录（2026-06-21）

所有 6 个 Phase 已全部实施并通过 build + test 验证。

| Phase | 版本 | 状态 | 提交 |
|---|---|---|---|
| 1 | v3.3.0 | ✅ 完成 | d0ca4b3 |
| 2 | v3.4.0 | ✅ 完成 | 525d106 |
| 3 | v3.5.0 | ✅ 完成 | 9dc53b7 |
| 4 | v3.6.0 | ✅ 完成 | c26ca05 |
| 5 | v3.7.0 | ✅ 完成 | 357532b |
| 6 | v3.8.0 | ✅ 完成 | 5fd5561 |
| 补全 | v3.8.0 | ✅ 完成 | 版本号修正、F4 快捷键、自定义 adapter 测试按钮 |

### 验证结果

- `npm run build`：1751 模块，2.01s，零 TypeScript 错误
- `npx vitest run`：8/8 测试通过
- manifest 版本：3.8.0
- git 工作树：干净

### 额外补充项

- F4 快捷键：Cmd/Ctrl+Enter 发送全部、Cmd/Ctrl+Shift+Enter 发送当前窗口
- 自定义 adapter 测试按钮：Settings 中可测试 selector 是否匹配目标页面
- content script 新增 CHAT_HUB_TEST_SELECTORS 消息处理

### UI 修复（2026-06-21 实机测试后）

- `731da72`: 布局切换器从绝对定位改为 flex 行 → 占据空间与 ChatFrame 按钮不冲突
- `97bb7a3`: 改为浮动左上角（absolute left-3 top-3），60% opacity hover 100%，不消耗布局空间，窗口获得完整高度
