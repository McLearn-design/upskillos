// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CppProjectRuntime from './CppProjectRuntime.jsx';

const C = { hint: '#888888', border: '#333333', teal: '#00aaaa', surface2: '#111111', text: '#ffffff', amber: '#ffbb00' };
let root, host, bridge, unsubscribe;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  unsubscribe = vi.fn();
  bridge = {
    getRuntimeStatus: vi.fn().mockResolvedValue({ ok: true, status: { installed: false, projectSupported: true } }),
    onRuntimeProgress: vi.fn(() => unsubscribe),
    installRuntime: vi.fn(),
  };
  window.openCalcDesktop = bridge;
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  delete window.openCalcDesktop;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
const render = () => act(async () => { root.render(<CppProjectRuntime C={C} />); });

describe('Project Studio C++ runtime setup', () => {
  it('flags an older desktop bridge even when its compiler is installed', async () => {
    bridge.getRuntimeStatus.mockResolvedValue({ ok: true, status: { installed: true, version: 'old bridge compiler' } });
    await render();
    expect(host.querySelector('[role="alert"]').textContent).toContain('fully restart the updated desktop app');
    expect(bridge.installRuntime).not.toHaveBeenCalled();
  });
  it('shows the actual installed compiler without installing another', async () => {
    bridge.getRuntimeStatus.mockResolvedValue({ ok: true, status: { installed: true, projectSupported: true, source: 'system', version: 'test compiler' } });
    await render();
    expect(host.textContent).toContain('Using your installed compiler: test compiler');
    expect(host.querySelector('button')).toBeNull();
    expect(bridge.installRuntime).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('installs only after a click and refreshes compiler status', async () => {
    await render();
    bridge.installRuntime.mockResolvedValue({ ok: true });
    bridge.getRuntimeStatus.mockResolvedValue({ ok: true, status: { installed: true, projectSupported: true, source: 'app', version: 'managed compiler' } });
    await act(async () => host.querySelector('button').click());
    expect(bridge.installRuntime).toHaveBeenCalledWith('cpp');
    expect(host.textContent).toContain('Using the app-managed compiler: managed compiler');
  });

  it('reports a rejected installation and allows retry', async () => {
    await render();
    bridge.installRuntime.mockRejectedValue(new Error('Download unavailable'));
    await act(async () => host.querySelector('button').click());
    expect(host.querySelector('[role="alert"]').textContent).toBe('Download unavailable');
    expect(host.querySelector('button').textContent).toContain('Install C++ compiler');
  });
});

