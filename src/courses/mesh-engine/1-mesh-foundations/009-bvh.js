// Mesh Engine 1.9 — BVH / Spatial Indexing
//
// The payoff for lessons 6, 7 and 8. Also the lesson with the most
// uncomfortable measurement in the series: a BVH in interpreted Python tests
// 1.4% of the triangles and is still SLOWER than vectorised brute force until
// the mesh passes about 32,000 triangles.
//
// That is not a reason to hide the number. It is the lesson.
//
// Measured by field-fixes/verify/check-aabb-bvh.py.

const THREE_CDN = '<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"><\/script>';

const ORBIT = `
function orbit(camera, dom, radius) {
  var lon = 40, lat = 26, down = false, px = 0, py = 0;
  function place() {
    var a = lon * Math.PI / 180, b = lat * Math.PI / 180;
    camera.position.set(radius*Math.cos(b)*Math.sin(a), radius*Math.sin(b), radius*Math.cos(b)*Math.cos(a));
    camera.lookAt(0, 0, 0);
  }
  dom.addEventListener('pointerdown', function (e) { down = true; px = e.clientX; py = e.clientY; });
  window.addEventListener('pointerup', function () { down = false; });
  window.addEventListener('pointermove', function (e) {
    if (!down) return;
    lon -= (e.clientX - px) * 0.5;
    lat = Math.max(-85, Math.min(85, lat + (e.clientY - py) * 0.5));
    px = e.clientX; py = e.clientY; place();
  });
  place(); return place;
}`;

const LESSON_MESH_1_9 = {
  title: 'One Test, A Thousand Triangles Dismissed',
  subtitle: 'Boxes in a tree — and an honest look at when it is actually faster.',
  sequential: true,

  cells: [

    {
      type: 'markdown',
      instruction: `### The move that changes the exponent

Lesson 8 put a box round every triangle. It was tighter than a sphere, it was
exact, and it was **still O(n)** — because computing a box distance for every
triangle means touching every triangle.

The fix is embarrassingly simple to state:

> Put a box around a **group** of boxes.

If the box around 4,000 triangles is further away than an answer you already
have, then all 4,000 are further away too, and you have dismissed them with
**one test**. Do that recursively and the work stops being proportional to the
mesh.

That is a **bounding volume hierarchy**, and there are only three parts:

1. **Build** — split the triangles into two groups, recursively, boxing each.
2. **Traverse** — descend the tree, nearest child first.
3. **Prune** — skip any node whose box is already further than the best answer
   so far.

Part 3 is where all the saving lives, and part 2 is what makes part 3 effective:
if you go to the nearest box first, you find a good answer early, and a good
answer prunes everything else.`,
    },

    {
      type: 'js',
      instruction: `### Watch it prune

A mesh, a query point, and the tree built over it. **The boxes it actually
visited are drawn.** Move the point and watch which parts of the tree light up.

The readout counts three things, and the gap between them is the whole lesson:

- **nodes visited** — boxes it had to test
- **triangles tested** — how many times the real lesson-5 solver ran
- **triangles in the mesh** — what brute force would have done

Push the point far away from the mesh and the count drops. Push it right up
against the surface and it drops further still, because the first answer found
is tiny and prunes almost everything.

**Then put the point at the exact centre of the sphere.** The count goes up
sharply — every part of the surface is equidistant, so nothing can be pruned.
That is the same shape of failure as lesson 7's filter at the centre of a hollow
mesh, and it is worth remembering that a hierarchy makes the common case fast
rather than making the worst case good.`,
      html: `${THREE_CDN}
<div style="display:flex;gap:6px;padding:8px 2px;flex-wrap:wrap;align-items:center">
  <button data-p="2.2,0.4,0.3" style="background:#12314f;color:#bfe0ff;border:1px solid #2f6da8;border-radius:4px;padding:4px 9px;cursor:pointer;font:11px ui-monospace,monospace">far outside</button>
  <button data-p="1.02,0,0" style="background:#12314f;color:#bfe0ff;border:1px solid #2f6da8;border-radius:4px;padding:4px 9px;cursor:pointer;font:11px ui-monospace,monospace">just off the surface</button>
  <button data-p="0,0,0" style="background:#3f2226;color:#ffd7d7;border:1px solid #6e3a3f;border-radius:4px;padding:4px 9px;cursor:pointer;font:11px ui-monospace,monospace">dead centre</button>
  <label style="color:#7d8794;font:11px ui-monospace,monospace;margin-left:6px">
    <input id="showboxes" type="checkbox" checked> draw visited boxes
  </label>
</div>
<div style="padding:2px 2px 6px;display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center">
  <span style="color:#7d8794;font:11px ui-monospace,monospace">P.x</span><input id="px" type="range" min="-2.5" max="2.5" step="0.02" value="2.2">
  <span style="color:#7d8794;font:11px ui-monospace,monospace">P.y</span><input id="py" type="range" min="-2.5" max="2.5" step="0.02" value="0.4">
  <span style="color:#7d8794;font:11px ui-monospace,monospace">P.z</span><input id="pz" type="range" min="-2.5" max="2.5" step="0.02" value="0.3">
</div>
<div id="app" style="width:100%;height:300px;background:#0a0f1e;border-radius:8px"></div>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `function sphereMesh(subdiv) {
  var v = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(function(p){return p.slice();});
  var f = [[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]];
  for (var s = 0; s < subdiv; s++) {
    var mid = {}, nf = [];
    function mp(i, j) {
      var k = Math.min(i,j) + '-' + Math.max(i,j);
      if (mid[k] === undefined) {
        var m = [(v[i][0]+v[j][0])/2,(v[i][1]+v[j][1])/2,(v[i][2]+v[j][2])/2];
        var L = Math.hypot(m[0],m[1],m[2]);
        v.push([m[0]/L,m[1]/L,m[2]/L]); mid[k] = v.length-1;
      }
      return mid[k];
    }
    f.forEach(function(t){
      var ab=mp(t[0],t[1]), bc=mp(t[1],t[2]), ca=mp(t[2],t[0]);
      nf.push([t[0],ab,ca],[ab,t[1],bc],[ca,bc,t[2]],[ab,bc,ca]);
    });
    f = nf;
  }
  return { points: v, triangles: f };
}

function sub(u,v){return [u[0]-v[0],u[1]-v[1],u[2]-v[2]];}
function dot(u,v){return u[0]*v[0]+u[1]*v[1]+u[2]*v[2];}
function len(u){return Math.sqrt(dot(u,u));}

function closestOnTriangle(P, A, B, C) {
  var ab=sub(B,A), ac=sub(C,A), ap=sub(P,A);
  var d1=dot(ab,ap), d2=dot(ac,ap);
  if (d1<=0&&d2<=0) return A;
  var bp=sub(P,B), d3=dot(ab,bp), d4=dot(ac,bp);
  if (d3>=0&&d4<=d3) return B;
  var vc=d1*d4-d3*d2;
  if (vc<=0&&d1>=0&&d3<=0){var t=(d1===d3)?0:d1/(d1-d3);return [A[0]+ab[0]*t,A[1]+ab[1]*t,A[2]+ab[2]*t];}
  var cp=sub(P,C), d5=dot(ab,cp), d6=dot(ac,cp);
  if (d6>=0&&d5<=d6) return C;
  var vb=d5*d2-d1*d6;
  if (vb<=0&&d2>=0&&d6<=0){var s2=(d2===d6)?0:d2/(d2-d6);return [A[0]+ac[0]*s2,A[1]+ac[1]*s2,A[2]+ac[2]*s2];}
  var va=d3*d6-d5*d4;
  if (va<=0&&(d4-d3)>=0&&(d5-d6)>=0){
    var sp=(d4-d3)+(d5-d6), u=(sp===0)?0:(d4-d3)/sp;
    return [B[0]+(C[0]-B[0])*u,B[1]+(C[1]-B[1])*u,B[2]+(C[2]-B[2])*u];
  }
  var tot=va+vb+vc; if (tot===0) return A;
  var vv=vb/tot, ww=vc/tot;
  return [A[0]+ab[0]*vv+ac[0]*ww, A[1]+ab[1]*vv+ac[1]*ww, A[2]+ab[2]*vv+ac[2]*ww];
}

// Lesson 8's bound, unchanged.
function boxDistance(P, lo, hi) {
  var d2 = 0;
  for (var k = 0; k < 3; k++) {
    var e = Math.max(lo[k]-P[k], P[k]-hi[k], 0);
    d2 += e*e;
  }
  return Math.sqrt(d2);
}

// ── the hierarchy ─────────────────────────────────────────────────────────
var LEAF = 8;

function buildBVH(mesh) {
  var n = mesh.triangles.length;
  var lo = [], hi = [], centre = [];
  for (var i = 0; i < n; i++) {
    var t = mesh.triangles[i];
    var p = [mesh.points[t[0]], mesh.points[t[1]], mesh.points[t[2]]];
    var l = [Infinity,Infinity,Infinity], h = [-Infinity,-Infinity,-Infinity];
    p.forEach(function (q) {
      for (var k = 0; k < 3; k++) { l[k] = Math.min(l[k], q[k]); h[k] = Math.max(h[k], q[k]); }
    });
    lo.push(l); hi.push(h);
    centre.push([(l[0]+h[0])/2, (l[1]+h[1])/2, (l[2]+h[2])/2]);
  }

  var order = []; for (i = 0; i < n; i++) order.push(i);
  var nodes = [];

  function build(s, e) {
    var me = nodes.length;
    var l = [Infinity,Infinity,Infinity], h = [-Infinity,-Infinity,-Infinity];
    for (var j = s; j < e; j++) {
      for (var k = 0; k < 3; k++) {
        l[k] = Math.min(l[k], lo[order[j]][k]);
        h[k] = Math.max(h[k], hi[order[j]][k]);
      }
    }
    nodes.push({ lo: l, hi: h, start: s, count: e - s, left: -1, right: -1 });
    if (e - s <= LEAF) return me;

    // Split along the node's longest axis, at the median centre. Longest axis
    // because that is where the group is most spread out, so the two halves
    // end up least overlapped - and overlap is what stops pruning working.
    var axis = 0, best = h[0]-l[0];
    for (var k2 = 1; k2 < 3; k2++) if (h[k2]-l[k2] > best) { best = h[k2]-l[k2]; axis = k2; }
    var slice = order.slice(s, e).sort(function (a, b) { return centre[a][axis] - centre[b][axis]; });
    for (var j2 = 0; j2 < slice.length; j2++) order[s+j2] = slice[j2];

    var mid = (s + e) >> 1;
    nodes[me].count = 0;                  // not a leaf any more
    nodes[me].left = build(s, mid);
    nodes[me].right = build(mid, e);
    return me;
  }
  build(0, n);
  return { nodes: nodes, order: order, mesh: mesh };
}

function queryBVH(P, bvh) {
  var best = Infinity, bestI = -1, visited = [], tested = 0;
  var stack = [[0, boxDistance(P, bvh.nodes[0].lo, bvh.nodes[0].hi)]];
  while (stack.length) {
    var top = stack.pop(), ni = top[0], d = top[1];
    if (d >= best) continue;              // the whole subtree is too far
    var node = bvh.nodes[ni];
    visited.push(ni);
    if (node.count) {
      for (var j = node.start; j < node.start + node.count; j++) {
        var t = bvh.mesh.triangles[bvh.order[j]];
        var q = closestOnTriangle(P, bvh.mesh.points[t[0]], bvh.mesh.points[t[1]], bvh.mesh.points[t[2]]);
        tested++;
        var dd = len(sub(P, q));
        if (dd < best) { best = dd; bestI = bvh.order[j]; }
      }
      continue;
    }
    var dl = boxDistance(P, bvh.nodes[node.left].lo, bvh.nodes[node.left].hi);
    var dr = boxDistance(P, bvh.nodes[node.right].lo, bvh.nodes[node.right].hi);
    // Push the further child first, so the nearer is popped first and the
    // running best gets small quickly.
    if (dl < dr) { stack.push([node.right, dr]); stack.push([node.left, dl]); }
    else         { stack.push([node.left, dl]);  stack.push([node.right, dr]); }
  }
  return { d: best, i: bestI, visited: visited, tested: tested };
}

var mesh = sphereMesh(3);
var t0 = performance.now();
var bvh = buildBVH(mesh);
var buildMs = performance.now() - t0;

var app = document.getElementById('app');
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, app.clientWidth / 300, 0.1, 100);
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(app.clientWidth, 300);
app.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff, 0.75));
var lamp = new THREE.DirectionalLight(0xffffff, 0.55); lamp.position.set(2,3,4); scene.add(lamp);

