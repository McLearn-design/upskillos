#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load as parseYaml } from 'js-yaml'
import { lessonToState } from '../src/components/lesson-builder/builderUtils.js'
import { serializeLesson } from '../src/components/lesson-builder/lessonSerializer.js'

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const REPO_ROOT = resolve(dirname(SCRIPT_PATH), '..')
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const COLORS = new Set(['indigo', 'blue', 'emerald', 'red', 'purple', 'orange', 'teal', 'amber', 'sky', 'cyan', 'rose', 'violet', 'lime', 'slate', 'fuchsia', 'green', 'pink', 'yellow'])
const DOMAINS = new Set(['math', 'cs', 'science', 'engineering', 'creative', 'data', 'other'])

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requiredString(value, path, errors) {
  if (typeof value !== 'string' || !value.trim()) errors.push(`${path} must be a non-empty string`)
}

function validateChoice(question, path, errors) {
  if (!isObject(question) || question.type !== 'choice') return
  if (!Array.isArray(question.options) || question.options.length < 2) {
    errors.push(`${path}.options must contain at least two choices`)
  } else if (!question.options.includes(question.answer)) {
    errors.push(`${path}.answer must exactly match one option`)
  }
}

/** Validate the authoring document before any files are written. */
export function validateCourseDocument(document) {
  const errors = []
  const warnings = []

  if (!isObject(document)) return { errors: ['YAML root must be a mapping'], warnings }
  if (document.schemaVersion !== 1) errors.push('schemaVersion must be 1')
  if (!isObject(document.course)) errors.push('course must be a mapping')

  const course = document.course ?? {}
  requiredString(course.id, 'course.id', errors)
  requiredString(course.label, 'course.label', errors)
  requiredString(course.description, 'course.description', errors)
  requiredString(course.icon, 'course.icon', errors)
  if (typeof course.id === 'string' && !SLUG.test(course.id)) errors.push('course.id must be a lowercase kebab-case slug')
  if (course.id === 'replace-with-course-id') errors.push('replace the template course.id before generating the course')
  if (/replace(?:-with| this| me)/i.test(JSON.stringify(document))) warnings.push('template placeholder text remains; review it before publishing')
  if (!COLORS.has(course.color)) errors.push(`course.color must be one of: ${[...COLORS].join(', ')}`)
  if (!DOMAINS.has(course.domain)) errors.push(`course.domain must be one of: ${[...DOMAINS].join(', ')}`)

  if (!Array.isArray(document.chapters) || document.chapters.length === 0) {
    errors.push('chapters must contain at least one chapter')
    return { errors, warnings }
  }

  const chapterNumbers = new Set()
  const lessonIds = new Set()
  const routeKeys = new Set()

  document.chapters.forEach((chapter, chapterIndex) => {
    const chapterPath = `chapters[${chapterIndex}]`
    if (!isObject(chapter)) {
      errors.push(`${chapterPath} must be a mapping`)
      return
    }
    if (!Number.isInteger(chapter.number) || chapter.number < 1) errors.push(`${chapterPath}.number must be a positive integer`)
    if (chapterNumbers.has(chapter.number)) errors.push(`${chapterPath}.number duplicates chapter ${chapter.number}`)
    chapterNumbers.add(chapter.number)
    requiredString(chapter.slug, `${chapterPath}.slug`, errors)
    if (typeof chapter.slug === 'string' && !SLUG.test(chapter.slug)) errors.push(`${chapterPath}.slug must be lowercase kebab-case`)
    if (!Array.isArray(chapter.lessons) || chapter.lessons.length === 0) {
      errors.push(`${chapterPath}.lessons must contain at least one lesson`)
      return
    }

    const orders = new Set()
    const slugs = new Set()
    chapter.lessons.forEach((lesson, lessonIndex) => {
      const path = `${chapterPath}.lessons[${lessonIndex}]`
      if (!isObject(lesson)) {
        errors.push(`${path} must be a mapping`)
        return
      }
      requiredString(lesson.id, `${path}.id`, errors)
      requiredString(lesson.slug, `${path}.slug`, errors)
      requiredString(lesson.title, `${path}.title`, errors)
      if (!Number.isInteger(lesson.order) || lesson.order < 1) errors.push(`${path}.order must be a positive integer`)
      if (orders.has(lesson.order)) errors.push(`${path}.order duplicates order ${lesson.order} in this chapter`)
      if (slugs.has(lesson.slug)) errors.push(`${path}.slug duplicates "${lesson.slug}" in this chapter`)
      if (lessonIds.has(lesson.id)) errors.push(`${path}.id duplicates "${lesson.id}" in this YAML file`)
      orders.add(lesson.order)
      slugs.add(lesson.slug)
      lessonIds.add(lesson.id)

      if (typeof lesson.slug === 'string' && !SLUG.test(lesson.slug)) errors.push(`${path}.slug must be lowercase kebab-case`)
      const routeKey = `${course.id}-${chapter.number}/${lesson.slug}`
      if (routeKeys.has(routeKey)) errors.push(`${path} duplicates route ${routeKey}`)
      routeKeys.add(routeKey)

      if (!isObject(lesson.hook) || typeof lesson.hook.question !== 'string' || !lesson.hook.question.trim()) {
        errors.push(`${path}.hook.question must introduce the lesson with a non-empty question`)
      }
      if (!isObject(lesson.intuition) || !Array.isArray(lesson.intuition.prose) || lesson.intuition.prose.length === 0) {
        errors.push(`${path}.intuition.prose must contain at least one paragraph`)
      }

      const questions = [
        ...(Array.isArray(lesson.quiz) ? lesson.quiz : []),
        ...(Array.isArray(lesson.assessment?.questions) ? lesson.assessment.questions : []),
      ]
      questions.forEach((question, questionIndex) => validateChoice(question, `${path}.questions[${questionIndex}]`, errors))

      if (!Array.isArray(lesson.examples) || lesson.examples.length < 3) warnings.push(`${path} has fewer than three worked examples`)
      if (!Array.isArray(lesson.challenges) || lesson.challenges.length < 3) warnings.push(`${path} has fewer than three challenges`)
      if (!isObject(lesson.mastery)) warnings.push(`${path} does not declare mastery goals`)
    })
  })

  return { errors, warnings }
}

