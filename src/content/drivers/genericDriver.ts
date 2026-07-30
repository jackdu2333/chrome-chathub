import type { DriverCapabilities } from '../../runtime/protocol';
import type { ServiceAdapter, UserMessagePayload } from '../../types';
import { runStandardFlow } from '../dom/actions';
import { DriverExecutionError, type BotDriver, type DriverExecutionContext } from './types';
import { supportsGenericFileUpload } from './genericCapabilities';

export function getGenericCapabilities(adapter: ServiceAdapter): DriverCapabilities {
  return {
    text: true,
    submit: true,
    files: supportsGenericFileUpload(adapter),
  };
}

export async function executeGenericMessage(
  adapter: ServiceAdapter,
  payload: UserMessagePayload,
  context: DriverExecutionContext
) {
  if (payload.files?.length && !supportsGenericFileUpload(adapter)) {
    throw new DriverExecutionError('upload', 'FILE_UPLOAD_UNSUPPORTED', adapter.id);
  }

  await runStandardFlow(adapter, payload, undefined, context);
}

export const genericDriver: BotDriver = {
  id: 'generic',
  matches: () => true,
  getCapabilities: getGenericCapabilities,
  executeMessage: executeGenericMessage,
};
