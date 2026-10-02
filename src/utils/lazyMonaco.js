// Monaco (the code editor) is bundled so editors work offline, but it is about
// 9 MB of JavaScript. Importing configureMonaco.js from main.jsx put all of it
// in the first download of every page, including the many that never show an
// editor. Instead, the first editor to start triggers the import: the editor
// components call loader.init(), so it waits until configureMonaco.js has
// handed the bundled copy to the loader, and the rest of init is unchanged.
import { loader } from '@monaco-editor/react'

const originalInit = loader.init
let configured = null

loader.init = function init() {
  configured ??= import('./configureMonaco.js')
  let canceled = false
  const promise = configured
    .then(() => originalInit.call(loader))
    .then((monaco) => {
      // Same shape as the loader's own cancelation, which the editors ignore.
      if (canceled) throw { type: 'cancelation', msg: 'operation is manually canceled' }
      return monaco
    })
  // The editors call cancel() when they unmount before Monaco is ready.
  promise.cancel = () => { canceled = true }
  return promise
}
