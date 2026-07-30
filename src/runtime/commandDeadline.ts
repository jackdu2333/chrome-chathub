export const DEFAULT_COMMAND_TIMEOUT_MS = 20000;

export function createCommandDeadline(
  timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS,
  now = Date.now()
) {
  return now + timeoutMs;
}

export function isCommandExpired(expiresAt: number, now = Date.now()) {
  return now >= expiresAt;
}

export function assertCommandNotExpired(expiresAt: number, now = Date.now()) {
  if (!Number.isFinite(expiresAt)) {
    throw new Error('COMMAND_INVALID_DEADLINE');
  }

  if (isCommandExpired(expiresAt, now)) {
    throw new Error('COMMAND_EXPIRED');
  }
}

export function isCommandExpirationError(error: unknown) {
  return error instanceof Error && error.message === 'COMMAND_EXPIRED';
}
