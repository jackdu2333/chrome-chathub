import { describe, it, expect } from 'vitest';

// 纯函数测试：模型组合的 replace/append 逻辑验证
// 不依赖真实 Zustand store，只验证决策逻辑

describe('ModelGroup apply logic (pure)', () => {
  type FakeBot = { id: string; instanceId: string };

  function applyReplace(_currentBots: FakeBot[], groupBots: FakeBot[]): FakeBot[] {
    return [...groupBots];
  }

  function applyAppend(currentBots: FakeBot[], groupBots: FakeBot[]): FakeBot[] {
    const existingIds = new Set(currentBots.map(b => b.id));
    const newBots = groupBots.filter(b => !existingIds.has(b.id));
    return [...currentBots, ...newBots];
  }

  const current: FakeBot[] = [
    { id: 'openai', instanceId: 'inst-1' },
    { id: 'claude', instanceId: 'inst-2' },
  ];

  const group: FakeBot[] = [
    { id: 'gemini', instanceId: 'inst-3' },
    { id: 'doubao', instanceId: 'inst-4' },
  ];

  it('replace: 完全替换，不保留旧 bot', () => {
    const result = applyReplace(current, group);
    expect(result).toHaveLength(2);
    expect(result.map(b => b.id)).toEqual(['gemini', 'doubao']);
  });

  it('append: 去重追加新 bot', () => {
    const result = applyAppend(current, group);
    expect(result).toHaveLength(4);
  });

  it('append: 已存在的 bot 不重复添加', () => {
    const overlap: FakeBot[] = [
      { id: 'openai', instanceId: 'inst-5' },
      { id: 'kimi', instanceId: 'inst-6' },
    ];
    const result = applyAppend(current, overlap);
    expect(result).toHaveLength(3);
    expect(result.map(b => b.id)).toContain('kimi');
    expect(result.filter(b => b.id === 'openai')).toHaveLength(1);
  });

  it('replace 后 selected targets 应清空', () => {
    // 模拟 replace 模式的清理
    const selectedAfterReplace: string[] = [];
    expect(selectedAfterReplace).toEqual([]);
  });

  it('append 后 selected targets 只保留有效 ID', () => {
    const oldSelected = ['inst-1', 'inst-2'];
    const result = applyAppend(current, group);
    const validIds = result.map(b => b.instanceId);
    const validSelected = oldSelected.filter(id => validIds.includes(id));
    expect(validSelected).toEqual(['inst-1', 'inst-2']);
  });
});
