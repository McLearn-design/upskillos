// A small XML reader, enough for Tiled's map and tileset files (.tmx, .tsx): elements, their
// attributes and their text. No namespaces, DTDs or entities beyond the five standard ones.
// Written here rather than using the browser's DOMParser so the model stays plain TypeScript
// that runs (and is tested) in Node too.

export interface XmlElement { name: string; attrs: Record<string, string>; children: XmlElement[]; text: string }

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, e: string) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e] ?? all);

/** The document's root element. Throws, with where, if the text is not well-formed. */
export function parseXml(text: string): XmlElement {
  const stack: XmlElement[] = [{ name: '#document', attrs: {}, children: [], text: '' }];
  const tag = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<!DOCTYPE[^>]*>|<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  let at = 0;
  while ((m = tag.exec(text))) {
    if (m.index !== at) throw new Error(`Not valid XML near character ${at}`);
    at = tag.lastIndex;
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) { top.text += m[1]; continue; }
    if (m[6] !== undefined) { top.text += decode(m[6]); continue; }
    if (!m[3]) continue;   // a comment, declaration or doctype
    if (m[2] === '/') {
      if (top.name !== m[3]) throw new Error(`Not valid XML: </${m[3]}> closes <${top.name}>`);
      stack.pop();
      continue;
    }
    const el: XmlElement = { name: m[3], attrs: {}, children: [], text: '' };
    for (const a of m[4].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) el.attrs[a[1]] = decode(a[2] ?? a[3]);
    top.children.push(el);
    if (!m[5]) stack.push(el);
  }
  if (at !== text.length) throw new Error(`Not valid XML near character ${at}`);
  if (stack.length !== 1) throw new Error(`Not valid XML: <${stack[stack.length - 1].name}> is never closed`);
  const root = stack[0].children[0];
  if (!root) throw new Error('Not valid XML: there is no element');
  return root;
}
