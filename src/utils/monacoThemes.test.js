import { afterEach, describe, expect, it, vi } from 'vitest'
import { setupOpenCalcMonaco } from './monacoThemes.js'

afterEach(() => {
  vi.useRealTimers()
})

describe('setupOpenCalcMonaco', () => {
  it('configures a frozen Monaco module namespace once without mutating it', () => {
    vi.useFakeTimers()
    const defineTheme = vi.fn()
    const register = vi.fn()
    const setLanguageConfiguration = vi.fn()
    const setMonarchTokensProvider = vi.fn()
    const setCompilerOptions = vi.fn()
    const addExtraLib = vi.fn()
    const monaco = Object.freeze({
      editor: { defineTheme },
      languages: {
        register,
        setLanguageConfiguration,
        setMonarchTokensProvider,
        IndentAction: { Indent: 1, Outdent: 2 },
        typescript: {
          JsxEmit: { React: 2 },
          typescriptDefaults: {
            getCompilerOptions: () => ({}),
            setCompilerOptions,
            addExtraLib,
          },
        },
      },
    })

    expect(() => setupOpenCalcMonaco(monaco)).not.toThrow()
    const themeCount = defineTheme.mock.calls.length
    setupOpenCalcMonaco(monaco)

    expect(themeCount).toBeGreaterThan(0)
    expect(defineTheme).toHaveBeenCalledTimes(themeCount)
    expect(register).toHaveBeenCalledTimes(1)
  })
})
