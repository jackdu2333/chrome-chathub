import type { BotDriver, DriverExecutionContext } from './types';
import type { ServiceAdapter, UserMessagePayload } from '../../types';
import { runStandardFlow } from '../dom/actions';

async function executeMessage(
  adapter: ServiceAdapter,
  payload: UserMessagePayload,
  context: DriverExecutionContext
) {
  await runStandardFlow(adapter, payload, {
    postUploadDelayRange: [3000, 4500],
    waitForInputTimeoutMs: 9000,
    waitForSubmitTimeoutMs: 1800,
  }, context);
}

export const geminiDriver: BotDriver = {
  id: 'gemini',
  matches: (adapter) => adapter.id === 'gemini',
  getCapabilities: () => ({
    text: true,
    submit: true,
    files: true,
  }),
  executeMessage,
};
