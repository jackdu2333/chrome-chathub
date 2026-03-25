import type { DriverCapabilities } from '../../runtime/protocol';
import type { ServiceAdapter, UserMessagePayload } from '../../types';
import { runStandardFlow } from '../dom/actions';
import type { BotDriver, DriverExecutionContext } from './types';

export function getGenericCapabilities(_adapter: ServiceAdapter): DriverCapabilities {
  return {
    text: true,
    submit: true,
    files: true,
  };
}

export async function executeGenericMessage(
  adapter: ServiceAdapter,
  payload: UserMessagePayload,
  context: DriverExecutionContext
) {
  await runStandardFlow(adapter, payload, undefined, context);
}

export const genericDriver: BotDriver = {
  id: 'generic',
  matches: () => true,
  getCapabilities: getGenericCapabilities,
  executeMessage: executeGenericMessage,
};
