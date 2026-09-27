import { ADVANCED_SIM_SNIPPETS } from './simAdvancedSnippets.js'
import { CORE_SNIPPET_WALKTHROUGHS } from './simSnippetWalkthroughs.js'
import { THREE_LEARNING_SNIPPETS } from './simThreeLearningSnippets.js'

const canvasLoop = (setup, draw) => `${setup}

function init() {}

function update(dt) {
  ctx.fillStyle = '#02060f'
  ctx.fillRect(0, 0, W, H)
  ${draw}
}`

const threeLoop = (setup, init, update = 'renderer.render(scene, camera)') => `${setup}

function init() {
  ${init}
}

function update(dt) {
  ${update}
}`

const CORE_SIM_SNIPPETS = [
  {
    category: 'Physics',
    color: 'text-sky-400',
    items: [
      {
        key: 'euler-step',
        label: 'Euler step',
        summary: 'Advance velocity from acceleration, then position from the new velocity.',
        explanation: [
          '`dt` is elapsed time in seconds, so the motion stays consistent across frame rates.',
          'This is semi-implicit Euler: updating velocity first is usually more stable for simple mechanics.',
          'Declare the state variables outside `update()` so they survive from one frame to the next.',
        ],
        code: `// Euler integration
vx += ax * dt
vy += ay * dt
x  += vx * dt
y  += vy * dt`,
        mode: '2d',
        previewCode: canvasLoop(
          `let x = 60, y = 50, vx = 115, vy = 0
const ax = 0, ay = 150`,
          `vx += ax * dt
  vy += ay * dt
  x += vx * dt
  y += vy * dt
  if (y > H - 24) { y = H - 24; vy *= -0.76 }
  if (x > W + 20) x = -20
  ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2)
  ctx.fillStyle = '#38bdf8'; ctx.fill()`
        ),
      },
      {
        key: 'rk4',
        label: 'RK4 (1D)',
        summary: 'Estimate four slopes during one time step and blend them for a more accurate result.',
        explanation: [
          '`accel(y, v)` supplies the differential equation; RK4 stays reusable because it does not hard-code the force.',
          'The midpoint samples (`k2` and `k3`) correct the rough first estimate, while `k4` checks the end of the step.',
          'Use this when Euler drift is visibly changing the energy or shape of a simulation.',
        ],
        code: `function rk4(y, v, accel, dt) {
  const k1v = accel(y, v), k1y = v
  const k2v = accel(y+k1y*dt/2, v+k1v*dt/2), k2y = v+k1v*dt/2
  const k3v = accel(y+k2y*dt/2, v+k2v*dt/2), k3y = v+k2v*dt/2
  const k4v = accel(y+k3y*dt, v+k3v*dt), k4y = v+k3v*dt
  return {
    y: y + dt/6*(k1y+2*k2y+2*k3y+k4y),
    v: v + dt/6*(k1v+2*k2v+2*k3v+k4v)
  }
}`,
        mode: '2d',
        previewCode: canvasLoop(
          `function rk4(y, v, accel, dt) {
  const k1v=accel(y,v), k1y=v
  const k2v=accel(y+k1y*dt/2,v+k1v*dt/2), k2y=v+k1v*dt/2
  const k3v=accel(y+k2y*dt/2,v+k2v*dt/2), k3y=v+k2v*dt/2
  const k4v=accel(y+k3y*dt,v+k3v*dt), k4y=v+k3v*dt
  return { y:y+dt/6*(k1y+2*k2y+2*k3y+k4y), v:v+dt/6*(k1v+2*k2v+2*k3v+k4v) }
}
let y = 1, v = 0, trace = []
const accel = (position) => -8 * position`,
          `const next = rk4(y, v, accel, Math.min(dt, 0.03)); y = next.y; v = next.v
  trace.push(y); if (trace.length > W) trace.shift()
  ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2; ctx.beginPath()
  trace.forEach((value, i) => { const px = W - trace.length + i, py = H/2 - value * H/3; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py) })
  ctx.stroke()`
        ),
      },
      {
        key: 'spring-force',
        label: 'Spring force',
        summary: 'Combine Hooke’s restoring force with damping that opposes velocity.',
        explanation: [
          '`-k * (x - rest)` pulls the object back toward the rest position.',
          '`-b * vx` removes energy, preventing the spring from oscillating forever.',
          'Divide the resulting force by mass to obtain acceleration before integrating.',
        ],
        code: `const k = 10, b = 0.4, rest = 0
const F = -k*(x - rest) - b*vx`,
        mode: '2d',
        previewCode: canvasLoop(
          `const k=10, b=0.8, rest=0, mass=1
let x=1.6, vx=0`,
          `const F = -k*(x-rest)-b*vx
  vx += F/mass*dt; x += vx*dt
  const anchor=W/2, px=anchor+x*70
  ctx.strokeStyle='#64748b'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(anchor, H/2); ctx.lineTo(px,H/2); ctx.stroke()
  ctx.beginPath(); ctx.arc(px,H/2,18,0,Math.PI*2); ctx.fillStyle='#38bdf8'; ctx.fill()`
        ),
      },
      {
        key: 'gravity-two-body',
        label: 'Gravity (2-body)',
        summary: 'Compute the magnitude and direction of Newtonian gravity between two bodies.',
        explanation: [
          'The inverse-square term makes the force four times weaker when distance doubles.',
          'Dividing the displacement by `r` creates a unit direction vector.',
          'Real simulations should guard against `r = 0` with a small minimum distance or softening term.',
        ],
        code: `const G = 6.674e-11
function gravForce(p1, m1, p2, m2) {
  const dx = p2.x-p1.x, dy = p2.y-p1.y
  const r  = Math.hypot(dx, dy)
  const f  = G*m1*m2 / (r*r)
  return { fx: f*dx/r, fy: f*dy/r }
}`,
        mode: '2d',
        previewCode: canvasLoop(
          `const G=1200, center={x:0,y:0}, m1=30, m2=1
let p={x:150,y:0}, v={x:0,y:88}
function gravForce(p1,m1,p2,m2){const dx=p2.x-p1.x,dy=p2.y-p1.y,r=Math.max(8,Math.hypot(dx,dy)),f=G*m1*m2/(r*r);return{fx:f*dx/r,fy:f*dy/r}}`,
          `const F=gravForce(p,m2,center,m1); v.x+=F.fx/m2*dt; v.y+=F.fy/m2*dt; p.x+=v.x*dt; p.y+=v.y*dt
  ctx.save(); ctx.translate(W/2,H/2)
  ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.fillStyle='#f59e0b'; ctx.fill()
  ctx.beginPath(); ctx.arc(p.x,p.y,8,0,Math.PI*2); ctx.fillStyle='#38bdf8'; ctx.fill(); ctx.restore()`
        ),
      },
      {
        key: 'bounce',
        label: 'Bounce',
        summary: 'Resolve a floor collision by correcting penetration and reversing velocity.',
        explanation: [
          'Position correction prevents the object from remaining below the floor.',
          'The negative sign reverses direction; `0.75` is restitution, so each bounce loses energy.',
          'Apply gravity and integrate position before running this collision check.',
        ],
        code: `if (pos.y < 0.3) {
  pos.y = 0.3
  vel.y *= -0.75
}`,
        mode: '2d',
        previewCode: canvasLoop(
          `const pos={y:40}, vel={y:0}; const gravity=240`,
          `vel.y += gravity*dt; pos.y += vel.y*dt
  const floor=H-30
  if(pos.y>floor){pos.y=floor;vel.y*=-0.75}
  ctx.fillStyle='#334155';ctx.fillRect(0,floor+12,W,18)
  ctx.beginPath();ctx.arc(W/2,pos.y,12,0,Math.PI*2);ctx.fillStyle='#fb7185';ctx.fill()`
        ),
      },
    ],
  },
  {
    category: 'Canvas 2D',
    color: 'text-emerald-400',
    items: [
      {
        key: 'canvas-clear', label: 'Clear', summary: 'Paint a fresh background over the entire canvas each frame.',
        explanation: ['Canvas retains old pixels until you clear or cover them.', 'Using a fill instead of `clearRect` lets you choose the scene background color.'],
        code: `ctx.fillStyle = '#02060f'
ctx.fillRect(0, 0, W, H)`, mode: '2d',
        previewCode: canvasLoop('let t=0', `t+=dt; ctx.fillStyle='#0f172a';ctx.fillRect(0,0,W,H);ctx.fillStyle='#34d399';ctx.fillRect(30+(Math.sin(t)*0.5+0.5)*(W-100),H/2-24,48,48)`),
      },
      {
        key: 'canvas-circle', label: 'Circle', summary: 'Build a circular path and fill its interior.',
        explanation: ['`arc` uses radians; `0` through `2π` draws a full circle.', '`beginPath()` prevents earlier path segments from being filled too.'],
        code: `ctx.beginPath()
ctx.arc(cx, cy, r, 0, Math.PI*2)
ctx.fillStyle = '#44aaff'
ctx.fill()`, mode: '2d',
        previewCode: canvasLoop('', `const cx=W/2,cy=H/2,r=Math.min(W,H)*0.18;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle='#44aaff';ctx.fill()`),
      },
      {
        key: 'canvas-line', label: 'Line', summary: 'Create and stroke a path between two points.',
        explanation: ['`moveTo` positions the path cursor without drawing.', '`lineWidth` and `strokeStyle` affect the next `stroke()` call.'],
        code: `ctx.beginPath()
ctx.moveTo(x1, y1)
ctx.lineTo(x2, y2)
ctx.strokeStyle = '#ffffff'
ctx.lineWidth = 2
ctx.stroke()`, mode: '2d',
        previewCode: canvasLoop('let t=0', `t+=dt;const x1=40,y1=H-40,x2=W-40,y2=H/2+Math.sin(t*2)*H/4;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke()`),
      },
      {
        key: 'canvas-dashed', label: 'Dashed line', summary: 'Temporarily switch the stroke pattern to alternating dash and gap lengths.',
        explanation: ['The array is `[dash length, gap length]` in pixels.', 'Reset to `[]` afterward so later drawing is not accidentally dashed.'],
        code: `ctx.setLineDash([6, 4])
ctx.beginPath()
ctx.moveTo(x1, y1)
ctx.lineTo(x2, y2)
ctx.stroke()
ctx.setLineDash([])`, mode: '2d',
        previewCode: canvasLoop('', `ctx.setLineDash([10,6]);ctx.beginPath();ctx.moveTo(30,H/2);ctx.lineTo(W-30,H/2);ctx.strokeStyle='#34d399';ctx.lineWidth=3;ctx.stroke();ctx.setLineDash([])`),
      },
      {
        key: 'canvas-grid', label: 'Grid', summary: 'Generate evenly spaced vertical and horizontal guide lines.',
        explanation: ['Two loops keep the horizontal and vertical passes easy to modify.', 'A subdued stroke color keeps the grid behind the simulation data.'],
        code: `const step = 50
ctx.strokeStyle = '#0a1825'; ctx.lineWidth = 1
for (let x = 0; x < W; x += step) {
  ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke()
}
for (let y = 0; y < H; y += step) {
  ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke()
}`, mode: '2d',
        previewCode: canvasLoop('', `const step=40;ctx.strokeStyle='#164e63';ctx.lineWidth=1;for(let x=0;x<W;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}`),
      },
      {
        key: 'canvas-axes', label: 'Axes', summary: 'Draw x and y axes through the center of the viewport.',
        explanation: ['The canvas origin is top-left, so `H / 2` is the visual x-axis.', 'Store `ox` and `oy` when you later need to convert mathematical coordinates into pixels.'],
        code: `const ox = W/2, oy = H/2
ctx.strokeStyle = '#1e3a50'; ctx.lineWidth = 2
ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.stroke()
ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke()`, mode: '2d',
        previewCode: canvasLoop('', `const ox=W/2,oy=H/2;ctx.strokeStyle='#38bdf8';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,oy);ctx.lineTo(W,oy);ctx.stroke();ctx.beginPath();ctx.moveTo(ox,0);ctx.lineTo(ox,H);ctx.stroke()`),
      },
    ],
  },
  {
    category: 'Three.js',
    color: 'text-violet-400',
    items: [
      {
        key: 'three-sphere', label: 'Sphere', summary: 'Create a sphere mesh by pairing geometry with a light-reactive material.',
        explanation: ['Geometry defines vertices; material defines how the surface is shaded.', 'Adding the mesh to `scene` makes it available to the renderer.'],
        code: `const mesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.5, 16, 16),
  new THREE.MeshPhongMaterial({ color: 0x44aaff, emissive: 0x112233 })
)
scene.add(mesh)`, mode: '3d',
        previewCode: threeLoop('let mesh', `mesh=new THREE.Mesh(new THREE.SphereGeometry(2,32,32),new THREE.MeshPhongMaterial({color:0x44aaff,emissive:0x112233}));scene.add(mesh);camera.position.set(0,1,7)`, `mesh.rotation.y+=dt;renderer.render(scene,camera)`),
      },
      {
        key: 'three-box', label: 'Box', summary: 'Create a box mesh with a physically based standard material.',
        explanation: ['The three geometry arguments are width, height, and depth.', '`MeshStandardMaterial` needs scene lighting, which Sim Lab supplies by default.'],
        code: `const box = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xff8800 })
)
scene.add(box)`, mode: '3d',
        previewCode: threeLoop('let box', `box=new THREE.Mesh(new THREE.BoxGeometry(2.5,2.5,2.5),new THREE.MeshStandardMaterial({color:0xff8800}));scene.add(box);camera.position.set(4,3,7);camera.lookAt(0,0,0)`, `box.rotation.x+=dt*.4;box.rotation.y+=dt*.7;renderer.render(scene,camera)`),
      },
      {
        key: 'three-trail', label: 'Trail line', summary: 'Store recent positions and rebuild a line through them.',
        explanation: ['Clone positions before storing them so old trail points do not move with the object.', 'Limit the array length to prevent memory and geometry from growing forever.', 'For large systems, update one buffer in place instead of recreating geometry every frame.'],
        code: `trail.push(new THREE.Vector3(x, y, z))
if (trail.length > 300) trail.shift()
if (trailLine) scene.remove(trailLine)
trailLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints(trail),
  new THREE.LineBasicMaterial({ color: 0x00ffcc })
)
scene.add(trailLine)`, mode: '3d',
        previewCode: threeLoop('let orb,trail=[],trailLine,t=0', `orb=new THREE.Mesh(new THREE.SphereGeometry(.25,16,16),new THREE.MeshPhongMaterial({color:0x00ffcc}));scene.add(orb);camera.position.set(0,5,11);camera.lookAt(0,0,0)`, `t+=dt;orb.position.set(Math.cos(t)*3,Math.sin(t*2),Math.sin(t)*3);trail.push(orb.position.clone());if(trail.length>180)trail.shift();if(trailLine)scene.remove(trailLine);trailLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(trail),new THREE.LineBasicMaterial({color:0x00ffcc}));scene.add(trailLine);renderer.render(scene,camera)`),
      },
      {
        key: 'three-light', label: 'Point light', summary: 'Emit light in every direction from one position.',
        explanation: ['Intensity controls brightness and distance limits the effective range.', 'A visible helper or small emissive mesh makes an otherwise invisible light easier to position.'],
        code: `const light = new THREE.PointLight(0xffffff, 1.5, 50)
light.position.set(5, 10, 5)
scene.add(light)`, mode: '3d',
        previewCode: threeLoop('let light,t=0', `const floor=new THREE.Mesh(new THREE.PlaneGeometry(14,14),new THREE.MeshStandardMaterial({color:0x172033,roughness:.8}));floor.rotation.x=-Math.PI/2;scene.add(floor);const ball=new THREE.Mesh(new THREE.SphereGeometry(1,24,24),new THREE.MeshStandardMaterial({color:0x64748b}));ball.position.y=1;scene.add(ball);light=new THREE.PointLight(0x38bdf8,3,20);scene.add(light);camera.position.set(7,6,9);camera.lookAt(0,1,0)`, `t+=dt;light.position.set(Math.cos(t)*4,3,Math.sin(t)*4);renderer.render(scene,camera)`),
      },
      {
        key: 'three-grid', label: 'Grid', summary: 'Add a ground-plane reference grid for scale and orientation.',
        explanation: ['The first argument is total size and the second is the number of divisions.', 'The final colors control the center lines and ordinary grid lines.'],
        code: `scene.add(new THREE.GridHelper(40, 20, 0x1a2a44, 0x0d1122))`, mode: '3d',
        previewCode: threeLoop('', `scene.add(new THREE.GridHelper(40,20,0x38bdf8,0x1e293b));camera.position.set(9,8,12);camera.lookAt(0,0,0)`),
      },
    ],
  },
  {
    category: 'Math',
    color: 'text-amber-400',
    items: [
      {
        key: 'math-clamp', label: 'Clamp', summary: 'Constrain a value to a closed minimum–maximum interval.',
        explanation: ['The inner `Math.min` caps the upper end; the outer `Math.max` raises the lower end.', 'Useful for bounded controls, colors, speeds, and interpolation factors.'],
        code: `const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))`, mode: '2d',
        previewCode: canvasLoop('const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));let t=0', `t+=dt;const raw=(Math.sin(t)*.8+.5)*W;const x=clamp(raw,60,W-60);ctx.strokeStyle='#475569';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(60,H/2);ctx.lineTo(W-60,H/2);ctx.stroke();ctx.beginPath();ctx.arc(x,H/2,13,0,Math.PI*2);ctx.fillStyle=raw===x?'#f59e0b':'#fb7185';ctx.fill()`),
      },
      {
        key: 'math-lerp', label: 'Lerp', summary: 'Move a fraction `t` of the way from value `a` to value `b`.',
        explanation: ['At `t = 0` the result is `a`; at `t = 1` it is `b`.', 'Animating `t` gives smooth position, color, camera, and parameter transitions.'],
        code: `const lerp = (a, b, t) => a + (b - a) * t`, mode: '2d',
        previewCode: canvasLoop('const lerp=(a,b,t)=>a+(b-a)*t;let time=0', `time+=dt;const t=Math.sin(time)*.5+.5,x=lerp(50,W-50,t);ctx.beginPath();ctx.arc(x,H/2,14,0,Math.PI*2);ctx.fillStyle='#f59e0b';ctx.fill()`),
      },
      {
        key: 'math-polar', label: 'Polar → XY', summary: 'Convert a radius and angle into Cartesian coordinates.',
        explanation: ['Cosine supplies the horizontal component and sine supplies the vertical component.', 'Add an origin offset when drawing because these coordinates are centered on `(0, 0)`.'],
        code: `const x = r * Math.cos(theta)
const y = r * Math.sin(theta)`, mode: '2d',
        previewCode: canvasLoop('let theta=0;const r=90', `theta+=dt;const x=r*Math.cos(theta),y=r*Math.sin(theta);ctx.save();ctx.translate(W/2,H/2);ctx.strokeStyle='#475569';ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(x,y);ctx.strokeStyle='#f59e0b';ctx.stroke();ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.fillStyle='#fbbf24';ctx.fill();ctx.restore()`),
      },
      {
        key: 'math-normalize', label: 'Normalize 2D', summary: 'Keep a vector’s direction while changing its length to one.',
        explanation: ['Divide each component by the vector magnitude.', 'The `|| 1` guard avoids division by zero for a zero-length vector.', 'Multiply the result by a speed when you need direction and magnitude separately.'],
        code: `function normalize(vx, vy) {
  const len = Math.hypot(vx, vy) || 1
  return { x: vx/len, y: vy/len }
}`, mode: '2d',
        previewCode: canvasLoop('function normalize(vx,vy){const len=Math.hypot(vx,vy)||1;return{x:vx/len,y:vy/len}};let t=0', `t+=dt;const raw={x:Math.cos(t)*120,y:Math.sin(t*1.7)*70},n=normalize(raw.x,raw.y);ctx.save();ctx.translate(W/2,H/2);ctx.strokeStyle='#64748b';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(raw.x,raw.y);ctx.stroke();ctx.strokeStyle='#f59e0b';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(n.x*90,n.y*90);ctx.stroke();ctx.restore()`),
      },
      {
        key: 'math-rotate', label: 'Rotation matrix 2D', summary: 'Rotate a point around the origin without changing its distance.',
        explanation: ['The sine and cosine terms are the 2D rotation matrix written component by component.', 'Angles use radians and positive canvas y points downward, which can make visual rotation appear reversed.'],
        code: `function rotate2d(x, y, angle) {
  const c = Math.cos(angle), s = Math.sin(angle)
  return { x: c*x - s*y, y: s*x + c*y }
}`, mode: '2d',
        previewCode: canvasLoop('function rotate2d(x,y,a){const c=Math.cos(a),s=Math.sin(a);return{x:c*x-s*y,y:s*x+c*y}};let angle=0', `angle+=dt;const p=rotate2d(110,0,angle);ctx.save();ctx.translate(W/2,H/2);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(p.x,p.y);ctx.strokeStyle='#f59e0b';ctx.lineWidth=4;ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,10,0,Math.PI*2);ctx.fillStyle='#fbbf24';ctx.fill();ctx.restore()`),
      },
      {
        key: 'math-matrix4', label: '4×4 identity', summary: 'Create a transform that leaves positions, rotations, and scales unchanged.',
        explanation: ['Identity is the neutral element of matrix multiplication.', 'Start with it when you want to compose transforms incrementally or reset an object matrix.'],
        code: `const I = new THREE.Matrix4().identity()`, mode: '3d',
        previewCode: threeLoop('let cube,t=0;const I=new THREE.Matrix4().identity()', `cube=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshStandardMaterial({color:0xf59e0b,wireframe:true}));cube.applyMatrix4(I);scene.add(cube);camera.position.set(4,3,7);camera.lookAt(0,0,0)`, `t+=dt;cube.rotation.set(t*.25,t*.4,0);renderer.render(scene,camera)`),
      },
    ],
  },
]

const CATEGORY_DEFAULTS = {
  Physics: { level: 'Intermediate', kind: 'Technique', concepts: ['simulation', 'motion'] },
  'Canvas 2D': { level: 'Beginner', kind: 'Drawing', concepts: ['Canvas 2D', 'paths'] },
  'Three.js': { level: 'Beginner', kind: 'Three.js', concepts: ['scene graph', 'rendering'] },
  Math: { level: 'Beginner', kind: 'Math lab', concepts: ['math', 'vectors'] },
}

const enrichedCore = CORE_SIM_SNIPPETS.map(category => ({
  ...category,
  items: category.items.map(item => ({
    ...CATEGORY_DEFAULTS[category.category],
    ...item,
    walkthrough: CORE_SNIPPET_WALKTHROUGHS[item.key],
  })),
}))

export const SIM_SNIPPETS = [
  ...enrichedCore,
  ...ADVANCED_SIM_SNIPPETS,
  ...THREE_LEARNING_SNIPPETS,
]
export const DEFAULT_SIM_SNIPPET = SIM_SNIPPETS[0].items[0]
