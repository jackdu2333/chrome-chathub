import { describe, it, expect } from 'vitest';
import type { SendTargetMode } from '../../store/types';

// 纯函数测试：验证发送目标解析逻辑（不依赖 React/Zustand）
function resolveTargetInstanceIds(
  mode: SendTargetMode,
  activeInstanceIds: string[],
  focusedInstanceId: string | null,
  selectedTargetInstanceIds: string[],
): string[] {
  if (mode === 'all') return activeInstanceIds;
  if (mode === 'focused') return focusedInstanceId ? [focusedInstanceId] : [];
  return selectedTargetInstanceIds;
}

describe('resolveTargetInstanceIds', () => {
  const allIds = ['inst-a', 'inst-b', 'inst-c'];

  it('all 模式返回全部 active instance', () => {
    expect(resolveTargetInstanceIds('all', allIds, null, [])).toEqual(allIds);
  });

  it('focused 模式只返回聚焦的 instance', () => {
    expect(resolveTargetInstanceIds('focused', allIds, 'inst-b', [])).toEqual(['inst-b']);
  });

  it('focused 模式无聚焦时返回空数组', () => {
    expect(resolveTargetInstanceIds('focused', allIds, null, [])).toEqual([]);
  });

  it('selected 模式返回勾选的 instances', () => {
    expect(resolveTargetInstanceIds('selected', allIds, null, ['inst-a', 'inst-c']))
      .toEqual(['inst-a', 'inst-c']);
  });

  it('selected 模式无勾选时返回空数组', () => {
    expect(resolveTargetInstanceIds('selected', allIds, null, [])).toEqual([]);
  });
});

// 发送结果摘要计算
describe('SendResultSummary', () => {
  function summarize(results: { success: boolean }[]) {
    const successCount = results.filter(r => r.success).length;
    return {
      total: results.length,
      successCount,
      failedCount: results.length - successCount,
      allSucceeded: successCount === results.length,
    };
  }

  it('全部成功时 allSucceeded = true', () => {
    const s = summarize([{ success: true }, { success: true }]);
    expect(s.allSucceeded).toBe(true);
    expect(s.failedCount).toBe(0);
  });

  it('部分失败时 allSucceeded = false', () => {
    const s = summarize([{ success: true }, { success: false }]);
    expect(s.allSucceeded).toBe(false);
    expect(s.failedCount).toBe(1);
  });

  it('全部失败时 allSucceeded = false', () => {
    const s = summarize([{ success: false }, { success: false }]);
    expect(s.allSucceeded).toBe(false);
    expect(s.failedCount).toBe(2);
  });
});
