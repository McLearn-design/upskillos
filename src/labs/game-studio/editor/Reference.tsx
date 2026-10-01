// The API reference, docked beside the viewport: every class, property, method and global
// a script can use, with Godot's name for each, and the Scene API that GUI → code writes.
// Its contents come from core/apiReference.ts, which the tests check against the engine.
//
// store.reference is the entry showing: '' is the contents page, "CharacterBody2D" an entry,
// and "CharacterBody2D#isOnFloor" an entry scrolled to one member.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API_REFERENCE, FIRST_SCRIPT, SCENE_API, ancestors, apiEntry, signature, type ApiEntry, type ApiMember } from '../core/apiReference';
import type { Store } from './store';
import { C, useStore } from './kit';

const GROUPS: [string, string[]][] = [
  ['Nodes', ['Node', 'Node2D', 'Sprite2D', 'AnimatedSprite2D', 'AnimationPlayer', 'TileMapLayer', 'Camera2D', 'Label', 'CanvasLayer', 'CollisionShape2D', 'PhysicsBody2D', 'StaticBody2D', 'CharacterBody2D', 'RigidBody2D', 'Area2D']],
  ['Values and globals', ['Vec2', 'input', 'scene', 'time', 'physics', 'math', 'console']],
  ['Building a project (GUI → code)', SCENE_API.map((e) => e.name)],
];

const link: React.CSSProperties = { color: C.accent, cursor: 'pointer' };
const mono: React.CSSProperties = { fontFamily: C.mono, fontSize: 12 };

function Code({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ margin: '6px 0 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
        <span style={{ flex: 1, color: C.faint, fontSize: 11 }}>Example</span>
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }); }}
          style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 3, color: C.dim, fontSize: 11, cursor: 'pointer' }}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <pre style={{ ...mono, margin: 0, padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, overflowX: 'auto', color: C.text, lineHeight: 1.45 }}>{text}</pre>
    </div>
  );
}

function Member({ x, owner, go, highlight }: { x: ApiMember; owner: string; go: (to: string) => void; highlight: boolean }) {
  // Types in its signature that have an entry of their own.
  const refs = [...new Set(x.type.match(/\b[A-Z]\w+\b/g) ?? [])].filter((n) => n !== owner && apiEntry(n));
  return (
    <div id={`ref-${owner}-${x.name}`} data-testid={`ref-member-${x.name}`} style={{ padding: '6px 8px', borderRadius: 4, background: highlight ? '#5aa9ff22' : 'transparent', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ ...mono, color: C.text, wordBreak: 'break-word' }}>
        {signature(x)}
        {x.inspector && <span title="Also in the Inspector" style={{ marginLeft: 6, fontFamily: 'inherit', fontSize: 10, color: C.ok, border: `1px solid ${C.ok}55`, borderRadius: 3, padding: '0 3px' }}>Inspector</span>}
      </div>
      <div style={{ color: C.dim, marginTop: 2 }}>{x.doc}</div>
      {x.godot && <div style={{ color: C.faint, marginTop: 2 }}>Godot: <span style={mono}>{x.godot}</span></div>}
      {refs.length > 0 && <div style={{ color: C.faint, marginTop: 2 }}>See {refs.map((r, i) => <React.Fragment key={r}>{i > 0 && ', '}<span style={link} onClick={() => go(r)}>{r}</span></React.Fragment>)}</div>}
    </div>
  );
}

