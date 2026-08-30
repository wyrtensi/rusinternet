import { describe, expect, it, vi } from 'vitest';
import { copyTextAndSetLabel } from '../src/lib/clipboard';

describe('clipboard button feedback', () => {
  it('updates the captured button after the asynchronous clipboard write', async () => {
    const button = { textContent: 'Копировать' };
    const clipboard = { writeText: vi.fn(async () => undefined) };

    await copyTextAndSetLabel('verified command', button, 'Скопировано', clipboard);

    expect(clipboard.writeText).toHaveBeenCalledWith('verified command');
    expect(button.textContent).toBe('Скопировано');
  });
});
