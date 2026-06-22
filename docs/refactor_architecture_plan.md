# Chrome ChatHub 重构设计方案

**版本**: 0.1  
**日期**: 2026-03-25  
**目标**: 在保留现有功能与交互体验的前提下，重构扩展的消息发送与站点适配架构，显著提升“多窗口稳定发送”的成功率、可观测性和可维护性。

---

## 0. 当前实施进展

截至 2026-03-25，下面这些底层改造已经落地到代码里：

- `Hub -> iframe` 发送协议已从无回执广播改成 `HELLO / ACK / RESULT / ERROR` 协议，且每个窗口有独立 session 状态。
- 后台脚本已改成基于内置站点和自定义站点动态注册 content script，而不是静态 `<all_urls>` 常驻注入。
- content script 的 ready 判定已不再等于“脚本加载成功”，而是等待真实输入节点出现，并在超时后回传 `READY_TIMEOUT`。
- 站点适配层已开始向“配置 + driver”双层结构迁移，`OpenAI / Gemini / ChatGLM / 豆包 / 千问` 已有独立 driver。
- DOM 引擎已支持候选选择器、作用域根节点、动作链打 `data-id`、按配置选择输入方式和上传策略，不再只接受单个字符串选择器。

这意味着当前主线已经从“补 patch”进入“可持续替换底层架构”的阶段。后续浏览器联调的重点，不再是看代码能否 build，而是逐站点验证：

- ready 探测是否可靠
- 文本注入是否真实生效
- 发送按钮是否被正确解锁与触发
- 失败是否能准确落到具体步骤

---

## 1. 背景与问题定义

当前项目已经具备完整产品形态，但“统一输入 -> 多窗口注入 -> 自动发送”这条主链路稳定性不足，典型问题包括：

- 底部输入栏显示已发送，但部分窗口没有收到消息
- 某些窗口填充了文本，但没有真正触发发送
- 某些站点偶发成功、偶发失败，缺少明确失败原因
- 用户无法知道是“页面未就绪”、“选择器失效”、“文件上传未完成”还是“发送按钮未激活”

这些问题并不是单一选择器失效导致的，而是当前架构层面缺少以下能力：

- 消息投递确认
- 每个窗口的就绪状态管理
- 每个站点的独立发送策略
- 发送过程的串行队列与重试机制
- 操作结果验证与回执
- 可视化调试与错误归因

---

## 2. 现状诊断

### 2.1 当前链路

现有发送流程如下：

1. 输入栏调用 `broadcastMessage`
2. 遍历页面上所有 `iframe`
3. 对每个 `iframe.contentWindow` 直接 `postMessage`
4. content script 收到消息后立刻查找输入框
5. 尝试填充文本 / 上传文件 / 点击按钮 / 模拟 Enter
6. 无回执地结束

涉及的核心文件：

- [src/components/UnifiedInput.tsx](/Users/jackdu/Documents/AGENT/chathub/src/components/UnifiedInput.tsx)
- [src/lib/broadcast.ts](/Users/jackdu/Documents/AGENT/chathub/src/lib/broadcast.ts)
- [src/content/index.ts](/Users/jackdu/Documents/AGENT/chathub/src/content/index.ts)

### 2.2 主要根因

#### R1. 发送是 fire-and-forget，没有确认机制

[src/lib/broadcast.ts](/Users/jackdu/Documents/AGENT/chathub/src/lib/broadcast.ts) 当前只是遍历所有 iframe 然后直接发送消息，没有：

- 请求 ID
- ACK
- 超时
- 成功/失败回执
- 单窗口状态记录

结果是 UI 认为“已经发出”，但实际上只是“尝试广播过”。

#### R2. iframe 是否 ready 没有被建模

[src/content/index.ts](/Users/jackdu/Documents/AGENT/chathub/src/content/index.ts) 中的 `currentAdapter` 是异步初始化的。若用户在 iframe 刚打开、适配器尚未完成初始化时发送消息，请求可能直接丢失或失败。

此外，当前没有以下状态：

- 页面是否加载完成
- 是否已识别到适配器
- 输入框是否可定位
- 用户是否已登录目标站点
- 站点是否正处于生成中、禁发中或上传中

#### R3. 同一个动作混合了“定位、注入、提交、验证”，且没有结果校验

当前 `handleUserMessage` 把所有操作串在一起，但没有显式步骤状态，也没有最终验证：

