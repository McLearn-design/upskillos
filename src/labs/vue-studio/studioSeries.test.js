import { describe, expect, it } from 'vitest'
import { MILESTONES } from './milestones/index.js'
import { SPREADSHEET_MILESTONES } from './series/spreadsheet/milestones/index.js'
import {
  VUE_STUDIO_SERIES,
  getSeriesMilestone,
  getStudioSeries,
  getWorkspaceId,
} from './studioSeries.js'
import { computeDependencyGraph, resolveModulePath, rewriteImports } from './sandbox.js'

describe('Vue Studio series model', () => {
  it('keeps guided lessons paired one-to-one with their workspaces', () => {
    const essentials = getStudioSeries('intro')
    const checkpoints = getStudioSeries('spreadsheet-checkpoints')

    expect(essentials.lessons).toHaveLength(MILESTONES.length)
    expect(checkpoints.lessons).toHaveLength(SPREADSHEET_MILESTONES.length)
    expect(getSeriesMilestone(essentials, 3)).toBe(MILESTONES[3])
    expect(getSeriesMilestone(checkpoints, 3)).toBe(SPREADSHEET_MILESTONES[3])
  })

  it('uses one persistent workspace for every cumulative project lesson', () => {
    const project = getStudioSeries('spreadsheet')

    expect(project.lessons).toHaveLength(20)
    expect(getWorkspaceId(project, 0)).toBe('spreadsheet:project')
    expect(getWorkspaceId(project, 19)).toBe('spreadsheet:project')
    expect(getSeriesMilestone(project, 0).hasSolution).toBe(false)
  })

  it('gives every series a stable, unique id', () => {
    const ids = VUE_STUDIO_SERIES.map(series => series.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('Vue Studio module resolution', () => {
  it('resolves extensionless files and directory index modules', () => {
    const available = {
      'src/composables/usePosts.ts': 'url:posts',
      'src/widgets/index.vue': 'url:widgets',
    }

    expect(resolveModulePath('./composables/usePosts', 'src/App.vue', available))
      .toBe('src/composables/usePosts.ts')
    expect(resolveModulePath('./widgets', 'src/App.vue', available))
      .toBe('src/widgets/index.vue')
  })

  it('rewrites extensionless imports to their compiled module URL', () => {
    const code = "import { usePosts } from './composables/usePosts'"
    const rewritten = rewriteImports(code, 'src/App.vue', {
      'src/composables/usePosts.ts': 'blob:posts',
    })

    expect(rewritten).toBe("import { usePosts } from 'blob:posts'")
  })

  it('includes extensionless TypeScript imports in the dependency graph', () => {
    const files = {
      'src/App.vue': "import { usePosts } from './composables/usePosts'",
      'src/composables/usePosts.ts': 'export function usePosts() {}',
    }

    expect(computeDependencyGraph(files).edges).toContainEqual({
      from: 'src/App.vue',
      to: 'src/composables/usePosts.ts',
    })
  })

  it.each(SPREADSHEET_MILESTONES)('$title contains no missing local imports', milestone => {
    for (const [filename, source] of Object.entries(milestone.files)) {
      for (const match of source.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
        expect(
          resolveModulePath(match[1], filename, milestone.files),
          `${filename} imports ${match[1]}`,
        ).toBeTruthy()
      }
    }
  })
})
