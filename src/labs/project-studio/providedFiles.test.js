import { describe, expect, it, vi } from 'vitest';
import { createProvidedFiles } from './providedFiles.js';

const files = [{ file: 'game.h', content: 'provided window' }, { file: 'main.cpp', content: 'starter' }];
describe('provided starter files', () => {
  it('repairs a missing header without replacing code the learner typed', async () => {
    const api = {
      read: vi.fn(async file => ({ ok: true, missing: file === 'game.h', content: 'my typed program' })),
      write: vi.fn(async () => ({ ok: true })),
    };
    await createProvidedFiles(api, [files[0], { ...files[1], preserveExisting: true }]);
    expect(api.write.mock.calls).toEqual([['game.h', 'provided window']]);
  });
  it('creates missing files and leaves identical existing infrastructure alone', async () => {
    const api = {
      read: vi.fn(async file => ({ ok: true, missing: file !== 'game.h', content: 'provided window' })),
      write: vi.fn(async () => ({ ok: true })),
    };
    await createProvidedFiles(api, files);
    expect(api.write.mock.calls).toEqual([['main.cpp', 'starter']]);
  });

  it('refuses all writes when any destination already contains learner work', async () => {
    const api = {
      read: vi.fn(async file => ({ ok: true, missing: file === 'game.h', content: 'my edited game' })),
      write: vi.fn(),
    };
    await expect(createProvidedFiles(api, files)).rejects.toThrow('main.cpp already contains work');
    expect(api.write).not.toHaveBeenCalled();
  });

  it('does not turn a failed read or failed write into successful setup', async () => {
    const api = { read: vi.fn(async () => ({ ok: false, reason: 'disk unavailable' })), write: vi.fn() };
    await expect(createProvidedFiles(api, files)).rejects.toThrow('disk unavailable');
    expect(api.write).not.toHaveBeenCalled();
    api.read.mockResolvedValue({ ok: true, missing: true });
    api.write.mockResolvedValue({ ok: false, reason: 'disk full' });
    await expect(createProvidedFiles(api, files)).rejects.toThrow('disk full');
  });
});