- 文本是否真的进入框内
- 文件是否真的被目标站点识别
- 提交按钮是否真正触发
- Enter 是否被站点监听
- 页面是否开始生成回复

这使得“半成功”无法区分。

#### R4. 站点差异过大，但实现仍以通用 DOM 脚本为主

不同 AI 站点在这些方面差异很大：

- 输入控件类型：`textarea`、`contenteditable`、ProseMirror、Lexical、Slate
- 提交触发方式：按钮点击、Enter、组合键、框架内部命令
- 文件接收方式：`paste`、`input[type=file]`、拖拽、隐藏上传组件
- 发送前约束：上传完成、按钮解锁、输入框聚焦、选区激活

目前只有少量站点特殊分支，整体仍然是“通用策略 + 少量补丁”。这对长期维护不够稳。

#### R5. 没有串行队列，用户快速发送时容易竞争

同一窗口在以下情境下很容易发生竞争：

- 上一条消息还在注入/上传中，下一条又来了
- 页面正在切换新会话
- 用户刷新窗口后立即再次发送

当前没有 per-frame queue，也没有 `busy` 状态。

#### R6. 缺少可观测性

现在多数错误只在控制台中输出。对于用户来说，不知道哪个窗口失败、失败在哪一步、是否值得重试。

---

## 3. 重构目标

### 3.1 必须保留

以下能力全部保留：

- 多窗口聚合展示
- 底部统一输入栏
- 同步模式 / 草稿模式
- 多文件上传
- 单窗口刷新、移除、聚焦
- 拖拽排序
- 提示词库
- 自定义站点适配器
- 自动选择器检测
- 现有整体 UI 风格

### 3.2 核心改造目标

重构后应满足：

- 发送动作必须有状态、有回执、有失败原因
- 每个窗口独立维护 ready / busy / error 状态
- 每个站点可以拥有独立驱动逻辑
- 相同请求在多窗口发送时可追踪每个窗口结果
- 失败可重试，且支持只重试失败窗口
- 调试时可以看到完整链路

### 3.3 非目标

本轮不做：

- 改成官方 API 聚合器
- 改变当前 iframe 产品形态
- 大规模重新设计视觉 UI
- 一次性重写全部功能后再上线

目标是渐进式替换，不中断现有功能。

---

## 3.4 参考项目启发

参考项目：

