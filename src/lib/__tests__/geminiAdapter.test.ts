import { describe, expect, it } from 'vitest';
import { DEFAULT_ADAPTERS } from '../../types';

describe('Gemini adapter', () => {
  it('directly opens the chat app to avoid a redirect during iframe startup', () => {
    const gemini = DEFAULT_ADAPTERS.find((adapter) => adapter.id === 'gemini');

    expect(gemini?.url).toBe('https://gemini.google.com');
    expect(gemini?.embedUrl).toBe('https://gemini.google.com/app');
  });
});
