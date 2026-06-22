import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock frameRegistry
const mockPostMessage = vi.fn();
vi.mock('../frameRegistry', () => ({
  getFrameWindow: vi.fn(() => ({ postMessage: mockPostMessage })),
  findInstanceIdBySource: vi.fn(() => 'test-instance'),
  frameRegistry: new Map(),
}));

import { requestFrameHello, clearHelloRetry } from '../frameBridge';
import { useFrameSessionStore } from '../useFrameSessionStore';

describe('frameBridge — hello retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPostMessage.mockClear();
    // Reset store
    useFrameSessionStore.setState({ sessions: {} });
    // Ensure session exists with content-waiting phase
    useFrameSessionStore.getState().ensureSession({
      instanceId: 'test-instance',
      adapterId: 'test-adapter',
      botName: 'Test',
      url: 'https://test.com',
    });
    useFrameSessionStore.getState().markIframeLoaded('test-instance');
    useFrameSessionStore.getState().markLoadPhase('test-instance', 'content-waiting');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('发送 3 次 hello（delay 0, 2000, 5000）', () => {
    requestFrameHello('test-instance');

    // delay=0: fires immediately
    vi.advanceTimersByTime(0);
    expect(mockPostMessage).toHaveBeenCalledTimes(1);

    // delay=2000
    vi.advanceTimersByTime(2000);
    expect(mockPostMessage).toHaveBeenCalledTimes(2);

    // delay=5000
    vi.advanceTimersByTime(3000);
    expect(mockPostMessage).toHaveBeenCalledTimes(3);
  });

  it('超时后标记 content-timeout', () => {
    requestFrameHello('test-instance');

    // Phase should still be content-waiting
    expect(
      useFrameSessionStore.getState().sessions['test-instance']?.loadPhase
    ).toBe('content-waiting');

    // Advance past timeout (8000ms)
    vi.advanceTimersByTime(8000);

    expect(
      useFrameSessionStore.getState().sessions['test-instance']?.loadPhase
    ).toBe('content-timeout');
  });

  it('clearHelloRetry 清除计时器', () => {
    requestFrameHello('test-instance');

    // First hello fires immediately
    vi.advanceTimersByTime(0);
    expect(mockPostMessage).toHaveBeenCalledTimes(1);

    // Clear retries before 2nd attempt
    clearHelloRetry('test-instance');

    // Advance past all remaining delays + timeout
    vi.advanceTimersByTime(10000);

    // Should still be only 1 call (no more retries)
    expect(mockPostMessage).toHaveBeenCalledTimes(1);

    // Phase should NOT be content-timeout (timer was cleared)
    expect(
      useFrameSessionStore.getState().sessions['test-instance']?.loadPhase
    ).toBe('content-waiting');
  });

  it('重试时 incrementRetry 被调用', () => {
    requestFrameHello('test-instance');

    const initialRetryCount =
      useFrameSessionStore.getState().sessions['test-instance']?.retryCount ?? 0;

    // delay=0 (first attempt, no increment)
    vi.advanceTimersByTime(0);
    expect(
      useFrameSessionStore.getState().sessions['test-instance']?.retryCount
    ).toBe(initialRetryCount);

    // delay=2000 (second attempt, increment)
    vi.advanceTimersByTime(2000);
    expect(
      useFrameSessionStore.getState().sessions['test-instance']?.retryCount
    ).toBe(initialRetryCount + 1);

    // delay=5000 (third attempt, increment again)
    vi.advanceTimersByTime(3000);
    expect(
      useFrameSessionStore.getState().sessions['test-instance']?.retryCount
    ).toBe(initialRetryCount + 2);
  });
});
