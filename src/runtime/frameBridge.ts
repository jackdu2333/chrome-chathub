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

export function requestFrameHello(instanceId: string) {
  try {
    postToFrame(instanceId, {
      source: HUB_MESSAGE_SOURCE,
      type: 'FRAME_HELLO',
      payload: {
        timestamp: Date.now(),
      },
    });
  } catch {
    // Ignore. The iframe may still be booting or navigating.
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
