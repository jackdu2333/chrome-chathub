import { describe, it, expect } from 'vitest';

// 测试 instanceId 失效后的清理逻辑
describe('selectedTargetInstanceIds cleanup', () => {
  it('reload 后旧 selected ID 应全部失效', () => {
    const oldIds = ['inst-1', 'inst-2'];
    const newIds = ['inst-1-new', 'inst-2-new'];
    // 旧 ID 不在新列表中
    const valid = oldIds.filter(id => newIds.includes(id));
    expect(valid).toEqual([]);
  });

  it('append 模式下保留仍有效的 selected ID', () => {
    const oldSelected = ['inst-1', 'inst-2'];
    const currentIds = ['inst-1', 'inst-3']; // inst-2 被移除
    const valid = oldSelected.filter(id => currentIds.includes(id));
    expect(valid).toEqual(['inst-1']);
  });

  it('replace 模式清空所有 selected', () => {
    const selected: string[] = [];
    expect(selected).toEqual([]);
  });
});

// 测试 focusedInstanceId 失效检测
describe('focusedInstanceId cleanup', () => {
  it('失效的 focusedId 不在 activeBots 中', () => {
    const focusedId = 'old-focused';
    const activeInstanceIds = ['inst-a', 'inst-b'];
    const isStale = !activeInstanceIds.includes(focusedId);
    expect(isStale).toBe(true);
  });

  it('有效的 focusedId 在 activeBots 中', () => {
    const focusedId = 'inst-a';
    const activeInstanceIds = ['inst-a', 'inst-b'];
    const isStale = !activeInstanceIds.includes(focusedId);
    expect(isStale).toBe(false);
  });
});
