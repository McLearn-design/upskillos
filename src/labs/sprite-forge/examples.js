// Example sprites, made by code on the sprite API (spriteApi.js), as Tile Mapper's maps and Game Studio's
// games are. Opening one makes an empty sprite and runs its code as one edit, so the Code panel shows how it
// was drawn, and Ctrl+Z empties it again. Colours are the PICO-8 palette's: 0 is transparent and n is the
// nth swatch (3 dark purple, 8 white, 9 red, 10 orange, 11 yellow).

export const EXAMPLES = [
  {
    id: 'heart',
    title: 'A heart, from its curve',
    about: 'Every pixel whose centre is inside the curve (x² + y² − 1)³ − x²y³ ≤ 0 is red; one with an outside neighbour is the outline.',
    width: 16,
    height: 16,
    code: `// Inside the heart curve? (x, y) are the pixel's centre, scaled to about −1.3 to 1.3, with y up.
const inside = (px, py) => {
  const x = ((px + 0.5) / sprite.width - 0.5) * 2.6
  const y = (0.45 - (py + 0.5) / sprite.height) * 2.6
  return (x * x + y * y - 1) ** 3 - x * x * y ** 3 <= 0
}
const pixels = []
for (let y = 0; y < sprite.height; y++) {
  for (let x = 0; x < sprite.width; x++) {
    if (!inside(x, y)) continue
    // A pixel with a neighbour outside the curve is on its edge.
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)
    pixels.push([x, y, edge ? 3 : 9])
  }
}
sprite.paint(0, pixels)
sprite.paint(0, [[4, 4, 8], [5, 4, 8], [4, 5, 8]])   // a shine`,
  },
  {
    id: 'coin',
    title: 'A spinning coin',
    about: 'Four frames of a coin turning: its width is the full width times |cos θ|, for θ = 0°, 45°, 80° and 135°, so it narrows and widens as a turning disc does.',
    width: 16,
    height: 16,
    code: `const angles = [0, 45, 80, 135]
for (let f = 1; f < angles.length; f++) sprite.addFrame(f - 1)
angles.forEach((degrees, f) => {
  // An ellipse: half-height 7, half-width 7·|cos θ| (at least half a pixel, so the edge-on coin shows).
  const a = Math.max(0.5, 7 * Math.abs(Math.cos(degrees * Math.PI / 180))), b = 7
  const pixels = []
  for (let y = 0; y < sprite.height; y++) {
    for (let x = 0; x < sprite.width; x++) {
      const dx = (x + 0.5 - 8) / a, dy = (y + 0.5 - 8) / b
      const d = dx * dx + dy * dy
      if (d <= 1) pixels.push([x, y, d > 0.55 ? 10 : 11])   // orange rim, yellow face
    }
  }
  sprite.paint(f, pixels)
})
sprite.durations(120)
sprite.tags([{ name: 'spin', from: 0, to: 3 }])`,
  },
]
