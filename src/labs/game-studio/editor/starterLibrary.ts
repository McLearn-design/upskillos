// The bundled starter art (starter/, Kenney, CC0; see starter/CREDITS.md), as a
// browsable library. Vite turns each image into a URL that works in development, on
// GitHub Pages and in the desktop app. Nothing is downloaded until it is shown or added.

const URLS = import.meta.glob('../starter/**/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
// Tiled sample maps and their tilesets, as text. A tileset file (.tsx) is stored with ".xml" added,
// so TypeScript does not take it for code; its name here is the one the map uses.
const MAPS = import.meta.glob('../starter/**/*.{tmx,tmj}', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const TILESET_FILES = import.meta.glob('../starter/**/*.{tsx.xml,tsj}', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

export interface StarterImage {
  /** Where it goes in a project: assets/<pack>/<folder>/<file>. */
  path: string;
  url: string;
  name: string;
}

export interface StarterFolder { name: string; images: StarterImage[] }
export interface StarterPack { id: string; title: string; about: string; folders: StarterFolder[] }

const ABOUT: Record<string, { title: string; about: string }> = {
  'pixel-platformer': { title: 'Pixel Platformer', about: '18 × 18 pixel tiles, characters and backgrounds for a side-on platformer.' },
  'tiny-dungeon': { title: 'Tiny Dungeon', about: '16 × 16 dungeon tiles, heroes and monsters: walls, floors, doors, items.' },
  'top-down-shooter': { title: 'Top-down Shooter', about: 'Characters seen from above, holding weapons, and the tile sheets for their floors.' },
  'puzzle-pack': { title: 'Puzzle Pack', about: 'Paddles, balls and bricks: everything a Breakout needs, and pieces for puzzles.' },
  'ui-pack': { title: 'UI Pack', about: 'Buttons, panels, bars and icons for menus and a HUD.' },
};

let cache: StarterPack[] | null = null;

/** The packs, their folders and images, in a stable order. */
export function starterPacks(): StarterPack[] {
  if (cache) return cache;
  const packs = new Map<string, Map<string, StarterImage[]>>();
  for (const [file, url] of Object.entries(URLS).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
    const [pack, folder, name] = file.replace(/^\.\.\/starter\//, '').split('/');
    if (!name) continue;
    if (!packs.has(pack)) packs.set(pack, new Map());
    const f = packs.get(pack)!;
    if (!f.has(folder)) f.set(folder, []);
    f.get(folder)!.push({ path: `assets/${pack}/${folder}/${name}`, url, name });
  }
  cache = [...packs].map(([id, folders]) => ({
    id, title: ABOUT[id]?.title ?? id, about: ABOUT[id]?.about ?? '',
    folders: [...folders].map(([name, images]) => ({ name, images })),
  }));
  return cache;
}

export function starterImage(path: string): StarterImage | undefined {
  for (const p of starterPacks()) for (const f of p.folders) for (const i of f.images) if (i.path === path) return i;
  return undefined;
}

export interface StarterMap {
  pack: string;
  name: string;
  text: string;
  /** Tileset files beside it, by the name the map uses. */
  tilesets: Map<string, string>;
  /** The starter images its tilesets use, to add to the project first. */
  images: StarterImage[];
}

/** Resolve "a/b/../c/d.png" to "a/c/d.png". */
function normal(path: string): string {
  const out: string[] = [];
  for (const p of path.split('/')) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
  return out.join('/');
}

/** The Tiled sample maps of a pack. */
export function starterMaps(packId: string): StarterMap[] {
  const out: StarterMap[] = [];
  for (const [file, text] of Object.entries(MAPS)) {
    const rel = file.replace(/^\.\.\/starter\//, ''), [pack] = rel.split('/');
    if (pack !== packId) continue;
    const dir = rel.split('/').slice(0, -1).join('/');
    const tilesets = new Map<string, string>(), images: StarterImage[] = [];
    for (const [tf, tt] of Object.entries(TILESET_FILES)) if (tf.startsWith(`../starter/${dir}/`)) tilesets.set(tf.split('/').pop()!.replace(/\.xml$/, ''), tt);
    // The images: each tileset's image path is relative to the file it is written in.
    const sources = [...text.matchAll(/<tileset[^>]*source="([^"]+)"/g)].map((m) => m[1]);
    for (const [name, tt] of tilesets) if (sources.includes(name)) for (const m of tt.matchAll(/<image[^>]*source="([^"]+)"/g)) {
      const want = normal(`${dir}/${m[1]}`).toLowerCase();
      const hit = starterPacks().flatMap((p) => p.folders.flatMap((f) => f.images)).find((img) => img.path.replace(/^assets\//, '').toLowerCase() === want);
      if (hit) images.push(hit);
    }
    out.push({ pack, name: rel.split('/').pop()!, text, tilesets, images });
  }
  return out;
}
