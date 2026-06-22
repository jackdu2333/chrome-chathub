import {
  CommandErrorMessage,
  CommandResultMessage,
  CONTENT_MESSAGE_SOURCE,
  ContentToHubMessage,
  ExecuteCommandMessage,
  HUB_MESSAGE_SOURCE,
  HubToContentMessage,
  isContentToHubMessage,
} from './protocol';
import { findInstanceIdBySource, getFrameWindow, frameRegistry } from './frameRegistry';
import { useFrameSessionStore } from './useFrameSessionStore';

interface PendingCommand {
  instanceId: string;
  resolve: (result: CommandResultMessage['payload']) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

const pendingCommands = new Map<string, PendingCommand>();

function postToFrame(instanceId: string, message: HubToContentMessage) {
  const frameWindow = getFrameWindow(instanceId);
  if (!frameWindow) {
    throw new Error('FRAME_NOT_AVAILABLE');
  }

  // 安全加固：用 iframe 的 origin 替代通配符 '*'
  const frame = frameRegistry.get(instanceId);
  let targetOrigin = '*';
  if (frame?.src) {
    try {
      targetOrigin = new URL(frame.src).origin;
    } catch {
      // URL 解析失败时回退到通配符（如 src 尚未设置）
    }
  }
  frameWindow.postMessage(message, targetOrigin);
}

const FRAME_HELLO_RETRY_DELAYS = [0, 2000, 5000];
const FRAME_HELLO_TIMEOUT = 8000;

// v1.2: hello 自动重试 — 发送 hello 并在超时后自动重试
const helloRetryTimers = new Map<string, ReturnType<typeof setTimeout>[]>();

export function requestFrameHello(instanceId: string) {
  // Clear any existing retry timers
  const existing = helloRetryTimers.get(instanceId);
  if (existing) {
    existing.forEach(clearTimeout);
  }

  const timers: ReturnType<typeof setTimeout>[] = [];
  const store = useFrameSessionStore.getState();

  FRAME_HELLO_RETRY_DELAYS.forEach((delay, attempt) => {
    const timer = setTimeout(() => {
      try {
        postToFrame(instanceId, {
          source: HUB_MESSAGE_SOURCE,
          type: 'FRAME_HELLO',
          payload: { timestamp: Date.now() },
        });
        if (attempt > 0) {
          store.incrementRetry(instanceId);
        }
      } catch {
        // iframe may still be booting
      }
    }, delay);
    timers.push(timer);
  });

  // Timeout: if still content-waiting after all retries, mark timeout
  const timeoutTimer = setTimeout(() => {
    const session = useFrameSessionStore.getState().sessions[instanceId];
    if (session && session.loadPhase === 'content-waiting') {
      useFrameSessionStore.getState().markLoadPhase(instanceId, 'content-timeout');
    }
  }, FRAME_HELLO_TIMEOUT);
  timers.push(timeoutTimer);

  helloRetryTimers.set(instanceId, timers);
}

// v1.2: 发送 selector 探测命令
export async function probeSelectors(instanceId: string, timeoutMs = 10000): Promise<{
  readyFound: boolean;
  inputFound: boolean;
  submitFound: boolean;
} | null> {
  try {
    const result = await new Promise<{ readyFound: boolean; inputFound: boolean; submitFound: boolean }>((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingProbes.delete(instanceId);
        reject(new Error('PROBE_TIMEOUT'));
      }, timeoutMs);

      pendingProbes.set(instanceId, { resolve, reject, timer });

      postToFrame(instanceId, {
        source: HUB_MESSAGE_SOURCE,
        type: 'PROBE_SELECTORS',
        payload: { timestamp: Date.now() },
      });
    });

    // Update health check in store
    useFrameSessionStore.getState().markHealthCheck(instanceId, {
      readySelectorFound: result.readyFound,
      inputSelectorFound: result.inputFound,
      submitSelectorFound: result.submitFound,
    });

    // If input not found, mark selector-error
    if (!result.inputFound) {
      useFrameSessionStore.getState().markLoadPhase(instanceId, 'selector-error');
    }

    return result;
  } catch {
    return null;
  }
}

interface PendingProbe {
  resolve: (result: { readyFound: boolean; inputFound: boolean; submitFound: boolean }) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}
const pendingProbes = new Map<string, PendingProbe>();

// Clear retry timers when content script connects
export function clearHelloRetry(instanceId: string) {
  const timers = helloRetryTimers.get(instanceId);
  if (timers) {
    timers.forEach(clearTimeout);
    helloRetryTimers.delete(instanceId);
  }
}