function Entry({ e, go, focus }: { e: ApiEntry; go: (to: string) => void; focus: string }) {
  const chain = ancestors(e);
  const sections: [string, ApiMember[]][] = [
    ['Properties', e.members.filter((x) => x.kind === 'property')],
    ['Methods', e.members.filter((x) => x.kind === 'method')],
    ['Write these: the engine calls them', e.members.filter((x) => x.kind === 'callback')],
  ];
  return (
    <div data-testid={`ref-entry-${e.name}`}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ ...mono, fontSize: 16, color: C.text }}>{e.name}</b>
        <span style={{ color: C.faint }}>{e.kind === 'class' ? 'class' : e.builtin ? 'JavaScript global' : 'global'}</span>
        {chain.length > 1 && (
          <span style={{ color: C.faint }}>extends {chain.slice(1).map((a, i) => (
            <React.Fragment key={a.name}>{i > 0 && ' › '}<span style={link} onClick={() => go(a.name)}>{a.name}</span></React.Fragment>
          ))}</span>
        )}
      </div>
      {e.godot && <div style={{ color: C.faint, margin: '2px 0' }}>Godot: <span style={mono}>{e.godot}</span></div>}
      <p style={{ color: C.dim, margin: '6px 0' }}>{e.doc}</p>
      {e.example && <Code text={e.example} />}
      {sections.filter(([, list]) => list.length).map(([title, list]) => (
        <div key={title} style={{ marginBottom: 8 }}>
          <div style={{ color: C.text, fontWeight: 600, fontSize: 11, letterSpacing: 0.4, margin: '8px 0 2px' }}>{title.toUpperCase()}</div>
          {list.map((x) => <Member key={x.name} x={x} owner={e.name} go={go} highlight={focus === x.name} />)}
        </div>
      ))}
      {chain.slice(1).map((a) => (
        <div key={a.name} style={{ color: C.faint, margin: '6px 0' }}>
          From <span style={link} onClick={() => go(a.name)}>{a.name}</span>:{' '}
          {a.members.map((x, i) => (
            <React.Fragment key={x.name}>{i > 0 && ', '}<span style={{ ...link, ...mono, fontSize: 11 }} onClick={() => go(`${a.name}#${x.name}`)}>{x.name}</span></React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}

function SceneEntry({ name, focus }: { name: string; focus: string }) {
  const e = SCENE_API.find((x) => x.name === name)!;
  return (
    <div data-testid={`ref-entry-${e.name}`}>
      <b style={{ ...mono, fontSize: 16, color: C.text }}>{e.name}</b> <span style={{ color: C.faint }}>building a project</span>
      <p style={{ color: C.dim, margin: '6px 0' }}>{e.doc}</p>
      <p style={{ color: C.faint, margin: '6px 0' }}>This is the language of the GUI → code panel and of the example games’ build code. It changes the project in the editor; a running game’s scripts use the Game API instead.</p>
      {e.members.map((x) => (
        <div key={x.name} id={`ref-${e.name}-${x.name}`} style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, background: focus === x.name ? '#5aa9ff22' : 'transparent' }}>
          <div style={{ ...mono, color: C.text }}>{x.name}{x.type.startsWith('(') ? x.type : `: ${x.type}`}</div>
          <div style={{ color: C.dim, marginTop: 2 }}>{x.doc}</div>
        </div>
      ))}
    </div>
  );
}

function Contents({ go }: { go: (to: string) => void }) {
  return (
    <div>
      <p style={{ color: C.dim, margin: '0 0 8px' }}>
        A script is a JavaScript class that extends the type of the node it is attached to. The engine calls its{' '}
        <span style={link} onClick={() => go('Node#ready')}>ready()</span> once,{' '}
        <span style={link} onClick={() => go('Node#physicsUpdate')}>physicsUpdate(dt)</span> 60 times a second, and{' '}
        <span style={link} onClick={() => go('Node#update')}>update(dt)</span> every frame. Inside, <span style={mono}>this</span> is the node.
      </p>
      <Code text={FIRST_SCRIPT} />
      <p style={{ color: C.dim, margin: '0 0 10px' }}>
        <b style={{ color: C.text }}>Coming from Godot?</b> The nodes and how they behave follow Godot’s, with names in camelCase:{' '}
        <span style={mono}>move_and_slide()</span> is <span style={mono}>moveAndSlide()</span>, <span style={mono}>_physics_process(delta)</span> is{' '}
        <span style={mono}>physicsUpdate(dt)</span>, <span style={mono}>$Sprite</span> is <span style={mono}>this.get(&apos;Sprite&apos;)</span>, and a signal like{' '}
        <span style={mono}>body_entered</span> is a method you write, <span style={mono}>bodyEntered(body)</span>. Every entry gives the Godot name.
      </p>
      {GROUPS.map(([title, names]) => (
        <div key={title} style={{ marginBottom: 10 }}>
          <div style={{ color: C.text, fontWeight: 600, fontSize: 11, letterSpacing: 0.4, marginBottom: 4 }}>{title.toUpperCase()}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {names.map((n) => (
              <button key={n} type="button" data-testid={`ref-open-${n}`} onClick={() => go(n)} style={{ ...mono, fontSize: 11, background: C.raised, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, cursor: 'pointer', padding: '2px 6px' }}>{n}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface Hit { to: string; label: string; doc: string }

function search(q: string): Hit[] {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  const hits: Hit[] = [];
  const has = (...s: (string | undefined)[]) => s.some((x) => x?.toLowerCase().includes(t));
  for (const e of API_REFERENCE) {
    if (has(e.name, e.godot)) hits.push({ to: e.name, label: e.name, doc: e.doc });
    else if (has(e.example)) hits.push({ to: e.name, label: `${e.name} (in its example)`, doc: e.doc });
    for (const x of e.members) if (has(x.name, x.godot, x.doc)) hits.push({ to: `${e.name}#${x.name}`, label: `${e.name}.${x.name}`, doc: x.doc });
  }
  for (const e of SCENE_API) for (const x of e.members) if (has(x.name, x.doc)) hits.push({ to: `${e.name}#${x.name}`, label: `${e.name}.${x.name}`, doc: x.doc });
  // Names first, then the rest.
  const byName = (h: Hit) => (h.label.toLowerCase().split('.').pop()!.startsWith(t) ? 0 : h.label.toLowerCase().includes(t) ? 1 : 2);
  return hits.sort((a, b) => byName(a) - byName(b)).slice(0, 60);
}

export function Reference({ store }: { store: Store }) {
  useStore(store);
  const [q, setQ] = useState('');
  const body = useRef<HTMLDivElement>(null);
  const at = store.reference ?? '';
  const [name, focus = ''] = at.split('#');
  const hits = useMemo(() => search(q), [q]);
  const go = (to: string) => { setQ(''); store.showReference(to); };

  useEffect(() => {
    const el = focus ? document.getElementById(`ref-${name}-${focus}`) : null;
    if (el) el.scrollIntoView({ block: 'center' }); else body.current?.scrollTo({ top: 0 });
  }, [name, focus]);

  const entry = apiEntry(name);
  const sceneEntry = SCENE_API.some((e) => e.name === name);
  return (
    <div data-testid="reference" style={{ width: 440, maxWidth: '45%', display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${C.border}`, background: C.panel, fontSize: 12, lineHeight: 1.5, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderBottom: `1px solid ${C.border}`, background: C.panel2 }}>
        <span role="link" onClick={() => go('')} title="Contents" style={{ fontWeight: 700, color: C.text, cursor: 'pointer', whiteSpace: 'nowrap' }}>API reference</span>
        <input data-testid="reference-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: jump, velocity, get_node, body_entered…" spellCheck={false}
          style={{ flex: 1, minWidth: 0, background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 12, padding: '2px 6px' }} />
        <button type="button" onClick={() => { store.reference = null; store.changed(); }} title="Close the reference" style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 14 }}>×</button>
      </div>
      <div ref={body} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 10px' }}>
        {q.trim() ? (
          hits.length ? hits.map((h) => (
            <div key={h.to} data-testid={`ref-hit-${h.to}`} onClick={() => go(h.to)} style={{ padding: '5px 6px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.raised; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ ...mono, color: C.accent }}>{h.label}</div>
              <div style={{ color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.doc}</div>
            </div>
          )) : <div style={{ color: C.faint }}>Nothing matches &ldquo;{q}&rdquo;.</div>
        ) : entry ? <Entry e={entry} go={go} focus={focus} />
          : sceneEntry ? <SceneEntry name={name} focus={focus} />
          : <Contents go={go} />}
      </div>
    </div>
  );
}
