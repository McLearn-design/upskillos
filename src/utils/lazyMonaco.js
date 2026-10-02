// Monaco (the code editor) is bundled so editors work offline, but it is about
// 9 MB of JavaScript. Importing configureMonaco.js from main.jsx put all of it
// in the first download of every page, including the many that never show an
// editor. Instead, the first editor to start triggers the import: the editor
// components call loader.init(), so it waits until configureMonaco.js has
// handed the bundled copy to the loader, and the rest of init is unchanged.
import { loader } from '@monaco-editor/react'
import { isStaleChunkError, reloadForNewVersion } from './staleChunk.js'

const originalInit = loader.init
let configured = null

loader.init = function init() {
  // A failed import is forgotten, so the next editor tries again instead of
  // every editor failing until a reload. After a deploy, reload instead.
  configured ??= import('./configureMonaco.js').catch((error) => {
    configured = null
    if (isStaleChunkError(error)) reloadForNewVersion()
    throw error
  })
  let canceled = false
  // Callers cancel when they unmount before Monaco is ready. A canceled load
  // never settles, rather than rejecting: the library's useMonaco() hook
  // calls init() without a catch, so a rejection there is an uncaught error.
  const promise = new Promise((resolve, reject) => {
    configured
      .then(() => originalInit.call(loader))
      .then((monaco) => { if (!canceled) resolve(monaco) }, (error) => { if (!canceled) reject(error) })
  })
  promise.cancel = () => { canceled = true }
  return promise
}
