// src/hooks/webLLMSingleton.js
// Single source of truth for the in-browser WebLLM engine, shared by EVERY in-app AI feature
// (Lovelace, Hippocrates, Studio, Compass, RPG Coach and the tutor panel).
//
// Why one engine: each CreateMLCEngine() allocates GPU memory for a whole model. On a Mac the GPU
// shares RAM with everything else, so two engines at once can push the machine into swap and make
// generation fail. There is exactly one engine, holding exactly one model.
//
// Asking for a different model (the tutor can use another one) unloads the current engine from
// memory first. Cached files are deleted only when a model is abandoned (forgetModel), using WebLLM's
// own deleteModelAllInfoInCache: WebLLM keeps every model in shared caches named "webllm/model",
// "webllm/config" and "webllm/wasm", so deleting a cache named "webllm/<model id>" deletes nothing.
//
// Note: the browser stores caches per origin, and every localhost port is its own origin. A dev
// server that starts on a different port downloads the model again (see vite.config.js strictPort).

import { CreateMLCEngine, deleteModelAllInfoInCache } from '@mlc-ai/web-llm'

export const WEBLLM_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC'

let _engine = null
let _engineModelId = null
let _loading = null          // { modelId, promise } while a model is loading
let _f16 = null              // Promise<boolean>: does this GPU support 16-bit float shaders?

// The q4f16 builds need the GPU's 'shader-f16' feature. Without it, loading fails with
// "Invalid ShaderModule ... While validating compute stage" (seen in the desktop app on an NVIDIA
// GPU before main.cjs enabled DXC). Every model the app offers also has a q4f32 build, which
// needs no f16 support and uses more GPU memory, so a GPU without f16 gets that build instead.
function gpuHasF16() {
  if (!_f16) {
    _f16 = (async () => {
      const gpu = typeof navigator !== 'undefined' ? navigator.gpu : undefined
      if (!gpu) return true            // no WebGPU at all: WebLLM reports that itself
      const adapter = await gpu.requestAdapter().catch(() => null)
      return adapter ? adapter.features.has('shader-f16') : true
    })()
  }
  return _f16
}

/** The build of `modelId` this GPU can run: the q4f32 build when it lacks 16-bit float shaders. */
export async function runnableModelId(modelId) {
  if (!modelId?.includes('q4f16_1') || await gpuHasF16()) return modelId
  return modelId.replace('q4f16_1', 'q4f32_1')
}

/**
 * The shared engine, loaded with `modelId` (the app's default 1B model unless a feature asks for
 * another). onProgress receives (text, fraction 0–1) while the model downloads and compiles.
 */
export async function getSharedEngine(onProgress, requestedModelId = WEBLLM_MODEL_ID) {
  const modelId = await runnableModelId(requestedModelId)
  if (_engine && _engineModelId === modelId) return _engine
  if (_loading?.modelId === modelId) return _loading.promise
  if (_loading) await _loading.promise.catch(() => {})             // finish (or fail) the other load first

  const promise = (async () => {
    if (_engine) {
      await _engine.unload().catch(() => {})                       // release its GPU memory before loading another
      _engine = null
      _engineModelId = null
    }
    const engine = await CreateMLCEngine(modelId, {
      initProgressCallback: ({ text, progress }) => onProgress?.(text || 'Loading…', progress ?? 0),
    })
    _engine = engine
    _engineModelId = modelId
    return engine
  })()
  _loading = { modelId, promise }
  try {
    return await promise
  } finally {
    if (_loading?.promise === promise) _loading = null
  }
}

/**
 * Delete a model's cached files because nothing will use it any more (for example the tutor switched
 * to another model). The app's default model is kept: every other AI feature needs it.
 */
export async function forgetModel(requestedModelId) {
  if (!requestedModelId || requestedModelId === WEBLLM_MODEL_ID) return
  const modelId = await runnableModelId(requestedModelId)
  if (modelId === _engineModelId) await unloadSharedEngine()
  await deleteModelAllInfoInCache(modelId).catch(() => {})
}

/** Unload the engine from memory (the cached files stay, so the next use loads quickly). */
export async function unloadSharedEngine() {
  const engine = _engine
  _engine = null
  _engineModelId = null
  await engine?.unload().catch(() => {})
}

/**
 * Deletes a cached model's files. Pass '*' to delete every WebLLM cache in this origin.
 * Unloads the engine first if it holds the model being deleted.
 * @param {string} modelId
 */
export async function deleteCachedModel(requestedModelId) {
  const modelId = requestedModelId === '*' ? '*' : await runnableModelId(requestedModelId)
  if (modelId === '*' || modelId === _engineModelId) await unloadSharedEngine()
  if (modelId === '*') {
    if (!('caches' in window)) return
    const names = await caches.keys()
    await Promise.all(names.filter(n => n.startsWith('webllm/')).map(n => caches.delete(n)))
    return
  }
  await deleteModelAllInfoInCache(modelId).catch(() => {})
}
