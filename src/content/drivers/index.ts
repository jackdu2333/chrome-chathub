import type { ServiceAdapter } from '../../types';
import { chatglmDriver } from './chatglmDriver';
import { doubaoDriver } from './doubaoDriver';
import { geminiDriver } from './geminiDriver';
import { genericDriver } from './genericDriver';
import { openaiDriver } from './openaiDriver';
import { qianwenDriver } from './qianwenDriver';
import type { BotDriver } from './types';

const orderedDrivers: BotDriver[] = [
  openaiDriver,
  geminiDriver,
  chatglmDriver,
  doubaoDriver,
  qianwenDriver,
  genericDriver,
];

export function resolveDriver(adapter: ServiceAdapter): BotDriver {
  return orderedDrivers.find((driver) => driver.matches(adapter)) ?? genericDriver;
}
