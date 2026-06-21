import type { SendTargetMode } from '../store/types';

/**
 * 纯函数：根据发送模式解析目标 instanceId 列表。
 * 从组件逻辑中抽出，方便单元测试，不依赖 React/Zustand 闭包状态。
 */
export function resolveTargetInstanceIds(
  mode: SendTargetMode,
  allInstanceIds: string[],
  focusedInstanceId: string | null,
  selectedTargetInstanceIds: string[],
): string[] {
  if (mode === 'all') {
    return allInstanceIds;
  }
  if (mode === 'focused') {
    return focusedInstanceId ? [focusedInstanceId] : [];
  }
  // selected 模式
  return selectedTargetInstanceIds;
}

/**
 * 纯函数：过滤出仍然有效的 instanceId（用于 reload/applyModelGroup 后清理）。
 */
export function filterValidInstanceIds(
  selectedIds: string[],
  validIds: string[],
): string[] {
  const validSet = new Set(validIds);
  return selectedIds.filter(id => validSet.has(id));
}

/**
 * 纯函数：检测 focusedInstanceId 是否已失效。
 */
export function isInstanceIdStale(
  instanceId: string | null,
  validIds: string[],
): boolean {
  if (!instanceId) return false;
  return !validIds.includes(instanceId);
}
