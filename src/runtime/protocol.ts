export const HUB_MESSAGE_SOURCE = 'chathub-hub';
export const CONTENT_MESSAGE_SOURCE = 'chathub-content';

export type FrameStatus = 'booting' | 'ready' | 'busy' | 'error' | 'unsupported';

export interface UploadPayload {
  name: string;
  type: string;
  data: string;
}

export interface DriverCapabilities {
  text: boolean;
  submit: boolean;
  files: boolean;
}

export interface FrameHelloMessage {
  source: typeof HUB_MESSAGE_SOURCE;
  type: 'FRAME_HELLO';
  payload: {
    timestamp: number;
  };
}

export interface ExecuteCommandMessage {
  source: typeof HUB_MESSAGE_SOURCE;
  type: 'EXECUTE_COMMAND';
  payload: {
    commandId: string;
    text: string;
    autoSubmit: boolean;
    files?: UploadPayload[];
    timestamp: number;
  };
}

export type HubToContentMessage = FrameHelloMessage | ExecuteCommandMessage;

export interface FrameStatusMessage {
  source: typeof CONTENT_MESSAGE_SOURCE;
  type: 'FRAME_STATUS';
  payload: {
    status: FrameStatus;
    adapterId?: string;
    adapterName?: string;
    url: string;
    capabilities: DriverCapabilities;
    reason?: string;
    detail?: string;
    timestamp: number;
  };
}

export interface FrameReadyMessage {
  source: typeof CONTENT_MESSAGE_SOURCE;
  type: 'FRAME_READY';
  payload: FrameStatusMessage['payload'];
}

export interface CommandAckMessage {
  source: typeof CONTENT_MESSAGE_SOURCE;
  type: 'COMMAND_ACK';
  payload: {
    commandId: string;
    timestamp: number;
  };
}

export interface CommandResultMessage {
  source: typeof CONTENT_MESSAGE_SOURCE;
  type: 'COMMAND_RESULT';
  payload: {
    commandId: string;
    success: boolean;
    error?: string;
    detail?: string;
    timestamp: number;
  };
}

export interface CommandErrorMessage {
  source: typeof CONTENT_MESSAGE_SOURCE;
  type: 'COMMAND_ERROR';
  payload: {
    commandId: string;
    error: string;
    detail?: string;
    timestamp: number;
  };
}

export type ContentToHubMessage =
  | FrameStatusMessage
  | FrameReadyMessage
  | CommandAckMessage
  | CommandResultMessage
  | CommandErrorMessage;

export function isHubToContentMessage(value: unknown): value is HubToContentMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as { source?: string; type?: string };
  return (
    candidate.source === HUB_MESSAGE_SOURCE &&
    (candidate.type === 'FRAME_HELLO' || candidate.type === 'EXECUTE_COMMAND')
  );
}

export function isContentToHubMessage(value: unknown): value is ContentToHubMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as { source?: string; type?: string };
  return (
    candidate.source === CONTENT_MESSAGE_SOURCE &&
    [
      'FRAME_STATUS',
      'FRAME_READY',
      'COMMAND_ACK',
      'COMMAND_RESULT',
      'COMMAND_ERROR',
    ].includes(candidate.type ?? '')
  );
}

// ============================================
// v1.2: 窗口加载阶段状态机
// ============================================

export type FrameLoadPhase =
  | 'iframe-loading'
  | 'iframe-loaded'
  | 'content-waiting'
  | 'content-connected'
  | 'adapter-matching'
  | 'adapter-matched'
  | 'dom-checking'
  | 'interactive-ready'
  | 'login-required'
  | 'permission-missing'
  | 'content-timeout'
  | 'adapter-not-found'
  | 'selector-error'
  | 'unsupported'
  | 'failed';

export const FRAME_LOAD_PHASE_LABELS: Record<FrameLoadPhase, string> = {
  'iframe-loading': '页面加载中',
  'iframe-loaded': '页面已加载',
  'content-waiting': '脚本连接中',
  'content-connected': '脚本已连接',
  'adapter-matching': '识别平台中',
  'adapter-matched': '平台已识别',
  'dom-checking': '检测输入框',
  'interactive-ready': '已就绪',
  'login-required': '需登录',
  'permission-missing': '缺少站点权限',
  'content-timeout': '脚本连接超时',
  'adapter-not-found': '未匹配平台',
  'selector-error': '选择器失效',
  'unsupported': '暂不支持',
  'failed': '加载失败',
};

// 健康检查结果
export interface FrameHealthCheck {
  iframeLoaded: boolean;
  contentConnected: boolean;
  adapterMatched: boolean;
  readySelectorFound?: boolean;
  inputSelectorFound?: boolean;
  submitSelectorFound?: boolean;
  loginRequired?: boolean;
  permissionMissing?: boolean;
  lastCheckedAt?: number;
}