- [jackyr/simple-chat-hub-extension](https://github.com/jackyr/simple-chat-hub-extension)

基于该项目 2026-03-25 公开仓库页面、README 与自定义配置示例，我能确认的几点是：

- 它和我们一样走“聚合平台官网而不是走 API Key”的产品路线
- 它非常强调“先确保平台官网可访问、先完成登录，再从扩展中打开”
- 它支持大量内置平台，同时保留自定义配置能力
- 它公开给用户的自定义配置非常克制，核心字段仍然围绕 URL、输入框、发送按钮

对应来源：

- GitHub 仓库页 README：[simple-chat-hub-extension](https://github.com/jackyr/simple-chat-hub-extension)
- 自定义配置示例：[CUSTOM_CONFIG_EXAMPLE.md](https://github.com/jackyr/simple-chat-hub-extension/blob/main/CUSTOM_CONFIG_EXAMPLE.md)

需要说明的是：该公开仓库页面当前主要可见 README、变更记录、配置示例以及打包好的扩展压缩包，未能直接看到完整源码目录。因此下面的“借鉴结论”是基于其公开产品形态与使用表现做的工程推断。

### 借鉴结论 A. 稳定性优先于“万能自动化”

参考项目给人的最大感受不是“功能比我们多”，而是“支持范围清晰、行为更保守”。这通常意味着：

- 优先把高频平台做成强适配
- 对自定义平台保持有限能力，而不是默认承诺全自动稳定发送
- 对登录、网络、平台可达性这些前置条件做更明确约束

这和我们的重构方向一致：把“站点驱动”作为一等公民，而不是继续把所有站点都塞进同一套通用脚本。

### 借鉴结论 B. 内置平台应与自定义平台分层对待

参考项目的公开自定义配置示例非常简单，这反而说明它大概率把真正稳定的平台能力放在内置实现里，而不是完全依赖用户自配 selector。

因此我们的架构要明确分层：

- 内置平台：driver 强适配，提供 ready/submit/verify 全链路支持
- 自定义平台：generic selector driver，默认支持“能填就填、能发再发”
- 不满足条件时：优雅降级到草稿模式，而不是伪装成“发送成功”

### 借鉴结论 C. 前置状态必须被显式建模

参考项目 README 明确提示：

- 网络需正常访问平台官网
- 需要登录的平台先登录再打开

这背后本质上是把“平台可用性”视为发送链路的一部分，而不是发生失败后再猜。

所以我们的重构必须把这些状态变成 UI 和 Runtime 可见状态：

- 未登录
- 页面加载中
- 平台不可访问
- 输入框未就绪
- 可填充但不可自动提交

### 借鉴结论 D. 产品上看起来“稳定”，工程上往往依赖更强的状态回执

虽然无法直接查看它的源码实现，但从你实际使用反馈看，它的稳定性明显更好。这通常意味着它在下面几个点上做得更扎实：

- 对窗口是否 ready 有明确判断
- 对发送是否成功有更可靠的内部确认
- 对不同平台的发送动作不是完全共用一套逻辑
- 对失败场景有更保守的降级策略

这也进一步验证了我们本次重构的主方向是对的：先补协议、状态机、队列和 driver，再谈更多功能。

---

## 4. 目标架构

重构后的系统分为 5 层。

### 4.1 UI Layer

负责：

- 输入栏交互
- 发送批次状态展示
- 窗口状态标记
- 重试入口
- 调试面板入口

建议新增模块：

- `src/features/send/sendOrchestrator.ts`
- `src/features/frame/frameSessionStore.ts`
- `src/features/send/sendBatchStore.ts`

### 4.2 Frame Session Layer

为每个聊天窗口建立一个 `FrameSession`，它不是简单的 iframe 视图，而是一个“受控会话”。

每个 `FrameSession` 维护：

- `instanceId`
- `adapterId`
- `status`: `booting | ready | busy | degraded | error | unsupported`
- `capabilities`: `text`, `submit`, `files`
- `lastHeartbeatAt`
- `lastError`
- `currentCommandId`

作用：

- 发送前判断目标窗口是否 ready
- 显示单窗口状态
- 在窗口 reload 后重新握手

### 4.3 Hub Bridge Layer

仍然保留 `postMessage` 作为 iframe 通信通道，但升级为“协议化通信”。

#### 新消息协议

消息应统一带上：

- `protocolVersion`
- `messageId`
- `commandId`
- `instanceId`
- `type`
- `timestamp`
- `payload`

消息类型建议拆为：

- `FRAME_HELLO`
- `FRAME_READY`
- `FRAME_HEARTBEAT`
- `FRAME_STATUS_CHANGED`
- `COMMAND_PREPARE_MESSAGE`
- `COMMAND_ATTACH_FILES`
- `COMMAND_SET_TEXT`
- `COMMAND_SUBMIT`
- `COMMAND_EXECUTE_BATCH`
- `COMMAND_ACK`
- `COMMAND_RESULT`
- `COMMAND_ERROR`

#### 关键原则

- UI 发送命令后必须先收到 ACK
- Content script 执行完成后必须返回 RESULT
- 超时未返回时，Hub 标记为失败

### 4.4 Content Runtime Layer

content script 不再只有一个大文件，而是拆为受控运行时：

- `bridge`: 通信与协议解析
- `runtime`: 队列、状态机、错误捕获
- `driverRegistry`: 站点驱动注册表
- `domEngine`: 通用 DOM 操作库
- `verifiers`: 结果验证器

建议结构：

```text
src/content/
  bridge/
    protocol.ts
    frameBridge.ts
  runtime/
    frameRuntime.ts
    commandQueue.ts
    frameState.ts
  drivers/
    baseDriver.ts
    openaiDriver.ts
    claudeDriver.ts
    geminiDriver.ts
    deepseekDriver.ts
    genericSelectorDriver.ts
  dom/
    domLocator.ts
    domValueWriter.ts
    domSubmitter.ts
    domFileUploader.ts
    domVerifier.ts
  index.ts
```

### 4.5 Driver Layer

这是稳定性的关键。

每个站点驱动负责：

- 如何识别输入框
- 如何安全注入文本
- 如何上传文件
- 如何等待按钮可点击
- 如何触发发送
- 如何验证发送已生效

统一接口示例：

```ts
interface BotDriver {
  id: string;
  canHandle(location: Location): boolean;
  detectCapabilities(): Promise<DriverCapabilities>;
  waitUntilReady(signal?: AbortSignal): Promise<void>;
  setText(text: string): Promise<ActionResult>;
  attachFiles(files: UploadFile[]): Promise<ActionResult>;
  submit(): Promise<ActionResult>;
  verifySubmission(): Promise<ActionResult>;
}
```

策略分层建议：

- 第一层：官方内置驱动，面向高频站点做强适配
- 第二层：通用 selector 驱动，服务于自定义站点
- 第三层：降级策略，只做填充不自动发送

---

## 5. 发送链路重设计

### 5.1 现有问题

当前 `handleSend` 在 UI 侧只是调用广播并清空输入框，没有等待结果，也没有失败补偿。

### 5.2 新链路

#### Step 1. 创建发送批次

用户点击发送后，UI 创建 `SendBatch`：

- `batchId`
- `text`
- `files`
- `mode`: `sync | draft`
- `targets`: 目标 `instanceId[]`
- `createdAt`

#### Step 2. 过滤目标窗口

只向以下窗口派发：

- `ready`
- `degraded` 但允许尝试

跳过：

- `booting`
- `busy`
- `unsupported`

UI 明确展示“已跳过 N 个未就绪窗口”。

#### Step 3. 向每个窗口发送受控命令

命令不再是“原始 USER_MESSAGE”，而是：

- 先发 `COMMAND_EXECUTE_BATCH`
- frame 立即返回 `ACK`
- frame 内部排队执行
- 最终回传 `RESULT`

#### Step 4. 分步执行

一个窗口内部执行顺序固定为：

1. `waitUntilReady`
2. `attachFiles`
3. `setText`
4. `submit` 或 `skip submit`
5. `verify`

#### Step 5. 结果聚合

批次结果按窗口收集：

- success
- partial_success
- failed
- skipped

UI 可以提供：

- “全部成功”
- “2/6 成功，4 个失败”
- “只重试失败窗口”

---

## 6. 状态机设计

### 6.1 Frame 状态机

```text
booting -> ready
booting -> unsupported
booting -> error
ready -> busy
busy -> ready
busy -> degraded
busy -> error
error -> booting
degraded -> busy
degraded -> ready
```

### 6.2 Command 状态机

```text
created -> dispatched -> acked -> running -> succeeded
created -> dispatched -> timeout
acked -> running -> failed
acked -> running -> partial_success
```

### 6.3 UI 可见状态

每个聊天窗口顶部增加一个轻量状态标识：

- `Ready`
- `Sending`
- `Drafted`
- `Upload`
- `Retry`
- `Error`

这能大幅降低“看起来没反应”的困惑。

---

## 7. DOM 操作策略重构

### 7.1 定位逻辑从一次性 querySelector 改为“可重试定位器”

替换当前的单次：

- `document.querySelector(selector)`

改成：

- 多轮查找
- 等待元素可见
- 等待元素可编辑
- 等待元素脱离 disabled 状态
- 必要时 MutationObserver 监听

建议封装：

- `waitForElement`
- `waitForEditableInput`
- `waitForSubmitEnabled`
- `waitForUploadCompleted`

### 7.2 文本注入从“强写 value”改为分站点策略

优先级建议：

1. driver 自定义策略
2. 原生 setter
3. `execCommand('insertText')`
4. paste 事件
5. 安全降级策略

且每次注入后必须验证：

- DOM 中是否存在目标文本
- 框架内部状态是否被触发
- 发送按钮是否从 disabled 变为 enabled

### 7.3 提交动作必须带验证

不能再只做：

- 找到按钮
- click
- 结束

而要验证至少一个结果：

- 输入框被清空
- 按钮进入 loading / disabled
- 页面生成了新的用户消息节点
- 页面出现“停止生成”之类状态

如果验证失败，则 fallback 到备用策略。

### 7.4 文件上传必须拆成独立动作

当前文件上传与文本注入混在一起，建议拆成独立 command step：

- 先上传
- 等上传完成
- 再注入文本
- 再发送

这样更适合 Gemini、ChatGLM 一类站点。

---

## 8. 自定义适配器重构

现有自定义适配器只保存简单选择器，后续建议升级为两层配置：

### 8.1 AdapterDefinition

用户配置：

- `id`
- `name`
- `url`
- `inputSelector`
- `submitSelector`
- `fileInputSelector?`
- `submitMode`: `button | enter | auto`
- `supportsFiles`

### 8.2 RuntimeProfile

系统自动探测得出：

- 当前命中的真实输入节点
- 当前提交节点
- 可编辑类型
- 站点能力
- 最近一次检测置信度

这样可以把“用户静态配置”和“运行时动态发现”分开。

---

## 9. 可观测性设计

### 9.1 调试面板

建议新增一个开发者模式调试抽屉，展示：

- 当前激活窗口列表
- 每个窗口的 ready 状态
- 最近 20 条命令
- 每条命令的步骤耗时
- 最终成功/失败原因

### 9.2 错误分型

统一错误码：

- `ADAPTER_NOT_FOUND`
- `FRAME_NOT_READY`
- `INPUT_NOT_FOUND`
- `INPUT_NOT_EDITABLE`
- `UPLOAD_NOT_SUPPORTED`
- `UPLOAD_TIMEOUT`
- `SUBMIT_BUTTON_NOT_FOUND`
- `SUBMIT_NOT_ENABLED`
- `SUBMISSION_NOT_VERIFIED`
- `COMMAND_TIMEOUT`

这样后续才能真正统计稳定性。

### 9.3 指标

建议至少记录：

- 每站点发送成功率
- 平均准备时间
- 平均提交时间
- 文件上传成功率
- 失败原因分布

---

## 10. 建议文件结构

```text
src/
  app/
    store/
  features/
    frame/
      frameSessionStore.ts
      frameSessionTypes.ts
      frameSessionSelectors.ts
    send/
      sendBatchStore.ts
      sendOrchestrator.ts
      sendTypes.ts
    adapters/
      adapterRegistry.ts
      adapterStorage.ts
  content/
    bridge/
      protocol.ts
      frameBridge.ts
    runtime/
      frameRuntime.ts
      commandQueue.ts
      frameState.ts
      errorCodes.ts
    drivers/
      baseDriver.ts
      genericSelectorDriver.ts
      openaiDriver.ts
      claudeDriver.ts
      geminiDriver.ts
      deepseekDriver.ts
      chatglmDriver.ts
    dom/
      waitForElement.ts
      valueWriter.ts
      submitter.ts
      uploader.ts
      verifier.ts
    index.ts
```

---

## 11. 渐进式重构路线

不建议一次性推翻重写，建议按 4 个阶段执行。

### Phase 1. 通信协议化

目标：

- 保留现有 UI 和发送功能
- 引入 request/ack/result 协议
- 增加 frame ready 状态

产出：

- `FrameSessionStore`
- `SendBatchStore`
- `frameBridge`
- `frameRuntime` 骨架

完成标准：

- 每次发送能看到每个窗口的 success/fail/timeout

### Phase 2. 队列与状态机

目标：

- 每个 frame 串行执行命令
- 避免并发竞争
- UI 显示窗口状态

完成标准：

- 快速连续发送时不再出现明显串扰

### Phase 3. 驱动化改造

目标：

- 把高频站点从“大一统逻辑”拆到独立 driver
- 优先覆盖 OpenAI、Claude、Gemini、DeepSeek、ChatGLM

完成标准：

- 高频站点稳定性显著提升
- 自定义站点继续走 generic driver

### Phase 4. 验证、重试、调试面板

目标：

- 引入操作结果验证
- 提供失败重试与诊断能力

完成标准：

- 用户知道失败在哪一步
- 可单独重试失败窗口

---

## 12. 优先级建议

如果只做最关键的 20%，优先顺序应是：

1. `通信协议 + ACK/RESULT`
2. `Frame ready/busy 状态`
3. `per-frame command queue`
4. `高频站点 driver 化`
5. `结果验证`
6. `调试面板`

其中前 4 项已经能解决大部分“一个发了一个没发”“看起来发了但其实没发”的问题。

---

## 13. 我对这次重构的建议结论

这次不要再继续沿着“补选择器、补延迟、补 if 判断”的路线修了。

更合适的方向是：

- 保留现有产品形态
- 把“发送”从一个无确认的 DOM 脚本动作，升级成一个可追踪的命令系统
- 把“适配器”从静态 selector 配置，升级成“驱动 + 通用降级”的双层体系
- 把“控制台日志”升级成面向用户和开发者都可理解的状态反馈

这样才能从“偶尔能用”变成“可持续维护、可持续迭代”的扩展架构。