export async function sendCommandToFrame(input: {
  instanceId: string;
  text: string;
  autoSubmit: boolean;
  files?: ExecuteCommandMessage['payload']['files'];
  timeoutMs?: number;
}) {
  const { instanceId, text, autoSubmit, files, timeoutMs = 20000 } = input;
  const commandId = crypto.randomUUID();

  const result = await new Promise<CommandResultMessage['payload']>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingCommands.delete(commandId);
      useFrameSessionStore.getState().markCommandResult(instanceId, commandId, false, 'COMMAND_TIMEOUT');
      reject(new Error('COMMAND_TIMEOUT'));
    }, timeoutMs);

    pendingCommands.set(commandId, {
      instanceId,
      resolve,
      reject,
      timeoutId,
    });

    postToFrame(instanceId, {
      source: HUB_MESSAGE_SOURCE,
      type: 'EXECUTE_COMMAND',
      payload: {
        commandId,
        text,
        autoSubmit,
        files,
        timestamp: Date.now(),
      },
    });
  });

  return {
    commandId,
    result,
  };
}

export async function sendMessageBatch(input: {
  instanceIds: string[];
  text: string;
  autoSubmit: boolean;
  files?: ExecuteCommandMessage['payload']['files'];
}) {
  const uniqueInstanceIds = Array.from(new Set(input.instanceIds));

  const results = await Promise.allSettled(
    uniqueInstanceIds.map(async (instanceId) => {
      requestFrameHello(instanceId);
      return sendCommandToFrame({
        instanceId,
        text: input.text,
        autoSubmit: input.autoSubmit,
        files: input.files,
      });
    })
  );

  return results.map((entry, index) => ({
    instanceId: uniqueInstanceIds[index],
    success: entry.status === 'fulfilled' ? entry.value.result.success : false,
    error:
      entry.status === 'fulfilled'
        ? entry.value.result.error
        : entry.reason instanceof Error
          ? entry.reason.message
          : 'UNKNOWN_ERROR',
  }));
}

export function handleContentMessageEvent(event: MessageEvent) {
  if (!isContentToHubMessage(event.data)) {
    return;
  }

  const instanceId = findInstanceIdBySource(event.source);
  if (!instanceId) {
    console.warn('[FrameBridge] ❌ Cannot find instanceId for message source. Event origin:', event.origin, 'Message:', event.data);
    // Debug: log all registered frames
    for (const [id, iframe] of frameRegistry.entries()) {
      console.log('[FrameBridge] Registered frame:', id, iframe.contentWindow === event.source ? '(MATCH)' : '(no match)');
    }
    return;
  }

  const store = useFrameSessionStore.getState();
  const message = event.data;

  switch (message.type) {
    case 'FRAME_READY':
    case 'FRAME_STATUS':
      clearHelloRetry(instanceId);
      store.updateRuntimeStatus(instanceId, {
        status: message.payload.status,
        adapterId: message.payload.adapterId,
        botName: message.payload.adapterName,
        url: message.payload.url,
        capabilities: message.payload.capabilities,
        reason: message.payload.reason,
        detail: message.payload.detail,
        timestamp: message.payload.timestamp,
      });
      return;
    case 'COMMAND_ACK':
      store.markCommandAck(instanceId, message.payload.commandId, undefined);
      return;
    case 'COMMAND_RESULT':
      settlePendingResult(instanceId, message);
      return;
    case 'COMMAND_ERROR':
      settlePendingError(instanceId, message);
      return;
    case 'PROBE_RESULT': {
      const probe = pendingProbes.get(instanceId);
      if (probe) {
        clearTimeout(probe.timer);
        pendingProbes.delete(instanceId);
        probe.resolve({
          readyFound: message.payload.readyFound,
          inputFound: message.payload.inputFound,
          submitFound: message.payload.submitFound,
        });
      }
      return;
    }
    default:
      return;
  }
}

function settlePendingResult(instanceId: string, message: CommandResultMessage) {
  const pending = pendingCommands.get(message.payload.commandId);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timeoutId);
  pendingCommands.delete(message.payload.commandId);

  useFrameSessionStore
    .getState()
    .markCommandResult(
      instanceId,
      message.payload.commandId,
      message.payload.success,
      message.payload.error,
      message.payload.detail
    );

  pending.resolve(message.payload);
}

function settlePendingError(instanceId: string, message: CommandErrorMessage) {
  const pending = pendingCommands.get(message.payload.commandId);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timeoutId);
  pendingCommands.delete(message.payload.commandId);

  useFrameSessionStore
    .getState()
    .markCommandResult(
      instanceId,
      message.payload.commandId,
      false,
      message.payload.error,
      message.payload.detail
    );

  pending.reject(new Error(message.payload.error));
}

export function isFrameBridgeMessage(value: unknown): value is ContentToHubMessage {
  return isContentToHubMessage(value);
}

export function getFrameBridgeSource(instanceId: string) {
  return getFrameWindow(instanceId);
}

export { CONTENT_MESSAGE_SOURCE };
