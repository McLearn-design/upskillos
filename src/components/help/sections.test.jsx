// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SectionHome } from './sections/Home.jsx'
import { SectionOverview } from './sections/Overview.jsx'
import { SectionFirstLesson } from './sections/FirstLesson.jsx'
import { SectionAnatomy } from './sections/Anatomy.jsx'
import { SectionTypes } from './sections/Types.jsx'
import { SectionFormatting } from './sections/Formatting.jsx'
import { SectionOpencalc } from './sections/Opencalc.jsx'
import { SectionUseViz } from './sections/UseViz.jsx'
import { SectionBuildViz } from './sections/BuildViz.jsx'
import { SectionStandards } from './sections/Standards.jsx'
import { SectionAIPrompts } from './sections/AIPrompts.jsx'
import { SectionTroubleshooting } from './sections/Troubleshooting.jsx'
import { SectionAbout } from './sections/About.jsx'
import * as templates from './lessonTemplates.js'

// A section that uses a component it never imports only fails when it is opened, so the
// production build does not catch it. Rendering each one does. (Feedback needs the desktop
// and Firebase providers and is left out.)
const SECTIONS = {
  SectionHome, SectionOverview, SectionFirstLesson, SectionAnatomy, SectionTypes,
  SectionFormatting, SectionOpencalc, SectionUseViz, SectionBuildViz, SectionStandards,
  SectionAIPrompts, SectionTroubleshooting, SectionAbout,
}

afterEach(cleanup)

describe('Help sections', () => {
  for (const [name, Section] of Object.entries(SECTIONS)) {
    it(`${name} renders`, () => {
      const { container } = render(<MemoryRouter><Section onNavigate={() => {}} onSelectSection={() => {}} /></MemoryRouter>)
      expect(container.textContent.length).toBeGreaterThan(50)
    })
  }
})

describe('downloadable templates', () => {
  it('lesson templates are complete files, not fragments with broken escapes', () => {
    // The Math and Python templates once failed to parse: an escape inside the template
    // literal turned into a bare quote or a real line break in the downloaded file.
    for (const name of ['TPL_MATH', 'TPL_PYTHON', 'TPL_PROOF']) {
      const text = templates[name]
      expect(text, name).toMatch(/export default \{/)
      expect(text, name).not.toMatch(/\.join\('\n'\)/)        // must be '\n' as two characters
      expect(text, name).toMatch(/quiz: \[|assessment: \{/)
    }
  })
})
