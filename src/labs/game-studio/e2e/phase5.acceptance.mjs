// Game Studio Phase 5: animation made in the editor, playing in the game.
// Drags in two starter pictures, adds an AnimatedSprite2D, builds an animation in the
// Inspector (add, pictures, speed, rename), undoes the rename in one step. Then adds an
// AnimationPlayer: keys the sprite's position with ◆ at 0 s, scrubs to 2 s and types a new x
// (which becomes a key, not the node's own value), scrubs to 1 s and reads the value halfway,
// turns on autoplay, runs the game, and reads the frame and the position changing in it.
//
//   node src/labs/game-studio/e2e/phase5.acceptance.mjs   (starts and stops its own server)

import { withGameStudio } from './harness.mjs';

const PP = 'assets/pixel-platformer/characters';
const failed = await withGameStudio(5191, async ({ page, t, check }) => {
  const store = (fn) => page.evaluate(fn);
  await t('new-project-name').fill('Animation');
  await t('create-project').click();
  await t('new-scene').click(); await t('new-scene-name').fill('main'); await t('new-scene-name').press('Enter');

  // Two pictures of the green character, from the starter art.
  await t('left-art').click();
  await t('starter-pack').selectOption('pixel-platformer');
  await t('starter-folder').selectOption('characters');
  for (const f of ['tile_0000', 'tile_0001']) {
    await t(`starter-${PP}/${f}.png`).dragTo(t('viewport'));
    await page.waitForFunction((p) => window.__gameStudio.store.project.assets.some((a) => a.path === p), `${PP}/${f}.png`);
  }

  // An AnimatedSprite2D, and an animation built in the Inspector.
  await t('add-node').selectOption('AnimatedSprite2D');
  await t('tree-AnimatedSprite2D').click();
  await t('frames-add-animation').click();
  await t('frames-add-picture-0').selectOption(`${PP}/tile_0000.png`);
  await t('frames-add-picture-0').selectOption(`${PP}/tile_0001.png`);
  await t('frames-fps-0').fill('4'); await t('frames-fps-0').press('Enter');
  const node = () => store(() => {
    const find = (n) => (n.type === 'AnimatedSprite2D' ? n : n.children.map(find).find(Boolean));
    return find(window.__gameStudio.store.scene.root).props;
  });
  let props = await node();
  check('An animation with two pictures at 4 fps', props.frames?.length === 1 && props.frames[0].frames.length === 2 && props.frames[0].fps === 4 && (await t('frames-thumb-0-1').count()) === 1, JSON.stringify(props.frames));

  // Renaming the animation that is showing renames it in `animation` too, as one undo step.
  await t('frames-name-0').fill('walk'); await t('frames-name-0').press('Enter');
  props = await node();
  const renamed = props.frames[0].name === 'walk' && props.animation === 'walk';
  await page.keyboard.press('Escape');
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await store(() => window.__gameStudio.store.doc.undo());
  props = await node();
  const undone = props.frames[0].name === 'default' && props.animation === undefined;
  await store(() => window.__gameStudio.store.doc.redo());
  props = await node();
  check('Rename changes the animation shown too, and undoes in one step', renamed && undone && props.animation === 'walk');
  const code = await store(() => window.__gameStudio.store.doc.log.map((l) => l.code).join('\n'));
  check('GUI → code shows the animations as code', code.includes('frames = [{ name: "walk", fps: 4, loop: true'), code.split('\n').filter((l) => l.includes('frames')).at(-1));

  // An AnimationPlayer beside it. Selecting it opens the Animation panel.
  await t('tree-Main').click();
  await t('add-node').selectOption('AnimationPlayer');
  await t('tree-AnimationPlayer').click();
  await t('timeline').waitFor();
  await t('anim-new').click();
  await t('anim-length').fill('2'); await t('anim-length').press('Enter');
  const clip = () => store(() => {
    const find = (n) => (n.type === 'AnimationPlayer' ? n : n.children.map(find).find(Boolean));
    return find(window.__gameStudio.store.scene.root).props.animations?.[0];
  });
  check('The Animation panel opens for the player, with a new 2 s animation', (await clip())?.length === 2);

  // Key the sprite's position at 0 s, with the ◆ beside it in the Inspector.
  await t('tree-AnimatedSprite2D').click();
  await t('key-position').click();
  // Scrub to the end of the ruler (2 s), and type x = 300: that sets a key there.
  const ruler = await t('anim-ruler').boundingBox();
  await page.mouse.click(ruler.x + ruler.width - 3, ruler.y + 10);
  await t('prop-position-x').fill('300'); await t('prop-position-x').press('Enter');
  let c = await clip();
  props = await node();
  const keys = c.tracks[0]?.keys.map((k) => `${k.time}:${k.value.x}`).join(' ');
  check('◆ keys a property; editing it at the playhead sets another key, not the node\u2019s own value', c.tracks.length === 1 && c.tracks[0].keys.length === 2 && c.tracks[0].keys[1].value.x === 300 && !props.position, `${c.tracks[0]?.path}.${c.tracks[0]?.property}: ${keys}`);

  // Scrub to the middle: the Inspector (and the viewport) show the scene at 1 s, x half-way.
  await page.mouse.click(ruler.x + 190 + (ruler.width - 190 - 16) / 2, ruler.y + 10);
  const time = await t('anim-time').innerText();
  const shownX = Number(await t('prop-position-x').inputValue());
  check('Scrubbing shows the value between the keys', Math.abs(shownX - 300 * parseFloat(time) / 2) < 1 && Math.abs(parseFloat(time) - 1) < 0.1, `${time}: x = ${shownX}`);

  await t('tree-AnimationPlayer').click();
  await t('anim-autoplay').click();
  await t('anim-loop').click();
  c = await clip();
  await t('tree-AnimatedSprite2D').click();

  // Run: the running game's frame goes 0, 1, 0, 1… (the Inspector's live value).
  await t('run-project').click();
  await page.locator('iframe[title="Running game"]').waitFor({ timeout: 20000 });
  await page.waitForFunction(() => window.__gameStudio.store.output.some((o) => o.text.startsWith('▶')), null, { timeout: 20000 });
  const seen = new Set(), xs = new Set();
  for (let i = 0; i < 16; i++) {
    await store(() => window.__gameStudio.store.refreshLive());
    await page.waitForTimeout(150);
    const live = await store(() => window.__gameStudio.store.running?.live);
    if (live && typeof live.frame === 'number') seen.add(live.frame);
    if (live?.position) xs.add(Math.round(live.position.x));
  }
  check('In the running game, the frame changes', seen.has(0) && seen.has(1), `frames seen: ${[...seen].join(', ')}`);
  check('In the running game, the AnimationPlayer moves the sprite (autoplay, looping)', xs.size >= 4 && Math.max(...xs) <= 300 && Math.min(...xs) >= 0, `x seen: ${[...xs].sort((a, b) => a - b).join(', ')}`);
  const errors = await store(() => window.__gameStudio.store.output.filter((o) => o.level === 'error').map((o) => o.text));
  check('No script or runtime errors', errors.length === 0, errors.join(' | '));
  await t('stop').click();
});
process.exit(failed ? 1 : 0);
