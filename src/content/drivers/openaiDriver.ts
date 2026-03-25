import type { BotDriver, DriverExecutionContext } from './types';
import type { ServiceAdapter, UserMessagePayload } from '../../types';
import { runStandardFlow } from '../dom/actions';

async function executeMessage(
  adapter: ServiceAdapter,
  payload: UserMessagePayload,
  context: DriverExecutionContext
) {
  await runStandardFlow(adapter, payload, {
    postUploadDelayRange: [1800, 2800],
    waitForInputTimeoutMs: 10000,
    waitForSubmitTimeoutMs: 1800,
  }, context);
}

export const openaiDriver: BotDriver = {
  id: 'openai',
  matches: (adapter) => adapter.id === 'openai',
  getCapabilities: () => ({
    text: true,
    submit: true,
    files: true,
  }),
  executeMessage,
};
