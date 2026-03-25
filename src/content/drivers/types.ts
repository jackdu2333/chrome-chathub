import type { DriverCapabilities } from '../../runtime/protocol';
import type { ServiceAdapter, UserMessagePayload } from '../../types';

export type DriverStep = 'ready' | 'input' | 'upload' | 'text' | 'submit' | 'verify';

export interface DriverTraceEntry {
  step: DriverStep;
  status: 'start' | 'success' | 'error';
  message: string;
  timestamp: number;
}

export interface DriverExecutionContext {
  trace: (entry: Omit<DriverTraceEntry, 'timestamp'>) => void;
}

export class DriverExecutionError extends Error {
  code: string;
  step: DriverStep;

  constructor(step: DriverStep, code: string, message?: string) {
    super(message ?? code);
    this.name = 'DriverExecutionError';
    this.code = code;
    this.step = step;
  }
}

export interface BotDriver {
  id: string;
  matches: (adapter: ServiceAdapter) => boolean;
  getCapabilities: (adapter: ServiceAdapter) => DriverCapabilities;
  executeMessage: (
    adapter: ServiceAdapter,
    payload: UserMessagePayload,
    context: DriverExecutionContext
  ) => Promise<void>;
}