function lessonObject(courseId, chapter, lesson) {
  return {
    ...lesson,
    chapter: lesson.chapter ?? `${courseId}-${chapter.number}`,
  }
}

/** Turn a validated course document into paths and file contents without touching disk. */
export function buildCourseFiles(document, repoRoot = REPO_ROOT) {
  const course = document.course
  const courseRoot = resolve(repoRoot, 'src', 'courses', course.id)
  const files = [{
    path: resolve(courseRoot, 'meta.json'),
    content: `${JSON.stringify({
      label: course.label,
      icon: course.icon,
      description: course.description,
      color: course.color,
      domain: course.domain,
    }, null, 2)}\n`,
  }]

  for (const chapter of document.chapters) {
    const chapterFolder = `${chapter.number}-${chapter.slug}`
    for (const lesson of chapter.lessons) {
      const value = lessonObject(course.id, chapter, lesson)
      const chapterId = `${course.id}-${chapter.number}`
      const state = lessonToState(value, chapterId, lesson.slug)
      const filename = `${String(lesson.order).padStart(3, '0')}-${lesson.slug}.js`
      files.push({ path: resolve(courseRoot, chapterFolder, filename), content: serializeLesson(state) })
    }
  }
  return files
}

function findPublishedIdConflicts(document, repoRoot) {
  const idFile = resolve(repoRoot, 'src', 'data', 'lessonIds.json')
  if (!existsSync(idFile)) return []
  const published = Object.entries(JSON.parse(readFileSync(idFile, 'utf8')))
  const plannedRoutes = new Map(document.chapters.flatMap(chapter => chapter.lessons.map(lesson => [
    `${document.course.id}-${chapter.number}/${lesson.slug}`,
    lesson.id,
  ])))
  const plannedIds = new Set(plannedRoutes.values())
  const conflicts = published
    .filter(([route, id]) => plannedIds.has(id) && plannedRoutes.get(route) !== id)
    .map(([route, id]) => `${id} is already used by ${route}`)
  for (const [route, id] of plannedRoutes) {
    const publishedId = published.find(([publishedRoute]) => publishedRoute === route)?.[1]
    if (publishedId && publishedId !== id) {
      conflicts.push(`${route} is published as ${publishedId}; its permanent id cannot change to ${id}`)
    }
  }
  return conflicts
}

export function generateCourse(document, { repoRoot = REPO_ROOT, dryRun = false, force = false } = {}) {
  const result = validateCourseDocument(document)
  if (result.errors.length) throw new Error(`Course YAML is invalid:\n- ${result.errors.join('\n- ')}`)

  const idConflicts = findPublishedIdConflicts(document, repoRoot)
  if (idConflicts.length) throw new Error(`Published lesson ID conflict:\n- ${idConflicts.join('\n- ')}`)

  const files = buildCourseFiles(document, repoRoot)
  const existing = files.filter(file => existsSync(file.path))
  if (existing.length && !force) {
    throw new Error(`Refusing to overwrite existing files:\n- ${existing.map(file => relative(repoRoot, file.path)).join('\n- ')}\nRun again with --force only after reviewing those files.`)
  }

  if (!dryRun) {
    for (const file of files) {
      mkdirSync(dirname(file.path), { recursive: true })
      writeFileSync(file.path, file.content)
    }
  }
  return { files, warnings: result.warnings }
}

export function loadCourseYaml(filename) {
  let document
  try {
    document = parseYaml(readFileSync(filename, 'utf8'))
  } catch (error) {
    throw new Error(`Could not read YAML: ${error.message}`)
  }
  return document
}

function usage() {
  return `Usage: node scripts/course-from-yaml.mjs <course.yaml> [--dry-run] [--force]\n\n` +
    `  --dry-run  Validate and list output files without writing them.\n` +
    `  --force    Replace files that already exist. Review the diff afterward.`
}

function main() {
  const args = process.argv.slice(2)
  const sourceArg = args.find(arg => !arg.startsWith('--'))
  if (!sourceArg || args.includes('--help') || args.includes('-h')) {
    console.log(usage())
    process.exit(sourceArg ? 0 : 1)
  }
  const unknown = args.filter(arg => arg.startsWith('--') && !['--dry-run', '--force'].includes(arg))
  if (unknown.length) throw new Error(`Unknown option: ${unknown.join(', ')}\n${usage()}`)

  const source = resolve(process.cwd(), sourceArg)
  const document = loadCourseYaml(source)
  const dryRun = args.includes('--dry-run')
  const { files, warnings } = generateCourse(document, { dryRun, force: args.includes('--force') })

  console.log(`✓ ${dryRun ? 'Would generate' : 'Generated'} ${files.length} file(s):`)
  for (const file of files) console.log(`  ${relative(REPO_ROOT, file.path).replaceAll('\\', '/')}`)
  for (const warning of warnings) console.warn(`⚠ ${warning}`)
  if (!dryRun) {
    console.log('\nNext: run `npm run facts`, validate the generated lessons, and open them in the app.')
  }
}

if (resolve(process.argv[1] ?? '') === resolve(SCRIPT_PATH)) {
  try { main() } catch (error) {
    console.error(`✗ ${error.message}`)
    process.exit(1)
  }
}
