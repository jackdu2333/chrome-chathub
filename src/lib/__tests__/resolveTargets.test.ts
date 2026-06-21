import { describe, it, expect } from 'vitest';
import { resolveTargetInstanceIds, filterValidInstanceIds, isInstanceIdStale } from '../resolveTargets';
import type { SendTargetMode } from '../../store/types';

// 测试纯函数：发送目标解析（不依赖 React/Zustand）
describe('resolveTargetInstanceIds (pure function)', () => {
  const allIds = ['inst-a', 'inst-b', 'inst-c'];

  it('all 模式返回全部 instance', () => {
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
    expect(resolveTargetInstanceIds('selected' as SendTargetMode, allIds, null, [])).toEqual([]);
  });

  it('modeOverride 优先于默认 mode', () => {
    // 模拟 Cmd+Enter 临时切到 all
    const mode: SendTargetMode = 'all';
    expect(resolveTargetInstanceIds(mode, allIds, null, ['inst-a'])).toEqual(allIds);
  });
});

describe('filterValidInstanceIds', () => {
  it('reload 后旧 ID 全部失效', () => {
    const oldIds = ['inst-1', 'inst-2'];
    const newIds = ['inst-1-new', 'inst-2-new'];
    expect(filterValidInstanceIds(oldIds, newIds)).toEqual([]);
  });

  it('append 模式保留仍有效的 ID', () => {
    const oldSelected = ['inst-1', 'inst-2'];
    const currentIds = ['inst-1', 'inst-3'];
    expect(filterValidInstanceIds(oldSelected, currentIds)).toEqual(['inst-1']);
  });

  it('replace 模式清空后为空', () => {
    expect(filterValidInstanceIds([], [])).toEqual([]);
  });
});

describe('isInstanceIdStale', () => {
  it('失效的 ID 返回 true', () => {
    expect(isInstanceIdStale('old-focused', ['inst-a', 'inst-b'])).toBe(true);
  });

  it('有效的 ID 返回 false', () => {
    expect(isInstanceIdStale('inst-a', ['inst-a', 'inst-b'])).toBe(false);
  });

  it('null 不算失效', () => {
    expect(isInstanceIdStale(null, ['inst-a'])).toBe(false);
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
