const frameRegistry = new Map<string, HTMLIFrameElement>();

export function registerFrame(instanceId: string, iframe: HTMLIFrameElement) {
  frameRegistry.set(instanceId, iframe);
}

export function unregisterFrame(instanceId: string) {
  frameRegistry.delete(instanceId);
}

export function getFrameWindow(instanceId: string): Window | null {
  return frameRegistry.get(instanceId)?.contentWindow ?? null;
}

export function findInstanceIdBySource(source: MessageEventSource | null): string | null {
  if (!source) {
    return null;
  }

  for (const [instanceId, iframe] of frameRegistry.entries()) {
    if (iframe.contentWindow === source) {
      return instanceId;
    }
  }

  return null;
}
