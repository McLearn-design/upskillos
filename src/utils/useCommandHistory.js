// Undo, redo and GUI → code for the art labs (Tile Mapper, Sprite Forge), as Game Studio has them.
//
// History holds whole-document snapshots with structural sharing (an edit copies only what it changes), so
// palette swaps, reorders and resizes are as cheap to undo as a stroke. Each edit can also be a command,
// { label, code, run }: `act(command)` makes the edit and logs its line of code, and undo and redo take the
// line off and put it back, so the log always says how the document on screen was made from `start`.
//
// The document lives in a ref, so every edit sees the one before it at once (two edits in one event cannot
// overwrite each other) and the log is written once per edit. State only makes React draw it.
import { useCallback, useRef, useState } from 'react'

export function useCommandHistory(initial, limit = 60) {
  const docRef = useRef(null)
  if (docRef.current === null) docRef.current = typeof initial === 'function' ? initial() : initial
  const [doc, setDoc] = useState(docRef.current)
  const past = useRef([])
  const future = useRef([])
  const [depths, setDepths] = useState({ canUndo: false, canRedo: false })
  const logRef = useRef([])
  const undone = useRef([])
  const [log, setLog] = useState([])
  // The document the log starts from: the session's first, or the last one opened.
  const [start, setStart] = useState(docRef.current)

  const show = useCallback(() => {
    setDoc(docRef.current)
    setLog(logRef.current)
    setDepths({ canUndo: past.current.length > 0, canRedo: future.current.length > 0 })
  }, [])

  // Records the current document as an undo point, then applies the change.
  const commit = useCallback(
    (next, entry = null) => {
      const prev = docRef.current
      const resolved = typeof next === 'function' ? next(prev) : next
      if (!resolved || resolved === prev) return false
      past.current = [...past.current.slice(-(limit - 1)), { doc: prev, logged: !!entry }]
      future.current = []
      undone.current = []
      if (entry) logRef.current = [...logRef.current, entry]
      docRef.current = resolved
      show()
      return true
    },
    [show],
  )

  /**
   * One edit as a command ({ label, code, run }), or a function of the current document that makes one:
   * applied, and its line of code logged. Returns an error message, or null.
   */
  const act = useCallback(
    (make) => {
      try {
        const command = typeof make === 'function' ? make(docRef.current) : make
        commit(command.run, { label: command.label, code: command.code })
        return null
      } catch (e) {
        return e instanceof Error ? e.message : String(e)
      }
    },
    [commit],
  )

  // Applies a change without recording history (a live preview while dragging a control).
  const apply = useCallback(
    (next) => {
      const resolved = typeof next === 'function' ? next(docRef.current) : next
      if (resolved && resolved !== docRef.current) { docRef.current = resolved; show() }
    },
    [show],
  )

  const undo = useCallback(() => {
    const step = past.current[past.current.length - 1]
    if (!step) return
    past.current = past.current.slice(0, -1)
    future.current = [...future.current, { doc: docRef.current, logged: step.logged }]
    if (step.logged && logRef.current.length) {
      undone.current = [...undone.current, logRef.current[logRef.current.length - 1]]
      logRef.current = logRef.current.slice(0, -1)
    }
    docRef.current = step.doc
    show()
  }, [show])

  const redo = useCallback(() => {
    const step = future.current[future.current.length - 1]
    if (!step) return
    future.current = future.current.slice(0, -1)
    past.current = [...past.current, { doc: docRef.current, logged: step.logged }]
    if (step.logged && undone.current.length) {
      logRef.current = [...logRef.current, undone.current[undone.current.length - 1]]
      undone.current = undone.current.slice(0, -1)
    }
    docRef.current = step.doc
    show()
  }, [show])

  // A different document (opened, new, imported): history and the log start again from it, because
  // undoing across that boundary would bring back work the user believes they closed.
  const replaceDoc = useCallback(
    (next) => {
      past.current = []
      future.current = []
      undone.current = []
      logRef.current = []
      docRef.current = next
      setStart(next)
      show()
    },
    [show],
  )

  return { doc, commit, act, log, start, apply, undo, redo, replaceDoc, ...depths }
}
