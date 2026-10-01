// Example maps, made by code on the map API (mapApi.js), as Game Studio's examples are made by code on
// its Scene API. Opening one makes an empty map with the example's starter tileset, then runs its code as
// one edit, so the Code panel shows exactly how it was made, and Ctrl+Z empties it again.

const FLOOR = 48, WALL = 40   // Tiny Dungeon: sand floor, grey stone wall

export const EXAMPLES = [
  {
    id: 'dungeon-room',
    title: 'A dungeon room',
    about: 'A floor, a wall all round with a doorway, and a collision layer that marks the walls solid for a game.',
    sheet: 'tiny-dungeon/tilemap/tilemap_packed.png',
    cols: 20,
    rows: 12,
    code: `// A floor everywhere, on the Ground layer.
const floor = []
for (let y = 0; y < map.rows; y++) for (let x = 0; x < map.cols; x++) floor.push([x, y, ${FLOOR}])
map.paint('Ground', floor)

// A wall all round, with a doorway in the bottom wall, on its own layer in front.
map.addLayer('tiles')
map.layer('Layer 3', { name: 'Walls' })
map.moveLayer('Walls', 1)
const walls = []
for (let x = 0; x < map.cols; x++) walls.push([x, 0], [x, map.rows - 1])
for (let y = 1; y < map.rows - 1; y++) walls.push([0, y], [map.cols - 1, y])
const door = Math.floor(map.cols / 2)
const wall = walls.filter(([x, y]) => !(y === map.rows - 1 && (x === door || x === door - 1)))
map.paint('Walls', wall.map(([x, y]) => [x, y, ${WALL}]))

// The same cells, solid, on the collision layer (0 marks a cell solid).
map.paint('Collision', wall.map(([x, y]) => [x, y, 0]))`,
  },
  {
    id: 'maze',
    title: 'A maze, generated',
    about: 'A maze made by a recursive backtracker, a depth-first walk that knocks down walls, written in the Code panel’s own API.',
    sheet: 'tiny-dungeon/tilemap/tilemap_packed.png',
    cols: 21,
    rows: 13,
    code: `// Start all wall: the maze is carved out of it.
const cells = []
for (let y = 0; y < map.rows; y++) for (let x = 0; x < map.cols; x++) cells.push([x, y, ${WALL}])
map.paint('Ground', cells)

// A seeded random number generator, so the same maze comes out every time.
let seed = 7
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647

// Rooms are the odd cells. From (1, 1), walk to a random unvisited room two cells away, knocking
// down the wall between; when there is none, step back. Every room is reached exactly once.
const open = [[1, 1, ${FLOOR}]]
const seen = new Set(['1,1'])
const stack = [[1, 1]]
while (stack.length) {
  const [x, y] = stack[stack.length - 1]
  const next = [[2, 0], [-2, 0], [0, 2], [0, -2]]
    .map(([dx, dy]) => [x + dx, y + dy, dx / 2, dy / 2])
    .filter(([nx, ny]) => nx > 0 && ny > 0 && nx < map.cols - 1 && ny < map.rows - 1 && !seen.has(nx + ',' + ny))
  if (!next.length) { stack.pop(); continue }
  const [nx, ny, hx, hy] = next[Math.floor(random() * next.length)]
  open.push([x + hx, y + hy, ${FLOOR}], [nx, ny, ${FLOOR}])
  seen.add(nx + ',' + ny)
  stack.push([nx, ny])
}
map.paint('Ground', open)

// Walls are solid for a game: every cell still wall.
const isOpen = new Set(open.map(([x, y]) => x + ',' + y))
map.paint('Collision', cells.filter(([x, y]) => !isOpen.has(x + ',' + y)).map(([x, y]) => [x, y, 0]))`,
  },
]
