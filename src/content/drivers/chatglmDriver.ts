import type { BotDriver, DriverExecutionContext } from './types';
import type { ServiceAdapter, UserMessagePayload } from '../../types';
import { runStandardFlow } from '../dom/actions';

async function executeMessage(
  adapter: ServiceAdapter,
  payload: UserMessagePayload,
  context: DriverExecutionContext
) {
  await runStandardFlow(adapter, payload, {
    postUploadDelayRange: [2200, 3800],
    waitForInputTimeoutMs: 9000,
    waitForSubmitTimeoutMs: 1200,
  }, context);
}

export const chatglmDriver: BotDriver = {
  id: 'chatglm',
  matches: (adapter) => adapter.id === 'chatglm',
  getCapabilities: () => ({
    text: true,
    submit: true,
    files: true,
  }),
  executeMessage,
};