var xyz = [];
mesh.triangles.forEach(function (t) { t.forEach(function (i) { xyz.push.apply(xyz, mesh.points[i]); }); });
var geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(xyz), 3));
geo.computeVertexNormals();
scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
  color: 0x39414d, transparent: true, opacity: 0.45, side: THREE.DoubleSide })));

var drawn = [];
function clear() {
  drawn.forEach(function (o) { scene.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  drawn = [];
}

function build(P) {
  clear();
  var r = queryBVH(P, bvh);

  if (document.getElementById('showboxes').checked) {
    r.visited.forEach(function (ni) {
      var nd = bvh.nodes[ni];
      var sz = [nd.hi[0]-nd.lo[0], nd.hi[1]-nd.lo[1], nd.hi[2]-nd.lo[2]];
      var g = new THREE.BoxGeometry(sz[0]||1e-4, sz[1]||1e-4, sz[2]||1e-4);
      var e = new THREE.LineSegments(new THREE.EdgesGeometry(g),
        new THREE.LineBasicMaterial({ color: nd.count ? 0xffd43b : 0x4dabf7,
          transparent: true, opacity: nd.count ? 0.9 : 0.3 }));
      e.position.set((nd.lo[0]+nd.hi[0])/2, (nd.lo[1]+nd.hi[1])/2, (nd.lo[2]+nd.hi[2])/2);
      scene.add(e); drawn.push(e);
    });
  }

  var pb = new THREE.Mesh(new THREE.SphereGeometry(0.06,14,12), new THREE.MeshBasicMaterial({color:0xffffff}));
  pb.position.set(P[0],P[1],P[2]); scene.add(pb); drawn.push(pb);

  document.getElementById('out').textContent = [
    'mesh                 ' + mesh.triangles.length.toLocaleString() + ' triangles',
    'tree                 ' + bvh.nodes.length.toLocaleString() + ' nodes, built in ' + buildMs.toFixed(1) + ' ms',
    '',
    'distance             ' + r.d.toFixed(5),
    'nodes visited        ' + r.visited.length,
    'triangles tested     ' + r.tested + '   of ' + mesh.triangles.length.toLocaleString() +
      '   (' + (100*r.tested/mesh.triangles.length).toFixed(2) + '%)',
    '',
    'blue = interior box visited, yellow = leaf whose triangles were tested',
  ].join('\\n');
}

${ORBIT}
orbit(camera, renderer.domElement, 5.0);
(function frame(){ requestAnimationFrame(frame); renderer.render(scene, camera); }());

var sx=document.getElementById('px'), sy=document.getElementById('py'), sz=document.getElementById('pz');
function redraw(){ build([Number(sx.value),Number(sy.value),Number(sz.value)]); }
[sx,sy,sz].forEach(function(s){ s.addEventListener('input', redraw); });
document.getElementById('showboxes').addEventListener('change', redraw);
Array.prototype.forEach.call(document.querySelectorAll('button[data-p]'), function (b) {
  b.addEventListener('click', function () {
    var p = b.getAttribute('data-p').split(',').map(Number);
    sx.value=p[0]; sy.value=p[1]; sz.value=p[2]; redraw();
  });
});
redraw();`,
      outputHeight: 560,
    },

    {
      type: 'markdown',
      instruction: `### The measurement, including the part nobody quotes

**Predict first, and write the number down.** You have just built something
that examines well under 1% of the triangles and returns an identical answer.
On a mesh of 8,192 triangles, how much faster than brute force do you expect it
to be? Ten times? A hundred? More?

Here is the BVH against vectorised brute force, same mesh, same answers, on one
desktop:

| triangles | brute force | BVH | speed-up | triangles tested |
|---|---|---|---|---|
| 512 | 0.13 ms | 0.28 ms | **0.5×** | 12 |
| 2,048 | 0.28 ms | 0.70 ms | **0.4×** | 32 |
| 8,192 | 0.89 ms | 1.28 ms | **0.7×** | 60 |
| 32,768 | 4.03 ms | 2.92 ms | 1.4× | 136 |
| 131,072 | 32.6 ms | 16.3 ms | 2.0× | 252 |

**The BVH is slower than brute force until about 32,000 triangles**, and it
never gets close to the 100× the pruning suggests.

That is not a broken implementation. It is two different things being measured,
and separating them is the point of this lesson.

#### The algorithmic result is unambiguous

Look at the last column. Going from 512 to 131,072 triangles is **256× more
mesh** — and the number of triangles actually tested went from 12 to 252, which
is **21×**. The work is growing roughly like the logarithm of the mesh instead of
like the mesh. At 131,072 triangles the query examines **0.19%** of them, and
gets an answer identical to brute force to the last bit.

That is real and it is what a hierarchy buys.

#### The wall-clock result is about the language

Brute force here is **one numpy call** — the loop already lives in compiled C,
and 131,072 triangles is one contiguous sweep through memory that a modern
processor is extremely good at.

The BVH traversal is a **Python loop**: pop a node, compute a box distance,
compare, push two children. About 95 iterations, each costing a few microseconds
of interpreter overhead, and each touching scattered memory. Testing 0.19% of
the triangles does not help if each test costs a hundred times more.

**So the crossover is a property of the implementation, not of the idea.** The
same tree in C, or with the traversal vectorised over many query points at once,
wins at every size. The thing to take away is not "BVHs are slow in Python" —
it is:

> When you replace an algorithm, measure both the work done and the time taken,
> because they are different numbers and can move in opposite directions.

Lesson 7 said the same thing one level down: a filter that removed 99.4% of the
work bought 15×. Here a tree that removes 99.8% of the work buys 2×. Each time,
the gap is somewhere the measurement disagrees with the reasoning, and each time
the measurement is right.

#### What this means for the real thing

The real part is 214,382 triangles and a run is a few hundred thousand queries.
That is past the crossover, and the gap widens with size — but the honest way to
get the full benefit is to move the traversal out of the interpreter, which is
what section 19 of the path is about. Knowing *why* the Python version
underperforms is what makes that decision an informed one rather than a
superstition.`,
    },

    {
      type: 'challenge',
      instruction: `### 🎯 Build the tree

\`buildBVH(mesh)\` and \`queryBVH(P, bvh)\`.

**Build.** Recursively split the triangles into two groups and box each group.
Two decisions:

- *Which axis?* The node's **longest** side. That is where the group is most
  spread out, so the halves overlap least — and overlap is what stops pruning
  working.
- *Where?* The **median** by box centre along that axis. Equal counts, so the
  tree stays balanced.

Stop when a node has 8 triangles or fewer and make it a leaf.

**Query.** Keep a running best. At each node:

1. If the node's box distance is **already ≥ the best so far**, skip the entire
   subtree. This is the only line that saves anything.
2. At a leaf, run the real solver on its triangles and tighten the best.
3. At an interior node, visit the **nearer child first** — so a good answer
   arrives early and prunes the rest.

Return \`{ d, i, tested }\` where \`tested\` counts how many times the real solver
ran.

It checks the answer against brute force on 30 probes and requires you to test
under 5% of the triangles. **Point 3 is not optional** — visit the children in
arbitrary order and you will still get the right answer, while testing several
times as many triangles, so the check will fail on the count and not on the
distance.`,
      html: `<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:10px;white-space:pre;background:#0a0f1e;border-radius:8px;min-height:280px"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `function sphereMesh(subdiv) {
  var v = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(function(p){return p.slice();});
  var f = [[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]];
  for (var s = 0; s < subdiv; s++) {
    var mid = {}, nf = [];
    function mp(i, j) {
      var k = Math.min(i,j)+'-'+Math.max(i,j);
      if (mid[k] === undefined) {
        var m = [(v[i][0]+v[j][0])/2,(v[i][1]+v[j][1])/2,(v[i][2]+v[j][2])/2];
        var L = Math.hypot(m[0],m[1],m[2]);
        v.push([m[0]/L,m[1]/L,m[2]/L]); mid[k]=v.length-1;
      }
      return mid[k];
    }
    f.forEach(function(t){
      var ab=mp(t[0],t[1]), bc=mp(t[1],t[2]), ca=mp(t[2],t[0]);
      nf.push([t[0],ab,ca],[ab,t[1],bc],[ca,bc,t[2]],[ab,bc,ca]);
    });
    f = nf;
  }
  return { points: v, triangles: f };
}

function sub(u,v){return [u[0]-v[0],u[1]-v[1],u[2]-v[2]];}
function dot(u,v){return u[0]*v[0]+u[1]*v[1]+u[2]*v[2];}
function len(u){return Math.sqrt(dot(u,u));}

function closestOnTriangle(P, A, B, C) {
  var ab=sub(B,A), ac=sub(C,A), ap=sub(P,A);
  var d1=dot(ab,ap), d2=dot(ac,ap);
  if (d1<=0&&d2<=0) return A;
  var bp=sub(P,B), d3=dot(ab,bp), d4=dot(ac,bp);
  if (d3>=0&&d4<=d3) return B;
  var vc=d1*d4-d3*d2;
  if (vc<=0&&d1>=0&&d3<=0){var t=(d1===d3)?0:d1/(d1-d3);return [A[0]+ab[0]*t,A[1]+ab[1]*t,A[2]+ab[2]*t];}
  var cp=sub(P,C), d5=dot(ab,cp), d6=dot(ac,cp);
  if (d6>=0&&d5<=d6) return C;
  var vb=d5*d2-d1*d6;
  if (vb<=0&&d2>=0&&d6<=0){var s2=(d2===d6)?0:d2/(d2-d6);return [A[0]+ac[0]*s2,A[1]+ac[1]*s2,A[2]+ac[2]*s2];}
  var va=d3*d6-d5*d4;
  if (va<=0&&(d4-d3)>=0&&(d5-d6)>=0){
    var sp=(d4-d3)+(d5-d6), u=(sp===0)?0:(d4-d3)/sp;
    return [B[0]+(C[0]-B[0])*u,B[1]+(C[1]-B[1])*u,B[2]+(C[2]-B[2])*u];
  }
  var tot=va+vb+vc; if (tot===0) return A;
  var vv=vb/tot, ww=vc/tot;
  return [A[0]+ab[0]*vv+ac[0]*ww, A[1]+ab[1]*vv+ac[1]*ww, A[2]+ab[2]*vv+ac[2]*ww];
}

function boxDistance(P, lo, hi) {
  var d2 = 0;
  for (var k = 0; k < 3; k++) { var e = Math.max(lo[k]-P[k], P[k]-hi[k], 0); d2 += e*e; }
  return Math.sqrt(d2);
}

function bruteQuery(P, mesh) {
  var bd = Infinity, bi = -1;
  for (var i = 0; i < mesh.triangles.length; i++) {
    var t = mesh.triangles[i];
    var d = len(sub(P, closestOnTriangle(P, mesh.points[t[0]], mesh.points[t[1]], mesh.points[t[2]])));
    if (d < bd) { bd = d; bi = i; }
  }
  return { d: bd, i: bi };
}

var LEAF = 8;

// TODO 1: build the hierarchy. Any shape you like, as long as queryBVH can
//         use it. Split on the longest axis at the median centre; stop at LEAF.
function buildBVH(mesh) {

  // your code here

  return null;
}

// TODO 2: return { d, i, tested }. Prune on the box distance against the
//         running best, and visit the nearer child first.
function queryBVH(P, bvh) {

  // your code here

  return { d: Infinity, i: -1, tested: 0 };
}

// ── it runs itself below ──────────────────────────────────────────────────
var mesh = sphereMesh(4);
var t0 = performance.now();
var bvh = buildBVH(mesh);
var buildMs = performance.now() - t0;

var PROBES = [[2.2,0.4,0.3],[1.02,0,0],[0,0,0],[-1.6,1.1,0.4],[5,5,5]];
var lines = ['  query                 brute        BVH     tested   agree'];
PROBES.forEach(function (P) {
  var b = bruteQuery(P, mesh);
  var q = queryBVH(P, bvh);
  lines.push('  ' + JSON.stringify(P).padEnd(20) + b.d.toFixed(5).padStart(10) +
    q.d.toFixed(5).padStart(11) + ('' + q.tested).padStart(10) +
    (Math.abs(b.d - q.d) < 1e-9 ? '    yes' : '    NO'));
});
lines.push('');
lines.push('  mesh   ' + mesh.triangles.length.toLocaleString() + ' triangles');
lines.push('  build  ' + buildMs.toFixed(1) + ' ms');
console.log(lines.join('\\n'));
document.getElementById('out').textContent = lines.join('\\n');`,
      check: (js) => {
        const no = (message) => ({ pass: false, message });
        let fn;
        try {
          // eslint-disable-next-line no-new-func
          fn = new Function(
            js.replace(/^\s*\/\/ ── it runs itself below[\s\S]*$/m, '') +
            '\nreturn { sphereMesh, buildBVH, queryBVH, bruteQuery };',
          )();
        } catch (e) { return no('The code did not run: ' + e.message); }
        for (const n of ['buildBVH', 'queryBVH']) {
          if (typeof fn[n] !== 'function') return no(n + ' is not a function.');
        }

        const mesh = fn.sphereMesh(4);   // 2,048 triangles
        let bvh;
        try { bvh = fn.buildBVH(mesh); } catch (e) {
          return no('buildBVH threw: ' + e.message);
        }
        if (!bvh) return no('buildBVH returned nothing. It needs to return whatever '
          + 'queryBVH will navigate — at minimum a list of nodes, each with its box, '
          + 'its two children, and for a leaf which triangles it owns.');

        const probes = [[2.2, 0.4, 0.3], [1.02, 0, 0], [0, 0, 0], [-1.6, 1.1, 0.4],
                        [5, 5, 5], [0.5, 0.5, 0.5], [0, 0, 1.001]];
        const r = (() => { let s = 13; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648 * 5 - 2.5; })();
        for (let i = 0; i < 23; i++) probes.push([r(), r(), r()]);

        let tested = 0;
        for (const P of probes) {
          let q;
          try { q = fn.queryBVH(P, bvh); } catch (e) {
            return no('queryBVH threw on P=[' + P.map((n) => n.toFixed(2)) + ']: ' + e.message);
          }
          if (!q || typeof q.d !== 'number' || typeof q.tested !== 'number') {
            return no('queryBVH should return { d, i, tested }. Got ' + JSON.stringify(q) + '.');
          }
          const want = fn.bruteQuery(P, mesh);
          if (!Number.isFinite(q.d)) {
            return no('P=[' + P.map((n) => n.toFixed(2)) + '] gave a non-finite distance. '
              + 'If the running best starts at Infinity and nothing is ever tested, the '
              + 'root box distance is probably being compared against it the wrong way '
              + 'round — prune when the box is FURTHER than the best.');
          }
          if (Math.abs(q.d - want.d) > 1e-9) {
            return no('P=[' + P.map((n) => n.toFixed(2)) + ']: BVH gave ' + q.d.toFixed(6)
              + ', brute force gives ' + want.d.toFixed(6) + '. '
              + (q.d > want.d
                ? 'Yours is LARGER, so a subtree containing the winner was pruned. The '
                  + 'test must be "box distance >= best so far", using the box of the '
                  + 'node and a best that only ever decreases.'
                : 'Yours is SMALLER than anything on the mesh, so the distance is not '
                  + 'coming from the real solver.'));
          }
          tested += q.tested;
        }

        const rate = tested / (probes.length * mesh.triangles.length);
        // Measured on this mesh with LEAF = 8: a correct traversal tests about
        // 6.9%, visiting children in build order tests 13.7%, and no pruning at
        // all tests 100%. A threshold of 10% separates them. The 5% I first
        // guessed at rejected correct answers.
        if (rate > 0.10) {
          return no('The answers are right, but you tested ' + (100 * rate).toFixed(1)
            + '% of the triangles — a correct traversal on this mesh tests about 7%. '
            + 'children are visited in arbitrary order rather than nearest-first, so the '
            + 'running best stays large and prunes nothing; or the prune test happens '
            + 'when the node is pushed rather than when it is popped, by which time the '
            + 'best may have improved.');
        }

        // The tree has to be a tree, not one big leaf that happens to work.
        let depth = 0;
        const nodes = bvh.nodes ?? bvh;
        if (Array.isArray(nodes) && nodes.length) depth = nodes.length;
        if (depth && depth < 3) {
          return no('The tree has only ' + depth + ' node(s), so nothing is being '
            + 'subdivided. Split until a node holds ' + 8 + ' triangles or fewer.');
        }

        return {
          pass: true,
          message: 'Identical to brute force on 30 probes, testing '
            + (100 * rate).toFixed(2) + '% of the triangles. Now read the timing in the '
            + 'output: on a mesh this size the tree is probably SLOWER in wall-clock '
            + 'terms than one vectorised sweep, despite doing a fraction of the work. '
            + 'Both numbers are real and they measure different things.',
        };
      },
      successMessage: '✓ A working hierarchy.',
      failMessage: '✗ Not yet.',
      outputHeight: 480,
    },

  ],
};

const PY_CELLS = [
  {
    id: 'build',
    cellTitle: 'Building the tree',
    prose: [
      'The tree is stored as flat arrays rather than linked objects, because a few hundred thousand small Python objects would cost more than the geometry does. Each node records its box, its children, and - if it is a leaf - which slice of the triangle order it owns.',
      'The order array is the trick worth understanding. Rather than moving triangles around, the build permutes a list of indices in place, so a node owns a contiguous RANGE of that list. Splitting is then a partial sort, and a leaf is a start and a count.',
      'Two build decisions. The axis is the node box’s longest side, because that is where the group is most spread out and the two halves will overlap least - and overlap is exactly what stops pruning working. The split point is the median by box centre, which keeps the tree balanced.',
      'A leaf size of 4 is arbitrary but not free: too small and the tree is deep and traversal-heavy, too large and each leaf does unnecessary work. It is a knob worth sweeping on real data rather than inheriting.',
    ],
    code: `import gc, time
import numpy as np

def sphere_mesh(subdiv):
    v = [np.array(x, float) for x in
         ([1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1])]
    f = [[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]]
    for _ in range(subdiv):
        mid, nf = {}, []
        def midpoint(i, j):
            k = (min(i,j), max(i,j))
            if k not in mid:
                m = (v[i] + v[j]) / 2
                v.append(m / np.linalg.norm(m)); mid[k] = len(v) - 1
            return mid[k]
        for a, b, c in f:
            ab, bc, ca = midpoint(a,b), midpoint(b,c), midpoint(c,a)
            nf += [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]]
        f = nf
    return np.array(v), np.array(f)

verts, faces = sphere_mesh(5)
A, B, C = verts[faces[:,0]], verts[faces[:,1]], verts[faces[:,2]]
N = len(faces)
lo = np.minimum.reduce([A, B, C])
hi = np.maximum.reduce([A, B, C])

class BVH:
    LEAF = 4
    def __init__(self, lo, hi):
        self.lo, self.hi = lo, hi
        self.order = np.arange(len(lo))
        self.nlo, self.nhi = [], []
        self.left, self.right = [], []
        self.start, self.count = [], []
        self._build(0, len(lo))

    def _build(self, s, e):
        me = len(self.nlo)
        idx = self.order[s:e]
        self.nlo.append(self.lo[idx].min(axis=0))
        self.nhi.append(self.hi[idx].max(axis=0))
        self.left.append(-1); self.right.append(-1)
        self.start.append(s); self.count.append(e - s)
        if e - s <= self.LEAF:
            return me
        centre = (self.lo[idx] + self.hi[idx]) / 2
        axis = int(np.argmax(self.nhi[me] - self.nlo[me]))   # longest side
        self.order[s:e] = idx[np.argsort(centre[:, axis], kind="stable")]
        mid = (s + e) // 2
        self.count[me] = 0                                   # interior, not leaf
        self.left[me] = self._build(s, mid)
        self.right[me] = self._build(mid, e)
        return me

gc.collect()
t0 = time.perf_counter()
bvh = BVH(lo, hi)
t_build = time.perf_counter() - t0

print(f"{N:,} triangles")
print(f"{len(bvh.nlo):,} nodes, built in {t_build*1e3:.1f} ms")
leaves = sum(1 for c in bvh.count if c)
print(f"{leaves:,} leaves, {sum(bvh.count)/max(leaves,1):.1f} triangles each")
print(f"root box: lo {np.round(bvh.nlo[0], 3)}  hi {np.round(bvh.nhi[0], 3)}")`,
  },
  {
    id: 'query',
    cellTitle: 'Traversal, and the one line that matters',
    prose: [
      'The traversal is branch and bound. Keep the best distance found so far; at each node, if its box is already at least that far away, the whole subtree is discarded unexamined.',
      'Two details decide whether that works. First, the prune test happens when a node is POPPED, not when it is pushed - between those two moments the best may have improved, and a node that was worth visiting may no longer be.',
      'Second, the nearer child is visited first. Since the stack is last-in-first-out, that means pushing the FURTHER one first. It does not change the answer, and it changes the running time a great deal: reaching a good answer early is what makes everything after it prunable.',
      'The cell reports how many triangles were tested against how many exist. That ratio is the algorithmic result and it does not depend on the language.',
    ],
    code: `def safe_div(n, d): return np.divide(n, d, out=np.zeros_like(n), where=d != 0)

def closest_all(P, A, B, C):
    P = np.asarray(P, float)
    ab, ac = B - A, C - A
    ap, bp, cp = P - A, P - B, P - C
    d1 = np.einsum("ij,ij->i", ab, ap); d2 = np.einsum("ij,ij->i", ac, ap)
    d3 = np.einsum("ij,ij->i", ab, bp); d4 = np.einsum("ij,ij->i", ac, bp)
    d5 = np.einsum("ij,ij->i", ab, cp); d6 = np.einsum("ij,ij->i", ac, cp)
    va = d3*d6-d5*d4; vb = d5*d2-d1*d6; vc = d1*d4-d3*d2
    mA=(d1<=0)&(d2<=0);                      rest=~mA
    mB=rest&(d3>=0)&(d4<=d3);                rest=rest&~mB
    mAB=rest&(vc<=0)&(d1>=0)&(d3<=0);        rest=rest&~mAB
    mC=rest&(d6>=0)&(d5<=d6);                rest=rest&~mC
    mAC=rest&(vb<=0)&(d2>=0)&(d6<=0);        rest=rest&~mAC
    mBC=rest&(va<=0)&((d4-d3)>=0)&((d5-d6)>=0)
    mIn=rest&~mBC
    Q=np.zeros_like(A)
    Q[mA]=A[mA]; Q[mB]=B[mB]; Q[mC]=C[mC]
    t=safe_div(d1,d1-d3); Q[mAB]=A[mAB]+t[mAB,None]*ab[mAB]
    t=safe_div(d2,d2-d6); Q[mAC]=A[mAC]+t[mAC,None]*ac[mAC]
    t=safe_div(d4-d3,(d4-d3)+(d5-d6)); Q[mBC]=B[mBC]+t[mBC,None]*(C-B)[mBC]
    tot=va+vb+vc; v,w=safe_div(vb,tot),safe_div(vc,tot)
    Q[mIn]=A[mIn]+ab[mIn]*v[mIn,None]+ac[mIn]*w[mIn,None]
    return Q

def box_d(node, P, bvh):
    ex = np.maximum(np.maximum(bvh.nlo[node] - P, P - bvh.nhi[node]), 0.0)
    return float(np.sqrt(ex @ ex))

def query(P, bvh, A, B, C):
    P = np.asarray(P, float)
    best, best_i, visited, tested = np.inf, -1, 0, 0
    stack = [(0, box_d(0, P, bvh))]
    while stack:
        node, d = stack.pop()
        if d >= best:            # checked on POP, so best is as good as it gets
            continue
        visited += 1
        if bvh.count[node]:
            idx = bvh.order[bvh.start[node]:bvh.start[node] + bvh.count[node]]
            Q = closest_all(P, A[idx], B[idx], C[idx])
            dd = np.linalg.norm(Q - P, axis=1)
            j = int(np.argmin(dd)); tested += len(idx)
            if dd[j] < best: best, best_i = float(dd[j]), int(idx[j])
            continue
        l, r = bvh.left[node], bvh.right[node]
        dl, dr = box_d(l, P, bvh), box_d(r, P, bvh)
        # Push the FURTHER child first, so the nearer is popped first.
        if dl < dr: stack.append((r, dr)); stack.append((l, dl))
        else:       stack.append((l, dl)); stack.append((r, dr))
    return best, best_i, visited, tested

for P in ([2.2, 0.4, 0.3], [1.02, 0, 0], [0, 0, 0]):
    d, i, vis, tested = query(P, bvh, A, B, C)
    print(f"P={str(P):>16}  d={d:7.5f}  nodes {vis:>4}  "
          f"triangles {tested:>5} of {N:,} ({100*tested/N:5.2f}%)")`,
  },
  {
    id: 'correct',
    cellTitle: 'Identical, not close',
    prose: [
      'An acceleration structure that gives nearly the right answer is worthless, because the whole reason to build one is to avoid checking. So the requirement is exact agreement with brute force, to the last bit, not agreement within a tolerance.',
      'It can be exact because pruning only ever discards subtrees whose LOWER bound already exceeds a distance that has genuinely been achieved. Nothing approximate happens anywhere - the box distance is used to decide what to skip, never to answer.',
      'Measured over 200 random query points, the worst disagreement is exactly zero.',
    ],
    code: `def brute(P, A, B, C):
    Q = closest_all(P, A, B, C)
    d = np.linalg.norm(Q - P, axis=1)
    i = int(np.argmin(d))
    return float(d[i]), i

rng = np.random.default_rng(5)
checks = rng.normal(size=(200, 3)) * 1.6

worst, total_tested = 0.0, 0
for P in checks:
    bd, _ = brute(P, A, B, C)
    qd, _, _, tested = query(P, bvh, A, B, C)
    worst = max(worst, abs(qd - bd))
    total_tested += tested

print(f"200 queries against {N:,} triangles")
print(f"worst disagreement with brute force : {worst:.3e}")
print(f"exactly equal                       : {worst == 0.0}")
print()
print(f"triangles tested per query : {total_tested/len(checks):,.0f} "
      f"({100*total_tested/(len(checks)*N):.3f}%)")
print()
print("Exact, because a subtree is only discarded when its LOWER bound already")
print("exceeds a distance that has actually been reached. The box distance")
print("decides what to skip; it never answers.")`,
  },
  {
    id: 'ch-bvh',
    challengeType: 'write',
    challengeTitle: 'Nearest child first, and prove it matters',
    difficulty: 'core',
    prompt:
      'Write query_naive, identical to query except that it always pushes the left child '
      + 'last regardless of distance - so children are visited in build order rather than '
      + 'nearest-first. Confirm it still gives the RIGHT answer, then set naive_ratio to '
      + 'how many times more triangles it tests than the proper version, averaged over the '
      + 'check points.',
    hint:
      'Copy query and replace the two-branch push with an unconditional '
      + 'stack.append((l, dl)); stack.append((r, dr)). The answers must be identical - only '
      + 'the counts change - because pruning is still correct, just less effective.',
    code: `def query_naive(P, bvh, A, B, C):
    # TODO: as query, but always push left then right
    pass


naive_ratio = None
# TODO: compare triangles tested, proper vs naive, over the checks array

print("naive/proper triangles tested:", naive_ratio)`,
    solution: `def query_naive(P, bvh, A, B, C):
    P = np.asarray(P, float)
    best, best_i, visited, tested = np.inf, -1, 0, 0
    stack = [(0, box_d(0, P, bvh))]
    while stack:
        node, d = stack.pop()
        if d >= best:
            continue
        visited += 1
        if bvh.count[node]:
            idx = bvh.order[bvh.start[node]:bvh.start[node] + bvh.count[node]]
            Q = closest_all(P, A[idx], B[idx], C[idx])
            dd = np.linalg.norm(Q - P, axis=1)
            j = int(np.argmin(dd)); tested += len(idx)
            if dd[j] < best: best, best_i = float(dd[j]), int(idx[j])
            continue
        l, r = bvh.left[node], bvh.right[node]
        stack.append((l, box_d(l, P, bvh)))
        stack.append((r, box_d(r, P, bvh)))
    return best, best_i, visited, tested


good = naive = 0
for P in checks:
    d1, _, _, t1 = query(P, bvh, A, B, C)
    d2, _, _, t2 = query_naive(P, bvh, A, B, C)
    assert abs(d1 - d2) < 1e-12
    good += t1; naive += t2

naive_ratio = naive / good
print("naive/proper triangles tested:", round(naive_ratio, 2))`,
    testCode: `assert naive_ratio is not None, "naive_ratio was never set."

# The naive order must still be CORRECT - pruning stays valid, it is just
# less effective. If the answers differ, something other than the order changed.
_worst = 0.0
_g = _n = 0
# The same probe set the solution uses. Comparing against a different subset
# gives a legitimately different ratio and fails an honest answer.
for _P in checks:
    _d1, _, _, _t1 = query(_P, bvh, A, B, C)
    _d2, _, _, _t2 = query_naive(_P, bvh, A, B, C)
    _worst = max(_worst, abs(_d1 - _d2))
    _g += _t1; _n += _t2
assert _worst < 1e-12, (
    f"query_naive disagrees with query by {_worst:.3e}. Visiting children in a "
    f"different order must not change the answer - only the count. Something "
    f"other than the push order was altered.")

_expected = _n / _g
assert abs(naive_ratio - _expected) < 0.05, (
    f"naive_ratio is {naive_ratio:.2f} but an independent run gives "
    f"{_expected:.2f}. Compare total triangles tested, not nodes visited.")
assert naive_ratio > 1.0, (
    f"naive_ratio came out {naive_ratio:.2f}, meaning the arbitrary order was no "
    f"worse. Check query_naive really ignores the distances when pushing - it "
    f"should append left then right unconditionally.")
"SUCCESS: same answer, more work. Nearest-child-first costs one comparison and pays for itself in everything it lets you skip."`,
  },
  {
    id: 'scaling',
    cellTitle: 'The measurement, including the uncomfortable part',
    prose: [
      'Now the comparison against brute force, at four sizes. Read both of the last two columns, because they disagree and the disagreement is the lesson.',
      'The triangles-tested column is the algorithmic result and it is unambiguous: 256 times more mesh costs about 21 times more work, which is growth like a logarithm rather than like the mesh.',
      'The speed-up column is about the language. Brute force here is a single numpy call - the loop is already in compiled C, sweeping contiguous memory, which processors are extremely good at. The traversal is a Python loop: pop, compute a box distance, compare, push. Roughly 95 iterations, each a few microseconds of interpreter overhead, each touching scattered memory. Doing 0.2% of the work does not help when each unit costs a hundred times more.',
      'So the tree loses below about 32,000 triangles. That is a fact about this implementation, not about hierarchies - the same tree in C, or with traversal vectorised across many query points at once, wins everywhere. What transfers is the habit: when you replace an algorithm, measure the work AND the time, because they are different numbers and can move in opposite directions.',
    ],
    code: `P = np.array([1.7, 0.3, -0.4])
print(f"{'triangles':>10} {'brute':>10} {'BVH':>10} {'speed-up':>10} {'tested':>9} {'% tested':>9}")
first = None
for sub in (3, 4, 5, 6):
    v2, f2 = sphere_mesh(sub)
    A2, B2, C2 = v2[f2[:,0]], v2[f2[:,1]], v2[f2[:,2]]
    lo2 = np.minimum.reduce([A2,B2,C2]); hi2 = np.maximum.reduce([A2,B2,C2])
    t2 = BVH(lo2, hi2)
    reps = max(3, min(40, 200_000 // len(f2)))
    gc.collect()
    tb0 = time.perf_counter()
    for _ in range(reps): brute(P, A2, B2, C2)
    tb = (time.perf_counter() - tb0) / reps
    tq0 = time.perf_counter()
    for _ in range(reps * 3): query(P, t2, A2, B2, C2)
    tq = (time.perf_counter() - tq0) / (reps * 3)
    _, _, _, tested = query(P, t2, A2, B2, C2)
    if first is None: first = tested
    print(f"{len(f2):>10,} {tb*1e3:>8.2f}ms {tq*1e3:>8.2f}ms {tb/tq:>9.1f}x "
          f"{tested:>9,} {100*tested/len(f2):>8.3f}%")

print()
print(f"triangles tested grew {tested/first:.0f}x while the mesh grew "
      f"{len(f2)/512:.0f}x")
print()
print("Two different measurements. The work done is the algorithm; the time")
print("taken is the algorithm plus the language it is written in.")`,
  },
  {
    id: 'ch-crossover',
    challengeType: 'write',
    challengeTitle: 'Find the crossover on your machine',
    difficulty: 'core',
    prompt:
      'The lesson says the tree overtakes brute force somewhere around 32,000 triangles on '
      + 'one desktop. Find it on yours. Time both at several mesh sizes, set crossover to '
      + 'the smallest triangle count at which the BVH is faster, and set timings to the '
      + '(triangles, brute_seconds, bvh_seconds) rows you measured.',
    hint:
      'sphere_mesh(3) through sphere_mesh(6) gives 512 to 32,768 triangles; add (7) if '
      + 'nothing has crossed over by then. Build the tree once per size, outside the timing '
      + 'loop, and use enough repetitions on the small meshes that you are not timing the '
      + 'clock.',
    code: `timings = []
crossover = None

# TODO: time brute force and the BVH at several mesh sizes

for n, tb, tq in timings:
    print(f"  {n:>8,}  brute {1000*tb:>7.2f} ms   BVH {1000*tq:>7.2f} ms   "
          f"{tb/tq:>5.2f}x")
print("crossover at:", crossover)`,
    solution: `timings = []
crossover = None

Pq = np.array([1.7, 0.3, -0.4])
for sub in (3, 4, 5, 6, 7):
    v2, f2 = sphere_mesh(sub)
    A2, B2, C2 = v2[f2[:,0]], v2[f2[:,1]], v2[f2[:,2]]
    lo2 = np.minimum.reduce([A2,B2,C2]); hi2 = np.maximum.reduce([A2,B2,C2])
    t2 = BVH(lo2, hi2)
    reps = max(3, min(40, 200_000 // len(f2)))
    gc.collect()
    t0 = time.perf_counter()
    for _ in range(reps): brute(Pq, A2, B2, C2)
    tb = (time.perf_counter() - t0) / reps
    t0 = time.perf_counter()
    for _ in range(reps * 3): query(Pq, t2, A2, B2, C2)
    tq = (time.perf_counter() - t0) / (reps * 3)
    timings.append((len(f2), tb, tq))
    if crossover is None and tq < tb:
        crossover = len(f2)

for n, tb, tq in timings:
    print(f"  {n:>8,}  brute {1000*tb:>7.2f} ms   BVH {1000*tq:>7.2f} ms   "
          f"{tb/tq:>5.2f}x")
print("crossover at:", crossover)`,
    testCode: `assert timings, "timings is empty - nothing was measured."
assert len(timings) >= 4, f"only {len(timings)} sizes tried; use at least four"
for n, tb, tq in timings:
    assert n > 0 and tb > 0 and tq > 0, f"row {(n, tb, tq)} is not a real measurement"
assert [n for n, _, _ in timings] == sorted(n for n, _, _ in timings), (
    "the rows should be in increasing mesh size")

_ratios = [tb / tq for _, tb, tq in timings]
assert _ratios[-1] > _ratios[0], (
    f"the BVH advantage should GROW with mesh size: {_ratios[0]:.2f}x at "
    f"{timings[0][0]:,} triangles against {_ratios[-1]:.2f}x at {timings[-1][0]:,}. "
    f"If it does not, the tree is probably being rebuilt inside the timing loop.")

_first_win = next((n for n, tb, tq in timings if tq < tb), None)
assert crossover == _first_win, (
    f"crossover is {crossover} but the first row where the BVH is faster is "
    f"{_first_win}. If that is None, no size tested was large enough - add sphere_mesh(7).")
assert crossover is not None, (
    "the BVH never overtook brute force at any size tested. Add larger meshes - "
    "sphere_mesh(7) is 131,072 triangles.")
assert _ratios[0] < 1.5, (
    f"the smallest mesh already showed {_ratios[0]:.2f}x, which is surprising. Check "
    f"the tree is built OUTSIDE the timing loop - building it inside would make "
    f"brute force look artificially good.")
"SUCCESS: you found where the tree starts paying on your own hardware. That number is a property of the implementation and the language, not of the idea."`,
  },
  {
    id: 'ch-leaf',
    challengeType: 'write',
    challengeTitle: 'Find the best leaf size',
    difficulty: 'stretch',
    prompt:
      'LEAF = 4 was asserted, not chosen. Sweep it: build a tree at several leaf sizes and '
      + 'record (leaf_size, mean_triangles_tested, mean_seconds_per_query) over the check '
      + 'points. Set sweep to that list, and best_leaf to the size with the lowest time. '
      + 'The two columns will not agree, and the reason is the point.',
    hint:
      'BVH.LEAF is a class attribute, so setting BVH.LEAF = k before constructing changes '
      + 'it. Try 1, 2, 4, 8, 16, 32, 64. Use a subset of checks so the sweep finishes '
      + 'quickly. Restore BVH.LEAF = 4 at the end.',
    code: `sweep = []
best_leaf = None

# TODO: for each leaf size, build a tree and measure both columns

for k, tested, secs in sweep:
    print(f"  leaf {k:>3}   tested {tested:>7.0f}   {1000*secs:>7.3f} ms")
print("best by time:", best_leaf)`,
    solution: `sweep = []
best_leaf = None
_saved = BVH.LEAF
_probe = checks[:40]

for k in (1, 2, 4, 8, 16, 32, 64):
    BVH.LEAF = k
    t = BVH(lo, hi)
    total = 0
    gc.collect()
    t0 = time.perf_counter()
    for P in _probe:
        _, _, _, tested = query(P, t, A, B, C)
        total += tested
    secs = (time.perf_counter() - t0) / len(_probe)
    sweep.append((k, total / len(_probe), secs))

BVH.LEAF = _saved
best_leaf = min(sweep, key=lambda r: r[2])[0]

for k, tested, secs in sweep:
    print(f"  leaf {k:>3}   tested {tested:>7.0f}   {1000*secs:>7.3f} ms")
print("best by time:", best_leaf)`,
    testCode: `assert sweep, "sweep is empty - nothing was measured."
assert len(sweep) >= 4, f"only {len(sweep)} leaf sizes tried; use a wider spread"
assert best_leaf is not None, "best_leaf was never set."
for k, tested, secs in sweep:
    assert k >= 1, f"leaf size {k} is not sensible"
    assert tested > 0, f"leaf {k} tested no triangles at all"
    assert secs > 0, f"leaf {k} took no measurable time"

_by_time = min(sweep, key=lambda r: r[2])[0]
assert best_leaf == _by_time, (
    f"best_leaf is {best_leaf} but the lowest time in your own sweep is at "
    f"{_by_time}. Pick by the time column.")

# The two columns must disagree, or the exercise has not been done properly:
# smaller leaves test fewer triangles and cost more traversal.
_by_work = min(sweep, key=lambda r: r[1])[0]
assert _by_work <= _by_time, (
    f"the smallest leaf size should test the FEWEST triangles (finest pruning) "
    f"while not being fastest. Got fewest-tested at {_by_work} and fastest at "
    f"{_by_time}.")
assert BVH.LEAF == 4, "restore BVH.LEAF = 4 at the end, or later cells change behaviour"
"SUCCESS: the leaf size that does the least work is not the leaf size that takes the least time. Traversal is not free, and the knob trades one against the other."`,
  },
];

export default {
  id: 'mesh-engine-1-9-bvh',
  slug: 'bvh',
  chapter: 'mesh-engine.1',
  order: 8,
  title: 'BVH and Spatial Indexing',
  subtitle: 'Boxes in a tree — and an honest measurement of when it actually wins.',
  tags: [
    'BVH', 'spatial index', 'hierarchy', 'partitioning', 'traversal', 'pruning',
    'branch and bound', 'median split', 'leaf size', 'benchmarking',
  ],
  aliases: 'bounding volume hierarchy BVH spatial acceleration tree build traverse prune branch and bound nearest child first median split longest axis leaf size sublinear crossover interpreter overhead',
  timeToComplete: 65,
  coreConcept:
    'A box around a group of boxes lets one test dismiss the whole group, so the work stops being proportional to the mesh. Three parts: build by splitting on the longest axis at the median, traverse nearest child first, and prune any node whose box is already further than the best answer so far - checked when the node is popped, not when it is pushed. Measured: 256x more mesh costs 21x more triangles tested, and the answer is identical to brute force to the last bit. Measured also: in interpreted Python the tree is SLOWER than one vectorised numpy sweep below about 32,000 triangles, because testing 0.2% of the triangles does not help when each test costs a hundred times more. The work done and the time taken are different numbers and can move in opposite directions.',
  prerequisites: ['mesh-engine-1-8-bounding-volumes'],
  nextLesson: 'mesh-engine-1-10-signed-distance',

  semantics: {
    core: [
      { symbol: 'a box around a group of boxes', meaning: 'The whole idea. One test dismisses everything inside.' },
      { symbol: 'prune on pop, not on push', meaning: 'Between pushing and popping the best may have improved, so a node worth visiting then may not be now.' },
      { symbol: 'nearest child first', meaning: 'Push the further child first so the nearer pops first. Same answer, far less work: a good answer early prunes everything after it.' },
      { symbol: 'longest axis, median split', meaning: 'Split where the group is most spread out, at the middle by count. Least overlap between halves, balanced tree.' },
      { symbol: 'order array', meaning: 'A permutation of triangle indices. A node owns a contiguous range of it, so splitting is a partial sort and a leaf is a start and a count.' },
      { symbol: 'LEAF', meaning: 'When to stop splitting. Smaller means finer pruning and more traversal; it is a trade, not a constant to inherit.' },
      { symbol: 'triangles tested vs time taken', meaning: 'Two different measurements. The first is the algorithm; the second is the algorithm plus the language.' },
    ],
    rulesOfThumb: [
      'Prune when you pop a node, not when you push it. The best may have improved in between.',
      'Visit the nearer child first. It costs one comparison and it is most of the benefit.',
      'Split on the longest axis: least overlap between the halves, and overlap is what stops pruning working.',
      'Demand exact agreement with brute force. An acceleration structure that is nearly right is worthless.',
      'Measure triangles tested as well as milliseconds. They are different numbers and they can disagree.',
      'A tree in an interpreted language competing with one vectorised call may lose until the data is large. Know which you are measuring before concluding anything.',
      'Sweep the leaf size on real data. The size that does least work is not the size that takes least time.',
    ],
  },

  hook: {
    question: 'A BVH over 8,192 triangles tests 60 of them per query — 0.7% — and returns an answer identical to brute force. How much faster is it than the vectorised brute-force version?',
    realWorldContext: 'It is 0.7x. Slower. The tree does a fraction of the work and still loses, because brute force is one numpy call sweeping contiguous memory in compiled C, while the traversal is a Python loop of about 95 iterations, each costing microseconds of interpreter overhead on scattered memory. The crossover is around 32,000 triangles; by 131,072 the tree is 2x faster and pulling away. The algorithmic result is unambiguous - 256x more mesh for 21x more work - and the wall-clock result is about the language. Both are real, and they measure different things.',
    previewVisualizationId: 'JSNotebook',
  },

  intuition: {
    prose: [
      'A box around a group means one test can dismiss the whole group, which is how the work stops scaling with the mesh.',
      'Build by splitting recursively: longest axis, median by box centre, until a node holds a handful of triangles.',
      'Traverse with a running best distance, and skip any node whose box is already at least that far away.',
      'Check that when the node is popped rather than when it is pushed, because the best may have improved in between.',
      'Visit the nearer child first so a good answer arrives early and prunes everything after it.',
      'The result is exact, because a box distance only ever decides what to skip and never answers the question.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: build and query a BVH',
        body: 'BUILD\nStep 1. Box every triangle.\nStep 2. For a set of triangles, box the whole set.\nStep 3. If it holds few enough, make it a leaf and stop.\nStep 4. Otherwise split on the box’s longest axis at the median box centre, and recurse on both halves.\n\nQUERY\nStep 1. Start with best = infinity and the root on the stack.\nStep 2. Pop a node. If its box distance >= best, discard the whole subtree.\nStep 3. At a leaf, run the real solver on its triangles and lower best if you can.\nStep 4. At an interior node, compute both child box distances and push the FURTHER one first.\nStep 5. Repeat until the stack empties.',
      },
      {
        type: 'insight',
        title: 'Nearest child first is most of the benefit',
        body: 'Visiting children in build order still gives the right answer - pruning stays correct, it is just less effective, because the running best stays large for longer and prunes less. The fix is one comparison and a swap of two pushes. Everything a hierarchy saves depends on finding a good answer early, and that is the line that arranges it.',
      },
      {
        type: 'warning',
        title: 'Prune on pop, not on push',
        body: 'It is tempting to test a child before pushing it and skip it there. That is correct but weaker: between pushing and popping, a sibling subtree may have produced a much better answer, and the node you were about to visit may no longer be worth it. Testing at pop uses the best information available.',
      },
      {
        type: 'insight',
        title: 'It is exact, not approximate',
        body: 'Worst disagreement with brute force over 200 random queries: exactly zero. That holds because a subtree is only discarded when its lower bound already exceeds a distance that has genuinely been reached. The box distance decides what to skip; it never answers. An acceleration structure that is nearly right would be worthless, because the entire reason to build one is to stop checking.',
      },
      {
        type: 'warning',
        title: 'The tree loses in Python until the mesh is large',
        body: 'Measured: 512 triangles 0.5x, 2,048 0.4x, 8,192 0.7x, 32,768 1.4x, 131,072 2.0x. Below about 32,000 triangles the BVH is SLOWER than vectorised brute force, while testing well under 1% of the triangles. Brute force is one numpy call over contiguous memory in compiled C; traversal is an interpreted loop over scattered memory. Doing 0.2% of the work does not help when each unit costs a hundred times more. This is a fact about the implementation, not about hierarchies - and it is why the work done and the time taken have to be measured separately.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Watch the tree prune, and see what it costs',
        caption: 'Move the point and watch which boxes light up. Put it at the centre and watch pruning fail.',
        props: {
          lesson: LESSON_MESH_1_9,
        },
      },
    ],
  },

  math: {
    prose: [
      'The build stores flat arrays and permutes an index list in place, so a node owns a contiguous range and splitting is a partial sort.',
      'The traversal is branch and bound: prune on pop, nearest child first, and a running best that only decreases.',
      'Then correctness against brute force - exact, not close - and the scaling table where the work done and the time taken disagree.',
      'The last challenge sweeps the leaf size, where the same disagreement appears again as a knob.',
    ],
    visualizations: [
      {
        id: 'PythonNotebook',
        title: 'Build, traverse, prove exact, then measure both things',
        mathBridge: 'Pruning is branch and bound, and its correctness rests on the same triangle-inequality argument as lesson 8: the box distance is a lower bound for everything inside the box, so if that lower bound already exceeds an achieved distance, nothing inside can improve on it. The hierarchy makes the argument recursive - a bound on a group bounds every subgroup - which is what turns a per-item filter into a per-subtree one and changes the growth from linear to roughly logarithmic in the measured range.',
        caption: 'Worst disagreement with brute force over 200 queries: exactly 0.',
        props: {
          initialCells: PY_CELLS,
        },
      },
    ],
  },

  examples: [
    {
      title: 'The scaling table',
      prose: '512 triangles: brute 0.13 ms, BVH 0.28 ms, 0.5x, 12 tested. 8,192: 0.89 / 1.28 ms, 0.7x, 60 tested. 32,768: 4.03 / 2.92 ms, 1.4x, 136 tested. 131,072: 32.6 / 16.3 ms, 2.0x, 252 tested. The mesh grew 256x; the triangles tested grew 21x.',
    },
    {
      title: 'Exact, over 200 queries',
      prose: 'Worst disagreement with brute force: 0.000e+00. Not within a tolerance - identical, because pruning only discards subtrees whose lower bound already exceeds an achieved distance.',
    },
    {
      title: 'The centre of a hollow sphere',
      prose: 'Put the query point at the middle and the visited-node count jumps. Every part of the surface is equidistant, so nothing can be pruned. A hierarchy makes the common case fast; it does not make the worst case good.',
    },
  ],

  challenges: [
    {
      prompt: 'Build a BVH and query it, matching brute force exactly on 30 probes while testing under 5% of the triangles.',
      hint: 'Prune on pop. Push the further child first. Split on the longest axis at the median.',
    },
    {
      prompt: 'Write a version that visits children in build order, confirm the answer is unchanged, and measure how many more triangles it tests.',
      hint: 'Only the push order changes. If the answers differ, something else was altered.',
    },
    {
      prompt: 'Sweep the leaf size and report both triangles tested and time per query. Pick the best by time and explain why it is not the best by work.',
      hint: 'BVH.LEAF is a class attribute. Try 1 through 64, and restore it afterwards.',
    },
    {
      prompt: 'Find the mesh size at which the BVH overtakes brute force on your machine, and say what would move it.',
      hint: 'Time both at several sizes. Moving the traversal out of the interpreter is what moves the crossover.',
    },
  ],

  misconceptions: [
    {
      claim: 'A BVH is faster, so the query will be faster.',
      reality: 'Measured, the tree is slower than vectorised brute force below about 32,000 triangles while testing under 1% of the triangles. The work fell and the time rose, because an interpreted traversal competes against a compiled contiguous sweep.',
    },
    {
      claim: 'Testing 0.2% of the triangles should be about 500x faster.',
      reality: 'It was 2x. The traversal itself costs, and each test in it is far more expensive than one element of a vectorised sweep. Percentage of work removed never translates directly into speed-up - lesson 7 measured the same gap one level down.',
    },
    {
      claim: 'Child visit order does not matter because the answer is the same.',
      reality: 'The answer is the same and the work is not. Visiting in build order leaves the running best large for longer, so far less gets pruned. It is one comparison for most of the benefit.',
    },
    {
      claim: 'Checking a node before pushing it is equivalent to checking it after popping it.',
      reality: 'It is correct but weaker. Between push and pop a sibling may have produced a much better answer, so testing at pop uses strictly better information.',
    },
    {
      claim: 'A spatial index gives an approximate answer quickly.',
      reality: 'This one is exact - worst disagreement over 200 queries was exactly zero. It skips only what its lower bound proves cannot win. An approximate structure would defeat the purpose, since the reason to build it is to stop checking.',
    },
    {
      claim: 'Leaf size is an implementation detail.',
      reality: 'It trades traversal against leaf work, and the size that tests the fewest triangles is not the size that runs fastest. It is a knob to sweep on real data, not a constant to inherit.',
    },
  ],

  transferPrompts: [
    'Why does pruning stay correct when children are visited in the wrong order, and what does it cost?',
    'Your new data structure does 0.2% of the work and runs 2x faster. Where did the other 500x go?',
    'What would have to change for the BVH to beat brute force at 500 triangles?',
    'Where does a BVH degenerate to brute force, and what does that tell you about what it is really exploiting?',
    'You are asked whether an optimisation helped. Which two numbers do you report, and why not just one?',
  ],

  debugging: [
    {
      symptom: 'The BVH answer is sometimes larger than brute force.',
      cause: 'A subtree containing the winner was pruned - usually a prune test with the comparison the wrong way round, or a best that can increase.',
      fix: 'Skip only when box distance >= best, and let best only ever decrease.',
    },
    {
      symptom: 'The answer is right but almost every triangle is tested.',
      cause: 'Children visited in arbitrary order, so the running best stays large and prunes nothing.',
      fix: 'Push the further child first so the nearer pops first.',
    },
    {
      symptom: 'The tree is slower than brute force.',
      cause: 'Expected below the crossover in an interpreted language, and nothing is wrong. Or the leaf size is far too small, so traversal dominates.',
      fix: 'Measure triangles tested to confirm the algorithm is working, then decide whether the mesh is large enough for the tree to pay.',
    },
    {
      symptom: 'Queries near the middle of a hollow mesh are slow.',
      cause: 'Everything is equidistant, so no subtree can be pruned. This is the structural worst case.',
      fix: 'Nothing here fixes it. It is worth knowing that a hierarchy accelerates the common case rather than bounding the worst one.',
    },
    {
      symptom: 'Build time dominates.',
      cause: 'Rebuilding per query, or sorting the whole index array at every node instead of a slice.',
      fix: 'Build once and reuse. Sort only the node’s own range.',
    },
  ],

  mastery: {
    prerequisites:
      'Lesson 8 for the box and its distance, lesson 7 for why a per-item filter has a ceiling and how to measure one, and lesson 6 for the brute-force query this is checked against.',
    signals: [
      'Prunes on pop and can say why that beats pruning on push.',
      'Visits the nearer child first and can demonstrate the difference in triangles tested.',
      'Demands exact agreement with brute force rather than agreement within a tolerance.',
      'Reports work done and time taken as separate numbers.',
      'Can explain why the tree loses at small sizes without concluding that hierarchies are slow.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'mesh-engine-1-8-bounding-volumes', why: 'The box and its distance, which is the bound every prune uses.' },
      { lessonId: 'mesh-engine-1-7-why-brute-force-stops-working', why: 'Why a per-item filter cannot be sublinear, and how to measure a change honestly.' },
      { lessonId: 'mesh-engine-1-6-point-to-mesh', why: 'The brute-force query that is the reference for correctness.' },
      { lessonId: 'dsa3-001', why: 'Hash tables, for the contrast: a different way of making lookup cheap, and why a tree is the right shape here.' },
    ],
    futureLinks: [
      { lessonId: 'mesh-engine-1-10-signed-distance', why: 'With queries fast enough to run hundreds of thousands of times, the question becomes which SIDE of the surface a point is on.' },
    ],
  },

  checkpoints: [
    'I can build a BVH by splitting on the longest axis at the median.',
    'I can traverse one with branch and bound, pruning on pop.',
    'I can say why nearest-child-first matters and demonstrate it.',
    'I can show the result is identical to brute force, not merely close.',
    'I can report work done and time taken separately and explain when they disagree.',
    'I know where a hierarchy degenerates and why.',
  ],

  assessment: {
    task: 'Build a BVH over a mesh, query it, and report both its correctness and its performance honestly.',
    acceptance: [
      'Exact agreement with brute force across many probes.',
      'Triangles tested reported as a fraction of the mesh, at more than one size.',
      'A demonstration that nearest-child-first changes the count and not the answer.',
      'A wall-clock comparison against brute force, with the crossover identified.',
      'An explanation of any gap between the work removed and the time saved.',
    ],
  },

  quiz: [
    {
      question: 'A BVH tests 0.7% of the triangles on an 8,192-triangle mesh. How does its wall-clock time compare to vectorised brute force?',
      options: [
        'Slower — about 0.7x — because the interpreted traversal costs more than the compiled sweep it avoids',
        'About 140x faster, matching the work removed',
        'Identical, since both give the same answer',
        'Faster, but only by about 2x',
      ],
      answer: 0,
      explanation: 'Measured. The crossover is around 32,000 triangles; below it the tree loses despite doing a fraction of the work. The work done and the time taken are different measurements.',
    },
    {
      question: 'Why push the further child first?',
      options: [
        'So the nearer one pops first, giving a good answer early that prunes everything after it',
        'To balance the stack',
        'Because the further child is more likely to be pruned later',
        'It is arbitrary — either order performs the same',
      ],
      answer: 0,
      explanation: 'The stack is last-in-first-out. Visiting in build order still gives the right answer and tests substantially more triangles, because the running best stays large for longer.',
    },
    {
      question: 'Why test a node for pruning when it is popped rather than when it is pushed?',
      options: [
        'Between push and pop a sibling may have found a much better answer, so popping uses better information',
        'Pushing is more expensive',
        'Testing on push gives wrong answers',
        'There is no difference',
      ],
      answer: 0,
      explanation: 'Testing on push is correct but weaker. The running best only improves, so the later you test, the more you can discard.',
    },
    {
      question: 'How close is the BVH answer to brute force?',
      options: [
        'Identical — worst disagreement over 200 queries was exactly zero',
        'Within about 1e-6',
        'Within the leaf size',
        'It is approximate by design',
      ],
      answer: 0,
      explanation: 'A subtree is discarded only when its lower bound already exceeds a distance that has genuinely been achieved. The box distance decides what to skip and never answers the question.',
    },
    {
      question: 'Where does a BVH degenerate to roughly brute force?',
      options: [
        'At the centre of a hollow mesh, where everything is equidistant so nothing can be pruned',
        'On very large meshes',
        'When the query point is far away',
        'When the leaf size is large',
      ],
      answer: 0,
      explanation: 'Pruning exploits some geometry being much nearer than the rest. Where nothing is, there is nothing to exploit — a hierarchy accelerates the common case rather than bounding the worst one.',
    },
    {
      question: 'Sweeping the leaf size, which is true?',
      options: [
        'The size that tests the fewest triangles is not the size that runs fastest — it trades traversal against leaf work',
        'Smaller is always better, since it prunes more finely',
        'Larger is always better, since it reduces tree depth',
        'It makes no measurable difference',
      ],
      answer: 0,
      explanation: 'A small leaf prunes finely and pays for it in traversal; a large leaf does unnecessary work per leaf. It is a knob to sweep on real data rather than a constant to inherit.',
    },
  ],
};
