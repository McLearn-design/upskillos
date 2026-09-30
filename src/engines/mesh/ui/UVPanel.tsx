// The UV layout: where each face lands in the texture square.
import React, { useMemo } from 'react';
import type { Editor } from '../core/Editor';
import { angleDistortion, uvFits } from '../core/uv';
import { textureRGBA, type TextureName } from '../core/shading';
import { Btn, C, useEditorVersion } from './kit';

/** A procedural texture as an image URL, for the panel's background. */
function textureURL(name: TextureName): string | null {
  if (typeof document === 'undefined' || name === 'none') return null;
  const size = 128, px = textureRGBA(name, size), cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  // Texture rows run v upward; the image's rows run downward.
  for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL();
}

export function UVPanel({ editor }: { editor: Editor }) {
  useEditorVersion(editor);
  const o = editor.editObject ?? editor.activeObject;
  const mesh = o?.mesh;
  const tex = o?.material.texture && o.material.texture !== 'none' ? o.material.texture : 'checker';
  const bg = useMemo(() => textureURL(tex), [tex]);
  if (!o || !mesh) return <div style={{ padding: 14, color: C.faint }}>Select a mesh to see its UVs.</div>;
  const fits = uvFits(mesh, o.uv);
  const selF = new Set(editor.mode === 'edit' ? editor.selectedFaces() : []);
  const dist = fits ? Array.from(angleDistortion(mesh, o.uv!)) : [];
  const mean = dist.length ? dist.reduce((a, b) => a + b, 0) / dist.length : 0;
  const S = 300;
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ padding: 10, flexShrink: 0 }}>
        <svg data-testid="uv-layout" width={S} height={S} viewBox="0 0 1 1" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
          {bg && <image href={bg} x={0} y={0} width={1} height={1} preserveAspectRatio="none" opacity={0.55} />}
          {fits && o.uv!.faces.map((f, fi) => (
            <polygon key={fi} points={f.map(([u, v]) => `${u},${1 - v}`).join(' ')} fill={selF.has(fi) ? 'rgba(255,159,28,0.45)' : 'rgba(90,169,255,0.08)'} stroke={selF.has(fi) ? C.accent : '#e8eef7'} strokeWidth={selF.has(fi) ? 0.004 : 0.002} />
          ))}
          {!fits && <text x={0.5} y={0.5} fill={C.faint} fontSize={0.045} textAnchor="middle">{o.uv ? 'the mesh changed: unwrap again' : 'no UVs yet'}</text>}
        </svg>
      </div>
      <div style={{ flex: 1, padding: '10px 14px', overflowY: 'auto', fontSize: 12, color: C.dim, lineHeight: 1.6 }}>
        <b style={{ color: C.text }}>UVs of {o.name}</b>
        <div>{fits ? `${o.uv!.faces.length} faces in the square; ${(o.seams ?? []).filter((k) => mesh.edges().has(k)).length} seam edges; angle distortion mean ${mean.toFixed(3)}, worst ${Math.max(...dist).toFixed(3)} (1 = angles kept).` : 'Mark seams where the surface should be cut, then unwrap.'}</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '8px 0' }}>
          <Btn small onClick={() => editor.seamsFromSharp(60)} title="Every edge sharper than 60°: the usual start for boxy models">Seams from sharp edges</Btn>
          <Btn small disabled={editor.mode !== 'edit'} onClick={() => editor.markSeams(true)} title="Edit mode, edge select: mark the selected edges">Mark seam</Btn>
          <Btn small disabled={editor.mode !== 'edit'} onClick={() => editor.markSeams(false)}>Clear seam</Btn>
          <Btn small active onClick={() => editor.unwrap('lscm')} title="U in edit mode">Unwrap (LSCM)</Btn>
          <Btn small onClick={() => editor.unwrap('planar')} title="Project straight down onto the x–z plane: for terrain">Project from above</Btn>
          <Btn small disabled={!fits} onClick={() => editor.showField({ kind: 'uv' }, o.id)}>Distortion heat map</Btn>
        </div>
        <div style={{ color: C.faint }}>
          The square is the texture; each outline is a face, placed where its corners' UVs say. Faces selected in edit mode are orange.
          A closed surface cannot lie flat without cuts (the seams, red in edit mode). LSCM keeps angles as well as the cuts allow, so a checker stays square;
          it cannot also keep areas where the surface is curved, which is why a sphere's poles come out larger or smaller.
        </div>
      </div>
    </div>
  );
}
