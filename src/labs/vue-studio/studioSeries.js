import { MILESTONES } from './milestones/index.js'
import { VUE_LESSONS } from './lessons/lessonLoader.js'
import { SPREADSHEET_LESSONS } from './series/spreadsheet/seriesLoader.js'
import { SPREADSHEET_MILESTONES } from './series/spreadsheet/milestones/index.js'

// A studio series separates teaching content from workspace behavior:
// - milestones: each lesson owns a fresh starter/reference workspace
// - project: every lesson teaches against one cumulative saved workspace
// Keeping this contract in one registry lets future studio-style labs reuse the
// same learner modes without coupling navigation to a particular course.

export const SPREADSHEET_PROJECT = {
  id: 'spreadsheet-project',
  title: 'Spreadsheet project workspace',
  objective: 'Build one spreadsheet cumulatively across the full project series.',
  concepts: [],
  starter: {
    'src/App.vue': `<script setup lang="ts">
</script>

<template>
  <main class="workspace">
    <h1>Spreadsheet project</h1>
    <p>Open Lesson 01 and replace this starter as you build.</p>
  </main>
</template>

<style scoped>
.workspace {
  padding: 24px;
  font-family: system-ui, sans-serif;
}
</style>`,
    'src/main.ts': `import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')`,
  },
  why: {
    'src/App.vue': `## Your cumulative project

The spreadsheet course builds one application over twenty lessons. This workspace is deliberately persistent: moving between lessons does not replace your files with an unrelated example.

Start with Lesson 01, make each change in the editor, and keep building on the same files. **Reset** returns only this project workspace to its original two-file starter.`,
    'src/main.ts': `## Why main.ts exists

This is the application's entry point. It imports the root component, creates the Vue application, and mounts it into the preview page. Most lessons will leave this file unchanged.`,
  },
  hasSolution: false,
}

function checkpointLesson(milestone) {
  const concepts = (milestone.concepts ?? [])
    .map(({ label }) => `- ${label}`)
    .join('\n')

  return {
    slug: `checkpoint-${String(milestone.number).padStart(2, '0')}-${milestone.id}`,
    title: milestone.title,
    content: `# Spreadsheet checkpoint ${String(milestone.number).padStart(2, '0')} — ${milestone.title}

## What this checkpoint demonstrates

${milestone.objective}

This is a runnable reference project. Read the files, run the preview, change the code, and use the **Why this file** tab to inspect the architectural reasoning recorded for individual files.

## Concepts to inspect

${concepts || '- Explore the implementation and its component boundaries.'}

## A useful way to study it

1. Run the project and use the feature in the preview.
2. Open **Components**, **Reactive State**, and **Dep Graph** to see its structure.
3. Predict which file owns a behavior before searching for it.
4. Change one small thing and run again.
5. Reset the checkpoint when you want its clean reference implementation back.

These checkpoints are a feature gallery. They are separate from the twenty-lesson cumulative spreadsheet course because the two collections describe different build sequences.`,
  }
}

export const VUE_STUDIO_SERIES = [
  {
    id: 'intro',
    label: 'Vue Essentials',
    sublabel: 'Guided exercises with a fresh starter and solution for every lesson',
    badge: 'Guided',
    emoji: '🟢',
    lessons: VUE_LESSONS,
    workspace: { type: 'milestones', milestones: MILESTONES },
  },
  {
    id: 'spreadsheet',
    label: 'Build a Spreadsheet',
    sublabel: 'One persistent project built across 20 lessons, from first component to deployment',
    badge: 'Project',
    emoji: '📊',
    lessons: SPREADSHEET_LESSONS,
    workspace: { type: 'project', milestone: SPREADSHEET_PROJECT },
  },
  {
    id: 'spreadsheet-checkpoints',
    label: 'Spreadsheet Checkpoints',
    sublabel: 'Runnable reference builds for exploring complete spreadsheet features',
    badge: 'Explore',
    emoji: '🧭',
    lessons: SPREADSHEET_MILESTONES.map(checkpointLesson),
    workspace: { type: 'milestones', milestones: SPREADSHEET_MILESTONES },
  },
]

export function getStudioSeries(seriesId) {
  return VUE_STUDIO_SERIES.find(series => series.id === seriesId) ?? VUE_STUDIO_SERIES[0]
}

export function getSeriesMilestone(series, lessonIndex = 0) {
  if (series.workspace.type === 'project') return series.workspace.milestone
  const milestones = series.workspace.milestones
  return milestones[Math.max(0, Math.min(milestones.length - 1, lessonIndex))]
}

export function getWorkspaceId(series, lessonIndex = 0) {
  const milestone = getSeriesMilestone(series, lessonIndex)
  return series.workspace.type === 'project'
    ? `${series.id}:project`
    : `${series.id}:${milestone.id}`
}
