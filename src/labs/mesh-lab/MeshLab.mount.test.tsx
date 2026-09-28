// @vitest-environment happy-dom
//
// Does MeshLab actually mount?
//
// The smoke test reproduces the scene setup, which is where the getHelper
// failure lived. It does not run the component, so it cannot catch a crash in
// an effect, in the inspector reading a property that is not there, or in the
// render loop.
//
// This mounts the real component. Only WebGLRenderer is replaced, because it
// needs a GPU context that no headless environment provides; everything else -
// the effects, the controls, the outliner, the inspector, the console - is the
// real code.
//
// If this passes, "MeshLab failed to load" cannot happen for a reason that
// lives in the component's own logic.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

// Replace only the renderer. importActual keeps every other export real, so the
// component still constructs genuine geometries, materials, controls and a
// genuine raycaster.
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeRenderer {
    domElement: HTMLCanvasElement;
    shadowMap = { enabled: false };
    constructor(params?: { canvas?: HTMLCanvasElement }) {
      this.domElement = params?.canvas ?? document.createElement('canvas');
    }
    setPixelRatio() {}
    setSize() {}
    render() {}
    dispose() {}
  }
  return { ...actual, WebGLRenderer: FakeRenderer };
});

beforeAll(() => {
  // happy-dom has neither of these, and the component uses both.
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  // Run one frame and stop, so the loop cannot spin forever under the test.
  let frames = 0;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    if (frames++ < 2) queueMicrotask(() => cb(performance.now()));
    return frames;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
});

afterEach(() => cleanup());
beforeEach(() => localStorage.clear());

describe('MeshLab mounts', () => {
  it('renders without throwing', async () => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a));

    const { default: MeshLab } = await import('./MeshLab');
    expect(() => render(<MeshLab />)).not.toThrow();

    // A React error boundary would swallow a throw inside an effect and log it
    // instead, so an empty console is part of the claim.
    const real = errors.filter((e) => !String(e).includes('not wrapped in act'));
    expect(real, `console.error during mount: ${JSON.stringify(real).slice(0, 400)}`).toEqual([]);

    spy.mockRestore();
  });

  it('shows the starting scene in the outliner', async () => {
    const { default: MeshLab } = await import('./MeshLab');
    render(<MeshLab />);
    // The default scene: a cube and a sun, like Blender's.
    for (const name of ['Cube', 'Light']) {
      expect(screen.getAllByText(name).length, `outliner is missing ${name}`).toBeGreaterThan(0);
    }
  });

  it('Tab enters edit mode and the inspector shows the mesh being edited', async () => {
    const { default: MeshLab } = await import('./MeshLab');
    render(<MeshLab />);
    await act(async () => { fireEvent.keyDown(window, { key: 'Tab' }); });
    expect(screen.getAllByText(/Edit mode/).length).toBeGreaterThan(0);
    expect(screen.getByText('EDITING CUBE')).toBeTruthy();
  });

  it('adding a primitive from the menu puts it in the scene', async () => {
    const { default: MeshLab } = await import('./MeshLab');
    render(<MeshLab />);
    await act(async () => { fireEvent.click(screen.getByText('Add')); });
    await act(async () => { fireEvent.click(screen.getByText('Torus')); });
    expect(screen.getAllByText('Torus').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/GUI → code \(1\)/).length).toBe(1);
  });

  it('unmounts cleanly', async () => {
    const { default: MeshLab } = await import('./MeshLab');
    const { unmount } = render(<MeshLab />);
    expect(() => unmount()).not.toThrow();
  });
});
