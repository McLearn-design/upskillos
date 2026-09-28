# Create a course from YAML

The YAML course workflow gives humans and coding agents one commented source file to fill out. The converter checks its structure and creates the folder layout the app already discovers. It does not add a second runtime content format: learners still receive normal JavaScript lessons that the Lesson Builder can open.

## Start a course

1. Copy [`docs/templates/course-template.yaml`](../templates/course-template.yaml) to `course-sources/<course-id>.yaml`. Commit that source file with the generated course so later contributors know what to edit.
2. Replace every `replace-with...` placeholder. Keep published lesson IDs permanent.
3. Preview the generated paths without writing files:

   ```bash
   npm run course:create -- course-sources/<course-id>.yaml --dry-run
   ```

4. Generate the course:

   ```bash
   npm run course:create -- course-sources/<course-id>.yaml
   ```

5. Open each lesson in the app and test it as a learner. A valid schema cannot prove that an explanation, visualization, or exercise teaches the idea well.

The first generation refuses to overwrite existing files. To regenerate after editing the YAML, use `--force`, then review the Git diff before keeping it:

```bash
npm run course:create -- course-sources/<course-id>.yaml --force
```

## What the converter checks

- course, chapter, and lesson slugs use lowercase kebab-case;
- chapter numbers, lesson orders, routes, and IDs do not collide inside the YAML;
- lesson IDs do not already exist in the generated project ID map;
- required catalog metadata, hooks, and intuition prose exist;
- multiple-choice answers exactly match one of their options;
- existing files are preserved unless `--force` is explicit.

It warns when a lesson has fewer than three worked examples, fewer than three challenges, or no mastery goals. The complete teaching requirements remain in [`docs/lesson-writing-standard.md`](../lesson-writing-standard.md).

## Check the result

Run the normal content checks after generation:

```bash
npm run facts
node scripts/validate-lesson-schema.mjs src/courses/<course>/<chapter>/<lesson>.js
node scripts/check_python_cells.mjs --files src/courses/<course>/<chapter>/<lesson>.js
npm run catalog:check
```

Use the Python check only for lessons containing Python cells. Also run the JavaScript and LaTeX checks when the course contains those kinds of content. Generated catalog files from `npm run facts` belong in the same change as the new course.
