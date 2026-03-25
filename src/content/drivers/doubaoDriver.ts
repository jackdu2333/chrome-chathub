import type { BotDriver, DriverExecutionContext } from './types';
import type { ServiceAdapter, UserMessagePayload } from '../../types';
import { runStandardFlow } from '../dom/actions';

async function executeMessage(
  adapter: ServiceAdapter,
  payload: UserMessagePayload,
  context: DriverExecutionContext
) {
  await runStandardFlow(adapter, payload, {
    waitForInputTimeoutMs: 7000,
    waitForSubmitTimeoutMs: 1500,
  }, context);
}

export const doubaoDriver: BotDriver = {
  id: 'doubao',
  matches: (adapter) => adapter.id === 'doubao',
  getCapabilities: () => ({
    text: true,
    submit: true,
    files: true,
  }),
  executeMessage,
};
