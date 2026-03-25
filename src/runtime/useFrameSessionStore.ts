import { create } from 'zustand';
import { DriverCapabilities, FrameStatus } from './protocol';

export interface FrameSession {
  instanceId: string;
  adapterId: string;
  botName: string;
  url: string;
  status: FrameStatus;
  capabilities: DriverCapabilities;
  iframeLoadedAt?: number;
  lastHandshakeAt?: number;
  lastCommandId?: string;
  lastCommandAt?: number;
  lastResultAt?: number;
  lastError?: string;
  lastDetail?: string;
}

const defaultCapabilities: DriverCapabilities = {
  text: true,
  submit: true,
  files: false,
};

interface FrameSessionState {
  sessions: Record<string, FrameSession>;
  ensureSession: (session: Pick<FrameSession, 'instanceId' | 'adapterId' | 'botName' | 'url'>) => void;
  removeSession: (instanceId: string) => void;
  markBooting: (instanceId: string) => void;
  markIframeLoaded: (instanceId: string) => void;
  updateRuntimeStatus: (
    instanceId: string,
    payload: {
      status: FrameStatus;
      adapterId?: string;
      botName?: string;
      url?: string;
      capabilities?: DriverCapabilities;
      reason?: string;
      detail?: string;
      timestamp: number;
    }
  ) => void;
  markCommandAck: (instanceId: string, commandId: string, detail?: string) => void;
  markCommandResult: (
    instanceId: string,
    commandId: string,
    success: boolean,
    error?: string,
    detail?: string
  ) => void;
}

function ensureExistingSession(
  sessions: Record<string, FrameSession>,
  instanceId: string
): FrameSession | null {
  return sessions[instanceId] ?? null;
}

export const useFrameSessionStore = create<FrameSessionState>((set) => ({
  sessions: {},

  ensureSession: ({ instanceId, adapterId, botName, url }) =>
    set((state) => ({
      sessions: {
        ...state.sessions,
        [instanceId]: {
          instanceId,
          adapterId,
          botName,
          url,
          status: state.sessions[instanceId]?.status ?? 'booting',
          capabilities: state.sessions[instanceId]?.capabilities ?? defaultCapabilities,
          iframeLoadedAt: state.sessions[instanceId]?.iframeLoadedAt,
          lastHandshakeAt: state.sessions[instanceId]?.lastHandshakeAt,
          lastCommandAt: state.sessions[instanceId]?.lastCommandAt,
          lastCommandId: state.sessions[instanceId]?.lastCommandId,
          lastResultAt: state.sessions[instanceId]?.lastResultAt,
          lastError: state.sessions[instanceId]?.lastError,
          lastDetail: state.sessions[instanceId]?.lastDetail,
        },
      },
    })),

  removeSession: (instanceId) =>
    set((state) => {
      const nextSessions = { ...state.sessions };
      delete nextSessions[instanceId];
      return { sessions: nextSessions };
    }),

  markBooting: (instanceId) =>
    set((state) => {
      const session = ensureExistingSession(state.sessions, instanceId);
      if (!session) {
        return state;
      }

      return {
        sessions: {
          ...state.sessions,
          [instanceId]: {
            ...session,
            status: 'booting',
            lastError: undefined,
          },
        },
      };
    }),

  markIframeLoaded: (instanceId) =>
    set((state) => {
      const session = ensureExistingSession(state.sessions, instanceId);
      if (!session) {
        return state;
      }

      return {
        sessions: {
          ...state.sessions,
          [instanceId]: {
            ...session,
            iframeLoadedAt: Date.now(),
          },
        },
      };
    }),

  updateRuntimeStatus: (instanceId, payload) =>
    set((state) => {
      const existing = state.sessions[instanceId];
      if (!existing) {
        return state;
      }

      return {
        sessions: {
          ...state.sessions,
          [instanceId]: {
            ...existing,
            adapterId: payload.adapterId ?? existing.adapterId,
            botName: payload.botName ?? existing.botName,
            url: payload.url ?? existing.url,
            status: payload.status,
            capabilities: payload.capabilities ?? existing.capabilities,
            lastHandshakeAt: payload.timestamp,
            lastError: payload.reason,
            lastDetail: payload.detail ?? existing.lastDetail,
          },
        },
      };
    }),

  markCommandAck: (instanceId, commandId, detail) =>
    set((state) => {
      const session = ensureExistingSession(state.sessions, instanceId);
      if (!session) {
        return state;
      }

      return {
        sessions: {
          ...state.sessions,
          [instanceId]: {
            ...session,
            status: 'busy',
            lastCommandId: commandId,
            lastCommandAt: Date.now(),
            lastError: undefined,
            lastDetail: detail ?? session.lastDetail,
          },
        },
      };
    }),

  markCommandResult: (instanceId, commandId, success, error, detail) =>
    set((state) => {
      const session = ensureExistingSession(state.sessions, instanceId);
      if (!session) {
        return state;
      }

      return {
        sessions: {
          ...state.sessions,
          [instanceId]: {
            ...session,
            status: success ? 'ready' : 'error',
            lastCommandId: commandId,
            lastResultAt: Date.now(),
            lastError: success ? undefined : error,
            lastDetail: detail ?? session.lastDetail,
          },
        },
      };
    }),
}));
