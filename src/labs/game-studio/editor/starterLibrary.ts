// The bundled starter art (starter/, Kenney, CC0; see starter/CREDITS.md), as a
// browsable library. Vite turns each image into a URL that works in development, on
// GitHub Pages and in the desktop app. Nothing is downloaded until it is shown or added.

const URLS = import.meta.glob('../starter/**/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

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
