// The tile sheets of the starter art Game Studio bundles (Kenney, CC0), with their tile sizes, so a map can
// use one with nothing to set: the tileset dialog's Starter art tab, and the examples.
import { buildTileset, fileToDataUrl, loadImage } from './tileset.js'

const STARTER_URLS = import.meta.glob('../game-studio/starter/*/{tilemap,tilesheet}/*.png', { eager: true, query: '?url', import: 'default' })
export const STARTER_SHEETS = [
  { file: 'tiny-dungeon/tilemap/tilemap_packed.png', name: 'Tiny Dungeon', tile: 16, about: 'walls, floors, doors, items, heroes and monsters' },
  { file: 'pixel-platformer/tilemap/tilemap_packed.png', name: 'Pixel Platformer', tile: 18, about: 'ground, platforms, ladders, coins, signs' },
  { file: 'pixel-platformer/tilemap/tilemap-backgrounds_packed.png', name: 'Pixel Platformer backgrounds', tile: 24, about: 'sky, hills and clouds' },
  { file: 'top-down-shooter/tilesheet/tilesheet_complete.png', name: 'Top-down Shooter', tile: 64, about: 'floors, walls and props seen from above' },
].map((s) => ({ ...s, url: STARTER_URLS[`../game-studio/starter/${s.file}`] })).filter((s) => s.url)

/** A starter sheet as a tileset: the picture read into the map (a data URL), cut at its known tile size. */
export async function starterTileset(sheet) {
  const dataUrl = await fileToDataUrl(await (await fetch(sheet.url)).blob())
  const img = await loadImage(dataUrl)
  return buildTileset({ dataUrl, imageWidth: img.naturalWidth, imageHeight: img.naturalHeight, tileW: sheet.tile, tileH: sheet.tile, name: sheet.file.split('/').pop() })
}
