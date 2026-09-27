import m01 from './01-render-a-cell.js'
import m02 from './02-render-a-grid.js'
import m03 from './03-editing.js'
import m04 from './04-computed-values.js'
import m05 from './05-formatting.js'
import m06 from './06-selection.js'
import m07 from './07-multiple-sheets.js'
import m08 from './08-named-ranges.js'
import m09 from './09-formula-editor.js'
import m10 from './10-dependency-graph.js'
import m11 from './11-undo-redo.js'
import m12 from './12-plugins.js'

const MILESTONE_CHANGES = [
  m01, m02, m03, m04, m05, m06,
  m07, m08, m09, m10, m11, m12,
]

// These files were authored as cumulative changes: later entries contain the
// files introduced or changed at that checkpoint, not a complete standalone
// project. Materialize full snapshots here because the studio runtime executes
// one self-contained virtual file system at a time.
let accumulatedFiles = {}
let accumulatedWhy = {}
export const SPREADSHEET_MILESTONES = MILESTONE_CHANGES.map(milestone => {
  accumulatedFiles = { ...accumulatedFiles, ...milestone.files }
  accumulatedWhy = { ...accumulatedWhy, ...milestone.why }
  return {
    ...milestone,
    files: { ...accumulatedFiles },
    why: { ...accumulatedWhy },
  }
})
