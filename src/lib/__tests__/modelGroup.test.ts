import { describe, it, expect } from 'vitest';

describe('ModelGroup replace/append logic', () => {
  const currentBots = [
    { id: 'openai', instanceId: 'inst-1' },
    { id: 'claude', instanceId: 'inst-2' },
  ];

  const groupBots = [
    { id: 'gemini', instanceId: 'inst-3' },
    { id: 'doubao', instanceId: 'inst-4' },
  ];

  it('replace: 完全替换，不保留旧 bot', () => {
    const result = [...groupBots];
    expect(result).toHaveLength(2);
    expect(result.map(b => b.id)).toEqual(['gemini', 'doubao']);
  });

  it('append: 去重追加', () => {
    const existingIds = new Set(currentBots.map(b => b.id));
    const newBots = groupBots.filter(b => !existingIds.has(b.id));
    expect(newBots).toHaveLength(2);
    const combined = [...currentBots, ...newBots];
    expect(combined).toHaveLength(4);
  });

  it('append: 已存在的 bot 不重复添加', () => {
    const existingIds = new Set(['openai', 'claude', 'gemini']);
    const overlapGroup = [
      { id: 'openai', instanceId: 'inst-5' },
      { id: 'kimi', instanceId: 'inst-6' },
    ];
    const newBots = overlapGroup.filter(b => !existingIds.has(b.id));
    expect(newBots).toHaveLength(1);
    expect(newBots[0].id).toBe('kimi');
  });
});
