// Reading a learner's face list for this course's notebook checks. The check gets the cell's code as a string
// and does not run it (docs/lesson-visualizations-and-notebooks.md: check the thing, not a keyword), so this
// finds `const faces = [ … ]`, written one face per line, and parses it as data.

/** The faces written in the code, or a message saying why they could not be read. */
export function readFaces(code) {
  const m = code.match(/const\s+faces\s*=\s*(\[[\s\S]*?\n\s*\])/);
  if (!m) return { error: 'Keep the list as const faces = [ … ], one face per line.' };
  try {
    const faces = JSON.parse(m[1].replace(/\/\/.*$/gm, '').replace(/,\s*\]/g, ']'));
    if (!Array.isArray(faces) || !faces.every((f) => Array.isArray(f) && f.every(Number.isInteger))) return { error: 'Each face should be a list of vertex numbers, such as [0, 1, 2].' };
    return { faces };
  } catch {
    return { error: 'The face list could not be read: check the brackets and commas.' };
  }
}

/** The edge table: each edge once, under its two vertex numbers smallest first, with the faces on it and which way each walks it. */
export function edgeTable(faces) {
  const table = new Map();
  faces.forEach((f, fi) => f.forEach((a, i) => {
    const b = f[(i + 1) % f.length], key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!table.has(key)) table.set(key, []);
    table.get(key).push({ face: fi, from: a, to: b });
  }));
  return table;
}
