import { describe, it, expect, beforeEach } from 'vitest';
import { useFrameSessionStore } from '../useFrameSessionStore';

describe('useFrameSessionStore — loadPhase reducer', () => {
  const ID = 'test-instance';

  beforeEach(() => {
    useFrameSessionStore.setState({ sessions: {} });
    useFrameSessionStore.getState().ensureSession({
      instanceId: ID,
      adapterId: 'test-adapter',
      botName: 'Test',
      url: 'https://test.com',
    });
  });

  it('ensureSession 初始 phase 为 iframe-loading', () => {
    const session = useFrameSessionStore.getState().sessions[ID];
    expect(session?.loadPhase).toBe('iframe-loading');
    expect(session?.status).toBe('booting');
    expect(session?.health.iframeLoaded).toBe(false);
  });

  it('markIframeLoaded → phase=iframe-loaded, health.iframeLoaded=true', () => {
    useFrameSessionStore.getState().markIframeLoaded(ID);
    const session = useFrameSessionStore.getState().sessions[ID];
    expect(session?.loadPhase).toBe('iframe-loaded');
    expect(session?.health.iframeLoaded).toBe(true);
    expect(session?.iframeLoadedAt).toBeDefined();
  });

  it('markLoadPhase 直接设置任意 phase', () => {
    useFrameSessionStore.getState().markLoadPhase(ID, 'content-waiting');
    expect(useFrameSessionStore.getState().sessions[ID]?.loadPhase).toBe('content-waiting');

    useFrameSessionStore.getState().markLoadPhase(ID, 'content-connected');
    expect(useFrameSessionStore.getState().sessions[ID]?.loadPhase).toBe('content-connected');

    useFrameSessionStore.getState().markLoadPhase(ID, 'adapter-matched');
    expect(useFrameSessionStore.getState().sessions[ID]?.loadPhase).toBe('adapter-matched');

    useFrameSessionStore.getState().markLoadPhase(ID, 'dom-checking');
    expect(useFrameSessionStore.getState().sessions[ID]?.loadPhase).toBe('dom-checking');

    useFrameSessionStore.getState().markLoadPhase(ID, 'interactive-ready');
    expect(useFrameSessionStore.getState().sessions[ID]?.loadPhase).toBe('interactive-ready');
  });

  it('markHealthCheck 合并健康检查结果', () => {
    useFrameSessionStore.getState().markHealthCheck(ID, {
      readySelectorFound: true,
      inputSelectorFound: true,
      submitSelectorFound: false,
    });
    const health = useFrameSessionStore.getState().sessions[ID]?.health;
    expect(health?.readySelectorFound).toBe(true);
    expect(health?.inputSelectorFound).toBe(true);
    expect(health?.submitSelectorFound).toBe(false);
    expect(health?.lastCheckedAt).toBeDefined();
  });

  it('markHealthCheck 增量更新不覆盖已有字段', () => {
    useFrameSessionStore.getState().markHealthCheck(ID, {
      iframeLoaded: true,
      contentConnected: true,
    });
    useFrameSessionStore.getState().markHealthCheck(ID, {
      readySelectorFound: true,
    });
    const health = useFrameSessionStore.getState().sessions[ID]?.health;
    expect(health?.iframeLoaded).toBe(true);
    expect(health?.contentConnected).toBe(true);
    expect(health?.readySelectorFound).toBe(true);
  });

  it('updateRuntimeStatus: status=ready → phase=interactive-ready', () => {
    useFrameSessionStore.getState().updateRuntimeStatus(ID, {
      status: 'ready',
      adapterId: 'openai',
      botName: 'ChatGPT',
      url: 'https://chatgpt.com',
      capabilities: { text: true, submit: true, files: false },
      timestamp: Date.now(),
    });
    const session = useFrameSessionStore.getState().sessions[ID];
    expect(session?.loadPhase).toBe('interactive-ready');
    expect(session?.status).toBe('ready');
    expect(session?.health.contentConnected).toBe(true);
    expect(session?.health.adapterMatched).toBe(true);
  });

  it('updateRuntimeStatus: status=error → phase=failed', () => {
    useFrameSessionStore.getState().updateRuntimeStatus(ID, {
      status: 'error',
      timestamp: Date.now(),
      reason: 'FRAME_READY_TIMEOUT',
    });
    const session = useFrameSessionStore.getState().sessions[ID];
    expect(session?.loadPhase).toBe('failed');
    expect(session?.status).toBe('error');
    expect(session?.lastError).toBe('FRAME_READY_TIMEOUT');
  });

  it('updateRuntimeStatus: status=error + GEMINI_EMBED_LOGIN_REQUIRED → phase=failed（error 优先于 reason）', () => {
    // 当前 updateRuntimeStatus 逻辑：status=error 匹配后直接 failed，
    // GEMINI_EMBED_LOGIN_REQUIRED 只在 status 非 ready/error/unsupported 时生效
    useFrameSessionStore.getState().updateRuntimeStatus(ID, {
      status: 'error',
      timestamp: Date.now(),
      reason: 'GEMINI_EMBED_LOGIN_REQUIRED',
    });
    const session = useFrameSessionStore.getState().sessions[ID];
    expect(session?.loadPhase).toBe('failed');
    expect(session?.lastError).toBe('GEMINI_EMBED_LOGIN_REQUIRED');
  });

  it('updateRuntimeStatus: status=busy + GEMINI_EMBED_LOGIN_REQUIRED → phase=login-required', () => {
    // reason 判断只在 status 非 ready/error/unsupported 时生效
    useFrameSessionStore.getState().updateRuntimeStatus(ID, {
      status: 'busy',
      timestamp: Date.now(),
      reason: 'GEMINI_EMBED_LOGIN_REQUIRED',
    });
    const session = useFrameSessionStore.getState().sessions[ID];
    expect(session?.loadPhase).toBe('login-required');
  });

  it('updateRuntimeStatus: status=unsupported → phase=unsupported', () => {
    useFrameSessionStore.getState().updateRuntimeStatus(ID, {
      status: 'unsupported',
      timestamp: Date.now(),
    });
    expect(useFrameSessionStore.getState().sessions[ID]?.loadPhase).toBe('unsupported');
  });

  it('markBooting 不重置 loadPhase', () => {
    useFrameSessionStore.getState().markLoadPhase(ID, 'content-timeout');
    useFrameSessionStore.getState().markBooting(ID);
    const session = useFrameSessionStore.getState().sessions[ID];
    expect(session?.status).toBe('booting');
    // loadPhase should remain unchanged
    expect(session?.loadPhase).toBe('content-timeout');
  });

  it('完整加载流程 phase 转换', () => {
    // 1. iframe-loading (initial)
    expect(useFrameSessionStore.getState().sessions[ID]?.loadPhase).toBe('iframe-loading');

    // 2. iframe-loaded
    useFrameSessionStore.getState().markIframeLoaded(ID);
    expect(useFrameSessionStore.getState().sessions[ID]?.loadPhase).toBe('iframe-loaded');

    // 3. content-waiting (ChatFrame onLoad sets this)
    useFrameSessionStore.getState().markLoadPhase(ID, 'content-waiting');
    expect(useFrameSessionStore.getState().sessions[ID]?.loadPhase).toBe('content-waiting');

    // 4. content-connected + adapter-matched (via updateRuntimeStatus)
    useFrameSessionStore.getState().updateRuntimeStatus(ID, {
      status: 'ready',
      adapterId: 'claude',
      botName: 'Claude',
      url: 'https://claude.ai',
      capabilities: { text: true, submit: true, files: false },
      timestamp: Date.now(),
    });
    const session = useFrameSessionStore.getState().sessions[ID];
    expect(session?.loadPhase).toBe('interactive-ready');
    expect(session?.health.contentConnected).toBe(true);
    expect(session?.health.adapterMatched).toBe(true);
  });

  it('不存在的 instanceId 操作不报错', () => {
    useFrameSessionStore.getState().markLoadPhase('nonexistent', 'failed');
    useFrameSessionStore.getState().markIframeLoaded('nonexistent');
    useFrameSessionStore.getState().markBooting('nonexistent');
    useFrameSessionStore.getState().markHealthCheck('nonexistent', { iframeLoaded: true });
    // Should not throw, sessions unchanged
    expect(useFrameSessionStore.getState().sessions['nonexistent']).toBeUndefined();
  });
});
