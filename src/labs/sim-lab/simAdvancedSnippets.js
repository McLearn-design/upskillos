const canvasPreview = (setup, draw) => `${setup}

function init() {}

function update(dt) {
  ctx.fillStyle = '#02060f'
  ctx.fillRect(0, 0, W, H)
  ${draw}
}`

const threePreview = (setup, init, update = 'renderer.render(scene, camera)') => `${setup}

function init() {
  ${init}
}

function update(dt) {
  ${update}
}`

const note = (lines, title, detail) => ({ lines, title, detail })

export const ADVANCED_SIM_SNIPPETS = [
  {
    category: 'Camera',
    color: 'text-cyan-400',
    items: [
      {
        key: 'camera-orbit-setup', label: 'Orbit camera', level: 'Beginner', kind: 'Technique', mode: '3d',
        concepts: ['spherical motion', 'damping', 'target'],
        summary: 'Configure an inspectable camera that orbits a chosen point with controlled zoom and pitch.',
        explanation: [
          'OrbitControls converts pointer motion into spherical camera coordinates around `target`.',
          'Damping spreads an abrupt input over several frames, so `controls.update()` must run every frame.',
        ],
        code: `controls.target.set(0, 1, 0)
controls.enableDamping = true
controls.dampingFactor = 0.08
controls.minDistance = 3
controls.maxDistance = 30
controls.maxPolarAngle = Math.PI * 0.49
camera.position.set(7, 5, 10)
controls.update()`,
        walkthrough: [
          note('1', 'Choose the pivot', '`target` is the world-space point the camera rotates around. Raising y to 1 aims at the object instead of the floor.'),
          note('2–3', 'Smooth pointer input', 'Damping blends the current orbit toward the requested orbit. A smaller factor feels heavier; a larger one catches up faster.'),
          note('4–6', 'Constrain the camera', 'Distance limits prevent clipping or getting lost. The polar limit stops the camera crossing below the ground plane.'),
          note('7–8', 'Place and synchronize', 'Set an initial view, then update the controller so its internal spherical coordinates match the camera.'),
        ],
        previewCode: threePreview('', `const subject=new THREE.Mesh(new THREE.TorusKnotGeometry(1.4,.45,120,16),new THREE.MeshStandardMaterial({color:0x22d3ee,metalness:.35,roughness:.25}));subject.position.y=1.5;scene.add(subject);scene.add(new THREE.GridHelper(24,24,0x0e7490,0x164e63));controls.target.set(0,1.5,0);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=3;controls.maxDistance=30;controls.maxPolarAngle=Math.PI*.49;camera.position.set(7,5,10);controls.update()`),
      },
      {
        key: 'camera-follow', label: 'Smooth follow', level: 'Intermediate', kind: 'Pattern', mode: '3d',
        concepts: ['lerp', 'local offset', 'tracking'],
        summary: 'Follow a moving object from a stable local offset without snapping the camera each frame.',
        explanation: ['Transform the follow offset by the target rotation so “behind” follows the target’s heading.', 'Interpolate both camera position and look target with frame-rate-independent smoothing.'],
        code: `const followOffset = new THREE.Vector3(0, 3, -7)
const desired = followOffset.clone()
  .applyQuaternion(player.quaternion)
  .add(player.position)
const blend = 1 - Math.exp(-6 * dt)
camera.position.lerp(desired, blend)
controls.target.lerp(player.position, blend)`,
        walkthrough: [
          note('1', 'Define the view in local space', 'The offset means three units above and seven units behind the player before rotation is applied.'),
          note('2–4', 'Convert local to world space', 'The player quaternion rotates the offset, then the player position translates it into the scene.'),
          note('5', 'Make smoothing frame-rate independent', 'The exponential blend produces nearly the same motion at 30, 60, or 144 frames per second.'),
          note('6–7', 'Move the eye and its target', 'Lerping both values avoids a camera that moves smoothly but aims with a visible snap.'),
        ],
        previewCode: threePreview('let player,t=0;const followOffset=new THREE.Vector3(0,3,-7);const desired=new THREE.Vector3()', `player=new THREE.Mesh(new THREE.ConeGeometry(.7,2,4),new THREE.MeshStandardMaterial({color:0x38bdf8}));player.rotation.x=Math.PI/2;scene.add(player);scene.add(new THREE.GridHelper(30,30,0x334155,0x172033));controls.enabled=false`, `t+=dt;player.position.set(Math.cos(t*.55)*4,.8,Math.sin(t*.55)*4);player.rotation.z=-t*.55;desired.copy(followOffset).applyQuaternion(player.quaternion).add(player.position);const blend=1-Math.exp(-5*dt);camera.position.lerp(desired,blend);camera.lookAt(player.position);renderer.render(scene,camera)`),
      },
      {
        key: 'camera-orthographic', label: 'Orthographic view', level: 'Intermediate', kind: 'Technique', mode: '3d',
        concepts: ['projection', 'aspect ratio', 'frustum'],
        summary: 'Create a dimensionally stable technical view with no perspective size distortion.',
        explanation: ['Orthographic projection keeps parallel lines parallel and objects the same apparent size at different depths.', 'Compute horizontal bounds from the aspect ratio so circles stay circular after resize.'],
        code: `const viewHeight = 10
const aspect = innerWidth / innerHeight
const ortho = new THREE.OrthographicCamera(
  -viewHeight * aspect / 2,
   viewHeight * aspect / 2,
   viewHeight / 2,
  -viewHeight / 2,
  0.1, 100
)
ortho.position.set(8, 8, 8)
ortho.lookAt(0, 0, 0)`,
        walkthrough: [
          note('1–2', 'Choose visible height first', 'A fixed world-space height makes zoom and scale predictable. Width follows from the viewport aspect ratio.'),
          note('3–9', 'Build the box-shaped frustum', 'Unlike a perspective camera, an orthographic camera views a rectangular prism bounded by left, right, top, bottom, near, and far planes.'),
          note('10–11', 'Aim the technical view', 'An equal x/y/z position creates an isometric-like angle; `lookAt` rotates the camera toward the origin.'),
        ],
        previewCode: threePreview('let ortho,cube', `const h=9,a=innerWidth/innerHeight;ortho=new THREE.OrthographicCamera(-h*a/2,h*a/2,h/2,-h/2,.1,100);ortho.position.set(8,8,8);ortho.lookAt(0,0,0);cube=new THREE.Mesh(new THREE.BoxGeometry(3,3,3),new THREE.MeshNormalMaterial());scene.add(cube);scene.add(new THREE.GridHelper(14,14,0x475569,0x1e293b))`, `cube.rotation.y+=dt*.35;renderer.render(scene,ortho)`),
      },
      {
        key: 'camera-dolly-zoom', label: 'Dolly zoom', level: 'Advanced', kind: 'Mini project', mode: '3d',
        concepts: ['field of view', 'projection', 'trigonometry'],
        summary: 'Move the camera while changing field of view so the subject stays the same size and perspective changes around it.',
        explanation: ['The visible height at a distance is proportional to `distance × tan(fov/2)`.', 'Keeping that product constant preserves subject size while the surrounding depth appears to stretch.'],
        code: `const subjectHeight = 2
const distance = camera.position.distanceTo(subject.position)
const fov = 2 * Math.atan(subjectHeight / (2 * distance))
camera.fov = THREE.MathUtils.radToDeg(fov) * framingScale
camera.updateProjectionMatrix()
camera.lookAt(subject.position)`,
        walkthrough: [
          note('1–2', 'Measure the framing problem', 'The subject height is the world-space size to preserve; distance changes as the camera dollies.'),
          note('3', 'Solve the perspective triangle', 'Half the subject and half the field of view form a right triangle, so inverse tangent recovers the required angle.'),
          note('4–5', 'Apply the lens change', 'Three.js stores FOV in degrees. Any FOV change requires rebuilding the projection matrix.'),
          note('6', 'Keep attention on the subject', 'Dolly motion changes position, so aim the camera again after each move.'),
        ],
        previewCode: threePreview('let subject,t=0', `subject=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshStandardMaterial({color:0xfb7185}));scene.add(subject);for(let z=-10;z<=8;z+=3){const p=new THREE.Mesh(new THREE.TorusGeometry(.7,.18,12,32),new THREE.MeshStandardMaterial({color:0x38bdf8}));p.position.set((z%2)*1.2,0,z);scene.add(p)}controls.enabled=false`, `t+=dt;const distance=7+(Math.sin(t*.65)*.5+.5)*12;camera.position.set(0,2,distance);const fov=2*Math.atan(2/(2*distance));camera.fov=THREE.MathUtils.radToDeg(fov)*2.8;camera.updateProjectionMatrix();camera.lookAt(subject.position);renderer.render(scene,camera)`),
      },
    ],
  },
  {
    category: 'Lighting & Materials',
    color: 'text-yellow-400',
    items: [
      {
        key: 'light-three-point', label: 'Three-point lighting', level: 'Intermediate', kind: 'Recipe', mode: '3d',
        concepts: ['key light', 'fill light', 'rim light'],
        summary: 'Shape a subject with a bright key, a softer fill, and a colored rim light.',
        explanation: ['Each light has a separate job: form, shadow control, and silhouette separation.', 'Lighting ratios matter more than absolute values; start with the key and add only enough fill to recover detail.'],
        code: `const key = new THREE.DirectionalLight(0xfff1dd, 2.4)
key.position.set(5, 7, 4)
const fill = new THREE.DirectionalLight(0x88aaff, 0.7)
fill.position.set(-4, 3, 2)
const rim = new THREE.PointLight(0xff44aa, 2, 20)
rim.position.set(0, 4, -5)
scene.add(key, fill, rim)`,
        walkthrough: [
          note('1–2', 'Key: reveal the form', 'A warm, strong light above and to one side produces the dominant highlights and shadows.'),
          note('3–4', 'Fill: control contrast', 'The cool fill comes from the opposite side at lower intensity, lifting dark areas without flattening them.'),
          note('5–6', 'Rim: separate the silhouette', 'A light behind the subject catches its edge. Distance limits the colored spill.'),
          note('7', 'Add the complete rig', 'A single `scene.add` accepts multiple objects, keeping the setup concise.'),
        ],
        previewCode: threePreview('', `const subject=new THREE.Mesh(new THREE.TorusKnotGeometry(1.5,.45,140,20),new THREE.MeshStandardMaterial({color:0x64748b,roughness:.35,metalness:.25}));scene.add(subject);const key=new THREE.DirectionalLight(0xfff1dd,2.4);key.position.set(5,7,4);const fill=new THREE.DirectionalLight(0x88aaff,.7);fill.position.set(-4,3,2);const rim=new THREE.PointLight(0xff44aa,2,20);rim.position.set(0,4,-5);scene.add(key,fill,rim);camera.position.set(0,1,8)`),
      },
      {
        key: 'light-spotlight', label: 'Spotlight cone', level: 'Intermediate', kind: 'Technique', mode: '3d',
        concepts: ['cone angle', 'penumbra', 'target'],
        summary: 'Aim a soft-edged cone of light at a moving target.',
        explanation: ['A spotlight points toward a separate target object, which must also be in the scene.', 'Penumbra blends the cone edge; decay controls physically inspired distance falloff.'],
        code: `const spot = new THREE.SpotLight(0x66ddff, 4, 30)
spot.position.set(4, 8, 5)
spot.angle = Math.PI / 7
spot.penumbra = 0.45
spot.decay = 2
spot.target.position.set(0, 0, 0)
scene.add(spot, spot.target)`,
        walkthrough: [
          note('1–2', 'Create and place the source', 'Intensity is deliberately high because spotlight energy is limited to a cone and falls with distance.'),
          note('3–5', 'Shape the beam', 'Angle sets cone width, penumbra softens its boundary, and decay controls attenuation.'),
          note('6–7', 'Aim through a target object', 'The light reads the target’s world position. Adding the target lets its transforms update correctly.'),
        ],
        previewCode: threePreview('let spot,t=0', `const floor=new THREE.Mesh(new THREE.PlaneGeometry(16,16),new THREE.MeshStandardMaterial({color:0x172033}));floor.rotation.x=-Math.PI/2;scene.add(floor);const target=new THREE.Mesh(new THREE.SphereGeometry(1,32,32),new THREE.MeshStandardMaterial({color:0x94a3b8}));target.position.y=1;scene.add(target);spot=new THREE.SpotLight(0x66ddff,5,30,Math.PI/7,.45,2);spot.position.set(4,8,5);spot.target=target;scene.add(spot);camera.position.set(8,6,9);camera.lookAt(0,1,0)`, `t+=dt;spot.position.x=Math.cos(t)*5;spot.position.z=Math.sin(t)*5;renderer.render(scene,camera)`),
      },
      {
        key: 'material-fresnel', label: 'Fresnel rim shader', level: 'Advanced', kind: 'Shader', mode: '3d',
        concepts: ['normals', 'view direction', 'dot product'],
        summary: 'Create a glowing edge by comparing the surface normal with the direction toward the camera.',
        explanation: ['A surface facing the camera has a large normal/view dot product; silhouettes approach zero.', 'Subtracting from one and raising to a power isolates a controllable rim.'],
        code: `const material = new THREE.ShaderMaterial({
  uniforms: { rimColor: { value: new THREE.Color(0x55ddff) } },
  vertexShader: \`varying vec3 n, eye;
    void main(){
      vec4 world = modelMatrix * vec4(position, 1.0);
      n = normalize(mat3(modelMatrix) * normal);
      eye = normalize(cameraPosition - world.xyz);
      gl_Position = projectionMatrix * viewMatrix * world;
    }\`,
  fragmentShader: \`uniform vec3 rimColor; varying vec3 n, eye;
    void main(){
      float rim = pow(1.0 - max(dot(n, eye), 0.0), 3.0);
      gl_FragColor = vec4(rimColor * (0.15 + rim), 1.0);
    }\`
})`,
        walkthrough: [
          note('1–2', 'Expose a color uniform', 'Uniforms are JavaScript values sent to every shader invocation without rebuilding geometry.'),
          note('3–9', 'Prepare world-space vectors', 'The vertex shader transforms each normal and calculates the direction from that vertex to the camera.'),
          note('11–14', 'Measure grazing angle', 'The dot product is largest face-on. Inverting it makes edge-facing fragments bright, and `pow` tightens the glow.'),
          note('15', 'Write the final pixel', 'A small base term keeps the center visible while the rim term adds the strong edge color.'),
        ],
        previewCode: threePreview('let mesh', `const material=new THREE.ShaderMaterial({uniforms:{rimColor:{value:new THREE.Color(0x55ddff)}},vertexShader:'varying vec3 n,eye;void main(){vec4 world=modelMatrix*vec4(position,1.0);n=normalize(mat3(modelMatrix)*normal);eye=normalize(cameraPosition-world.xyz);gl_Position=projectionMatrix*viewMatrix*world;}',fragmentShader:'uniform vec3 rimColor;varying vec3 n,eye;void main(){float rim=pow(1.0-max(dot(n,eye),0.0),3.0);gl_FragColor=vec4(rimColor*(0.12+rim),1.0);}'});mesh=new THREE.Mesh(new THREE.TorusKnotGeometry(1.6,.5,160,24),material);scene.add(mesh);camera.position.set(0,0,8)`, `mesh.rotation.y+=dt*.3;renderer.render(scene,camera)`),
      },
      {
        key: 'material-vertex-colors', label: 'Vertex colors', level: 'Advanced', kind: 'Technique', mode: '3d',
        concepts: ['buffer attributes', 'interpolation', 'color mapping'],
        summary: 'Attach a color to every vertex and let the GPU interpolate a continuous surface gradient.',
        explanation: ['Buffer attributes line up data with geometry vertices.', 'The fragment stage receives smoothly interpolated colors between triangle corners.'],
        code: `const geometry = new THREE.SphereGeometry(2, 48, 24)
const colors = []
for (const y of geometry.attributes.position.array.filter((_, i) => i % 3 === 1)) {
  const t = (y + 2) / 4
  const c = new THREE.Color().setHSL(0.65 - t * 0.55, 0.9, 0.55)
  colors.push(c.r, c.g, c.b)
}
geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
const material = new THREE.MeshStandardMaterial({ vertexColors: true })`,
        walkthrough: [
          note('1–2', 'Create matching storage', 'The color array will contain three numbers for every position vertex.'),
          note('3–7', 'Map height into color', 'Read every y component, normalize it into 0–1, convert that value into an HSL hue, and append RGB components.'),
          note('8', 'Attach GPU data', 'Item size 3 tells Three.js that each vertex color contains red, green, and blue.'),
          note('9', 'Enable the attribute', 'The material ignores the color buffer unless `vertexColors` is enabled.'),
        ],
        previewCode: threePreview('let mesh', `const g=new THREE.SphereGeometry(2,48,24),colors=[];const p=g.attributes.position;for(let i=0;i<p.count;i++){const t=(p.getY(i)+2)/4,c=new THREE.Color().setHSL(.65-t*.55,.9,.55);colors.push(c.r,c.g,c.b)}g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.35}));scene.add(mesh);camera.position.set(0,0,7)`, `mesh.rotation.y+=dt*.25;renderer.render(scene,camera)`),
      },
    ],
  },
  {
    category: 'Rotation & Linear Algebra',
    color: 'text-fuchsia-400',
    items: [
      {
        key: 'quaternion-axis-angle', label: 'Axis-angle quaternion', level: 'Intermediate', kind: 'Technique', mode: '3d',
        concepts: ['quaternion', 'axis-angle', 'normalization'],
        summary: 'Rotate around any axis with a quaternion instead of accumulating Euler angles.',
        explanation: ['A quaternion stores orientation without choosing an ordered sequence of x/y/z rotations.', 'The rotation axis must be unit length or the quaternion will not represent the requested angle correctly.'],
        code: `const axis = new THREE.Vector3(1, 1, 0).normalize()
const angle = Math.PI / 3
const rotation = new THREE.Quaternion()
  .setFromAxisAngle(axis, angle)
mesh.quaternion.copy(rotation)`,
        walkthrough: [
          note('1', 'Define one physical axis', 'Normalization separates direction from magnitude so only `angle` controls how far the object turns.'),
          note('2', 'Express the turn in radians', 'π/3 is a 60° rotation. Axis-angle is often easier to reason about than three Euler components.'),
          note('3–4', 'Encode orientation', 'The quaternion packages the axis and half-angle sine/cosine terms into a stable rotation representation.'),
          note('5', 'Apply orientation directly', 'Copying to `mesh.quaternion` avoids converting through Euler angles.'),
        ],
        previewCode: threePreview('let mesh,t=0;const axis=new THREE.Vector3(1,1,0).normalize()', `mesh=new THREE.Mesh(new THREE.BoxGeometry(3,1,1),new THREE.MeshNormalMaterial());scene.add(mesh);camera.position.set(5,4,8);camera.lookAt(0,0,0);scene.add(new THREE.AxesHelper(4))`, `t+=dt;mesh.quaternion.setFromAxisAngle(axis,t);renderer.render(scene,camera)`),
      },
      {
        key: 'quaternion-slerp', label: 'Quaternion slerp', level: 'Advanced', kind: 'Pattern', mode: '3d',
        concepts: ['slerp', 'shortest arc', 'gimbal lock'],
        summary: 'Interpolate orientations along the shortest spherical path with constant angular behavior.',
        explanation: ['Slerp treats orientations as points on a four-dimensional unit sphere.', 'Because it interpolates orientations rather than Euler components, it avoids axis-order artifacts and gimbal lock during the blend.'],
        code: `const target = new THREE.Quaternion()
  .setFromEuler(new THREE.Euler(0, Math.PI, Math.PI / 3))
const blend = 1 - Math.exp(-5 * dt)
mesh.quaternion.slerp(target, blend)`,
        walkthrough: [
          note('1–2', 'Build a target orientation once', 'Euler angles are acceptable as input; the ongoing animation remains in quaternion space.'),
          note('3', 'Compute a time-correct blend', 'Exponential smoothing converges consistently across different frame rates.'),
          note('4', 'Follow the shortest orientation arc', '`slerp` rotates directly between orientations instead of interpolating x, y, and z independently.'),
        ],
        previewCode: threePreview('let mesh,target,t=0', `mesh=new THREE.Mesh(new THREE.BoxGeometry(3,.8,1),new THREE.MeshNormalMaterial());scene.add(mesh);target=new THREE.Quaternion();camera.position.set(5,4,8);camera.lookAt(0,0,0);scene.add(new THREE.AxesHelper(3))`, `t+=dt;if(Math.floor(t/2)%2===0)target.setFromEuler(new THREE.Euler(Math.PI/2,Math.PI,Math.PI/3));else target.identity();mesh.quaternion.slerp(target,1-Math.exp(-4*dt));renderer.render(scene,camera)`),
      },
      {
        key: 'quaternion-look-rotation', label: 'Look rotation', level: 'Advanced', kind: 'Technique', mode: '3d',
        concepts: ['basis matrix', 'forward vector', 'quaternion'],
        summary: 'Build a stable orientation from a forward direction and an up reference.',
        explanation: ['A look rotation constructs an orthonormal coordinate frame, then converts that matrix to a quaternion.', 'This is the foundation of cameras, turrets, steering agents, and surface alignment.'],
        code: `function lookRotation(forward, up = new THREE.Vector3(0, 1, 0)) {
  const z = forward.clone().normalize().negate()
  const x = new THREE.Vector3().crossVectors(up, z).normalize()
  const y = new THREE.Vector3().crossVectors(z, x)
  const basis = new THREE.Matrix4().makeBasis(x, y, z)
  return new THREE.Quaternion().setFromRotationMatrix(basis)
}
mesh.quaternion.copy(lookRotation(target.clone().sub(mesh.position)))`,
        walkthrough: [
          note('1–2', 'Choose the local forward axis', 'Three.js cameras and many objects look down local −z, so the desired world direction is negated.'),
          note('3–4', 'Construct perpendicular axes', 'Cross products create right and corrected-up directions, producing an orthogonal basis.'),
          note('5–6', 'Convert basis into orientation', 'A basis matrix describes the rotated local axes; the quaternion is its compact rotation form.'),
          note('8', 'Aim at a point', 'Subtracting positions produces the direction from the mesh to the target.'),
        ],
        previewCode: threePreview('let mesh,target,t=0;function lookRotation(forward,up=new THREE.Vector3(0,1,0)){const z=forward.clone().normalize().negate(),x=new THREE.Vector3().crossVectors(up,z).normalize(),y=new THREE.Vector3().crossVectors(z,x),basis=new THREE.Matrix4().makeBasis(x,y,z);return new THREE.Quaternion().setFromRotationMatrix(basis)}', `mesh=new THREE.Mesh(new THREE.ConeGeometry(.55,2,4),new THREE.MeshNormalMaterial());mesh.rotation.x=Math.PI/2;scene.add(mesh);target=new THREE.Mesh(new THREE.SphereGeometry(.25,16,16),new THREE.MeshBasicMaterial({color:0xfb7185}));scene.add(target);camera.position.set(0,6,10);camera.lookAt(0,0,0)`, `t+=dt;target.position.set(Math.cos(t)*3,Math.sin(t*1.7)*1.5,Math.sin(t)*3);mesh.quaternion.slerp(lookRotation(target.position.clone().sub(mesh.position)),1-Math.exp(-7*dt));renderer.render(scene,camera)`),
      },
      {
        key: 'math-dot-facing', label: 'Dot: facing test', level: 'Beginner', kind: 'Math lab', mode: '3d',
        concepts: ['dot product', 'angle', 'visibility'],
        summary: 'Measure whether a target is in front of an object and how closely it aligns with forward.',
        explanation: ['For normalized vectors, the dot product equals cosine of the angle between them.', 'Positive means the target is within the forward hemisphere; a threshold such as 0.8 creates a narrower field of view.'],
        code: `const forward = new THREE.Vector3(0, 0, -1)
  .applyQuaternion(observer.quaternion)
const toTarget = target.position.clone()
  .sub(observer.position)
  .normalize()
const alignment = forward.dot(toTarget)
const visible = alignment > Math.cos(THREE.MathUtils.degToRad(35))`,
        walkthrough: [
          note('1–2', 'Find world-space forward', 'Rotate the object’s local −z axis by its current orientation.'),
          note('3–5', 'Build a direction to the target', 'Subtract origin from destination and normalize so distance cannot influence the angular test.'),
          note('6', 'Collapse two vectors to one score', 'The dot result ranges from −1 behind, through 0 sideways, to 1 directly ahead.'),
          note('7', 'Convert an angle to a threshold', 'Cosine turns a readable 35° half-angle into the dot-product value used by the test.'),
        ],
        previewCode: threePreview('let observer,target,t=0', `observer=new THREE.Mesh(new THREE.ConeGeometry(.7,2,4),new THREE.MeshStandardMaterial({color:0x38bdf8}));observer.rotation.x=Math.PI/2;scene.add(observer);target=new THREE.Mesh(new THREE.SphereGeometry(.45,20,20),new THREE.MeshStandardMaterial({color:0xfb7185}));scene.add(target);camera.position.set(0,7,11);camera.lookAt(0,0,0)`, `t+=dt;target.position.set(Math.cos(t)*4,0,Math.sin(t)*4);const forward=new THREE.Vector3(0,0,-1).applyQuaternion(observer.quaternion),to=target.position.clone().sub(observer.position).normalize(),visible=forward.dot(to)>Math.cos(THREE.MathUtils.degToRad(35));target.material.color.set(visible?0x4ade80:0xfb7185);renderer.render(scene,camera)`),
      },
      {
        key: 'math-cross-basis', label: 'Cross: surface basis', level: 'Intermediate', kind: 'Math lab', mode: '3d',
        concepts: ['cross product', 'tangent space', 'orthonormal basis'],
        summary: 'Create tangent directions that lie on a surface from only its normal vector.',
        explanation: ['The cross product returns a vector perpendicular to both inputs.', 'A second cross product completes a right-handed tangent/bitangent/normal coordinate frame.'],
        code: `const normal = hit.face.normal.clone().normalize()
const helper = Math.abs(normal.y) < 0.9
  ? new THREE.Vector3(0, 1, 0)
  : new THREE.Vector3(1, 0, 0)
const tangent = new THREE.Vector3()
  .crossVectors(helper, normal).normalize()
const bitangent = new THREE.Vector3()
  .crossVectors(normal, tangent).normalize()`,
        walkthrough: [
          note('1', 'Start with the surface normal', 'Normalization makes the basis vectors unit length and suitable for rotation or measurement.'),
          note('2–4', 'Avoid a parallel helper', 'A cross product collapses near zero for parallel inputs, so choose whichever world axis is less aligned with the normal.'),
          note('5–6', 'Create the first surface direction', 'Crossing helper with normal produces a tangent that lies in the surface plane.'),
          note('7–8', 'Complete the frame', 'Cross normal with tangent to produce a perpendicular bitangent with consistent handedness.'),
        ],
        previewCode: threePreview('let arrows=[],t=0', `camera.position.set(5,4,8);camera.lookAt(0,0,0)`, `t+=dt;arrows.forEach(a=>scene.remove(a));arrows=[];const normal=new THREE.Vector3(Math.cos(t)*.7,1,Math.sin(t)*.7).normalize(),helper=Math.abs(normal.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0),tangent=new THREE.Vector3().crossVectors(helper,normal).normalize(),bitangent=new THREE.Vector3().crossVectors(normal,tangent).normalize();arrows=[new THREE.ArrowHelper(normal,new THREE.Vector3(),3,0x4ade80),new THREE.ArrowHelper(tangent,new THREE.Vector3(),3,0x38bdf8),new THREE.ArrowHelper(bitangent,new THREE.Vector3(),3,0xfb7185)];scene.add(...arrows);renderer.render(scene,camera)`),
      },
      {
        key: 'matrix-compose', label: 'Compose a transform', level: 'Intermediate', kind: 'Math lab', mode: '3d',
        concepts: ['matrix', 'translation', 'rotation', 'scale'],
        summary: 'Combine position, quaternion rotation, and scale into one 4×4 transform matrix.',
        explanation: ['A transform matrix maps local coordinates into parent coordinates in one multiplication.', 'Composition keeps translation, rotation, and scale explicit while allowing efficient application to many points.'],
        code: `const position = new THREE.Vector3(3, 1, -2)
const rotation = new THREE.Quaternion()
  .setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4)
const scale = new THREE.Vector3(2, 0.5, 1)
const transform = new THREE.Matrix4()
  .compose(position, rotation, scale)
point.applyMatrix4(transform)`,
        walkthrough: [
          note('1', 'Translation component', 'Position occupies the last column of the matrix and moves the transformed result.'),
          note('2–3', 'Rotation component', 'A quaternion supplies a normalized, axis-order-independent orientation.'),
          note('4', 'Scale component', 'Non-uniform values stretch different local axes by different amounts.'),
          note('5–7', 'Compose and apply', 'Three.js builds the conventional translation × rotation × scale matrix, then transforms the point from local to world-like coordinates.'),
        ],
        previewCode: threePreview('let mesh,t=0', `mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshNormalMaterial());mesh.matrixAutoUpdate=false;scene.add(mesh);scene.add(new THREE.AxesHelper(4));camera.position.set(7,5,10);camera.lookAt(0,0,0)`, `t+=dt;const p=new THREE.Vector3(Math.sin(t)*2,1,-2),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),t),s=new THREE.Vector3(2,.5,1);mesh.matrix.compose(p,q,s);renderer.render(scene,camera)`),
      },
    ],
  },
  {
    category: 'Collisions & Dynamics',
    color: 'text-rose-400',
    items: [
      {
        key: 'collision-circle-circle', label: 'Circle overlap', level: 'Beginner', kind: 'Technique', mode: '2d',
        concepts: ['distance', 'penetration', 'normal'],
        summary: 'Detect two overlapping circles and compute the normal and depth needed to separate them.',
        explanation: ['Circles overlap when center distance is smaller than the sum of radii.', 'The collision normal points from A to B; penetration depth says how far they overlap.'],
        code: `function circleContact(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y
  const distance = Math.hypot(dx, dy)
  const radiusSum = a.r + b.r
  if (distance >= radiusSum) return null
  const safe = distance || 1
  return {
    nx: dx / safe, ny: dy / safe,
    depth: radiusSum - distance
  }
}`,
        walkthrough: [
          note('1–4', 'Measure center separation', 'Subtract positions, use Pythagorean distance, and compare it with the combined reach of both circles.'),
          note('5', 'Reject non-collisions early', 'Touching or separated circles require no penetration correction.'),
          note('6', 'Protect the coincident case', 'If centers are identical there is no unique normal, so the divisor uses a safe fallback.'),
          note('7–10', 'Return reusable contact data', 'Normalized x/y components provide direction while depth provides correction magnitude.'),
        ],
        previewCode: canvasPreview('let t=0;const a={x:0,y:0,r:45},b={x:0,y:0,r:55};function circleContact(a,b){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),sum=a.r+b.r;if(d>=sum)return null;const safe=d||1;return{nx:dx/safe,ny:dy/safe,depth:sum-d}}', `t+=dt;a.x=W/2-70;a.y=H/2;b.x=W/2+Math.cos(t)*110;b.y=H/2+Math.sin(t*1.3)*70;const hit=circleContact(a,b);for(const [o,c] of [[a,'#38bdf8'],[b,hit?'#fb7185':'#4ade80']]){ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fillStyle=c;ctx.globalAlpha=.7;ctx.fill()}ctx.globalAlpha=1;if(hit){ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(a.x+hit.nx*hit.depth*2,a.y+hit.ny*hit.depth*2);ctx.stroke()}`),
      },
      {
        key: 'collision-aabb', label: 'AABB collision', level: 'Beginner', kind: 'Technique', mode: '2d',
        concepts: ['interval overlap', 'broad phase', 'bounds'],
        summary: 'Test axis-aligned rectangles by checking whether their x and y intervals overlap.',
        explanation: ['Separating-axis logic says one non-overlapping axis is enough to prove there is no collision.', 'AABBs are fast and useful as a broad-phase filter before more expensive shape tests.'],
        code: `function overlaps(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y
}`,
        walkthrough: [
          note('1', 'Accept two bounds', 'Each rectangle is represented by its top-left corner plus width and height.'),
          note('2–5', 'Require overlap on both axes', 'The first pair checks horizontal interval overlap; the second pair checks vertical overlap. All four comparisons must hold.'),
        ],
        previewCode: canvasPreview('let t=0;const a={x:0,y:0,w:100,h:75},b={x:0,y:0,w:110,h:90};const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y', `t+=dt;a.x=W/2-50;a.y=H/2-37;b.x=W/2+Math.cos(t)*160-55;b.y=H/2+Math.sin(t*1.4)*95-45;const hit=overlaps(a,b);ctx.fillStyle='#38bdf8aa';ctx.fillRect(a.x,a.y,a.w,a.h);ctx.fillStyle=hit?'#fb7185aa':'#4ade80aa';ctx.fillRect(b.x,b.y,b.w,b.h)`),
      },
      {
        key: 'collision-sphere-impulse', label: 'Sphere impulse', level: 'Advanced', kind: 'Physics solver', mode: '3d',
        concepts: ['impulse', 'restitution', 'relative velocity'],
        summary: 'Resolve a sphere collision using a momentum impulse along the contact normal.',
        explanation: ['Only the relative velocity along the collision normal participates in a frictionless normal impulse.', 'Inverse masses distribute the velocity change; restitution controls retained bounce energy.'],
        code: `const n = b.position.clone().sub(a.position).normalize()
const relative = b.velocity.clone().sub(a.velocity)
const closingSpeed = relative.dot(n)
if (closingSpeed < 0) {
  const e = 0.8
  const j = -(1 + e) * closingSpeed /
    (1 / a.mass + 1 / b.mass)
  const impulse = n.multiplyScalar(j)
  a.velocity.addScaledVector(impulse, -1 / a.mass)
  b.velocity.addScaledVector(impulse,  1 / b.mass)
}`,
        walkthrough: [
          note('1–3', 'Project motion onto contact', 'The normal isolates the one-dimensional collision axis; the dot product measures approach or separation speed on it.'),
          note('4', 'Resolve only approaching bodies', 'A positive value means they are already separating, so another impulse would pull them back together.'),
          note('5–7', 'Solve impulse magnitude', 'Restitution scales bounce and the inverse-mass sum accounts for how freely each body can change velocity.'),
          note('8–10', 'Apply equal and opposite impulse', 'Newton’s third law gives each body opposite momentum change, divided by its own mass to obtain velocity change.'),
        ],
        previewCode: threePreview('let balls=[]', `for(let i=0;i<2;i++){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.8,24,24),new THREE.MeshStandardMaterial({color:i?0xfb7185:0x38bdf8}));mesh.position.x=i?3:-3;scene.add(mesh);balls.push({mesh,velocity:new THREE.Vector3(i?-2:2,0,0),mass:i?2:1})}camera.position.set(0,3,10);camera.lookAt(0,0,0)`, `const [a,b]=balls;a.mesh.position.addScaledVector(a.velocity,dt);b.mesh.position.addScaledVector(b.velocity,dt);const delta=b.mesh.position.clone().sub(a.mesh.position),dist=delta.length();if(dist<1.6){const n=delta.normalize(),relative=b.velocity.clone().sub(a.velocity),closing=relative.dot(n);if(closing<0){const j=-(1+.85)*closing/(1/a.mass+1/b.mass),impulse=n.multiplyScalar(j);a.velocity.addScaledVector(impulse,-1/a.mass);b.velocity.addScaledVector(impulse,1/b.mass)}}for(const o of balls)if(Math.abs(o.mesh.position.x)>5)o.velocity.x*=-1;renderer.render(scene,camera)`),
      },
      {
        key: 'collision-ray-sphere', label: 'Ray–sphere hit', level: 'Intermediate', kind: 'Math lab', mode: '3d',
        concepts: ['quadratic', 'projection', 'intersection'],
        summary: 'Find the nearest point where a ray intersects a sphere using a geometric projection.',
        explanation: ['Project the center vector onto the ray to find the closest approach.', 'Pythagoras gives the half-chord through the sphere, which turns closest approach into entry distance.'],
        code: `function raySphere(origin, direction, center, radius) {
  const toCenter = center.clone().sub(origin)
  const along = toCenter.dot(direction)
  const closestSq = toCenter.lengthSq() - along * along
  const radiusSq = radius * radius
  if (closestSq > radiusSq) return null
  const halfChord = Math.sqrt(radiusSq - closestSq)
  const distance = along - halfChord
  return distance >= 0 ? distance : along + halfChord
}`,
        walkthrough: [
          note('1–3', 'Locate closest approach', 'Dotting the center offset with a normalized ray direction gives signed distance along the ray.'),
          note('4–6', 'Reject a miss', 'Subtract the along-ray component from total squared distance. If the remainder exceeds radius squared, the ray passes outside.'),
          note('7–8', 'Recover the entry point', 'The half-chord length spans from closest approach to either sphere surface; subtract it for the near hit.'),
          note('9', 'Handle an origin inside the sphere', 'If the entry is behind the ray, return the farther exit intersection instead.'),
        ],
        previewCode: threePreview('let sphere,line,t=0;function raySphere(o,d,c,r){const v=c.clone().sub(o),along=v.dot(d),closest=v.lengthSq()-along*along,rs=r*r;if(closest>rs)return null;const half=Math.sqrt(rs-closest),near=along-half;return near>=0?near:along+half}', `sphere=new THREE.Mesh(new THREE.SphereGeometry(2,32,32),new THREE.MeshStandardMaterial({color:0x64748b,transparent:true,opacity:.7}));scene.add(sphere);camera.position.set(0,6,11);camera.lookAt(0,0,0)`, `t+=dt;if(line)scene.remove(line);const origin=new THREE.Vector3(-6,Math.sin(t)*3,2),dir=new THREE.Vector3(1,0,-.25).normalize(),distance=raySphere(origin,dir,sphere.position,2),end=origin.clone().addScaledVector(dir,distance??12);line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin,end]),new THREE.LineBasicMaterial({color:distance===null?0xfb7185:0x4ade80}));scene.add(line);sphere.material.color.set(distance===null?0x64748b:0x4ade80);renderer.render(scene,camera)`),
      },
      {
        key: 'dynamics-verlet-rope', label: 'Verlet rope', level: 'Advanced', kind: 'Mini project', mode: '2d',
        concepts: ['Verlet integration', 'constraints', 'iterations'],
        summary: 'Build a rope from particles whose distance constraints are repeatedly corrected.',
        explanation: ['Verlet stores current and previous positions, deriving velocity implicitly from their difference.', 'Constraint iterations trade CPU time for a stiffer rope without requiring enormous spring forces.'],
        code: `for (const p of points) {
  const vx = (p.x - p.oldX) * 0.995
  const vy = (p.y - p.oldY) * 0.995
  p.oldX = p.x; p.oldY = p.y
  p.x += vx; p.y += vy + gravity * dt * dt
}
for (let pass = 0; pass < 8; pass++) {
  for (const [a, b] of links) {
    const dx = b.x-a.x, dy = b.y-a.y
    const error = (Math.hypot(dx,dy)-length) / Math.hypot(dx,dy)
    a.x += dx*error*0.5; a.y += dy*error*0.5
    b.x -= dx*error*0.5; b.y -= dy*error*0.5
  }
}`,
        walkthrough: [
          note('1–6', 'Integrate without explicit velocity', 'Current minus previous position is last frame’s displacement. Damping reduces it, then gravity contributes acceleration times dt².'),
          note('7–8', 'Iterate the solver', 'One correction pass leaves residual error. Repeating the constraints makes the chain appear less stretchy.'),
          note('9–11', 'Measure length error', 'The normalized error is positive when a segment is too long and negative when compressed.'),
          note('12–13', 'Split correction', 'Each free endpoint moves half the error in opposite directions, preserving the segment center.'),
        ],
        previewCode: canvasPreview(`const points=Array.from({length:18},(_,i)=>({x:80+i*18,y:70,oldX:80+i*18,oldY:70,pinned:i===0}));const length=18,gravity=900`, `for(const p of points){if(p.pinned)continue;const vx=(p.x-p.oldX)*.995,vy=(p.y-p.oldY)*.995;p.oldX=p.x;p.oldY=p.y;p.x+=vx;p.y+=vy+gravity*dt*dt}for(let pass=0;pass<9;pass++){points[0].x=W*.2;points[0].y=60;for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,error=(d-length)/d;if(!a.pinned){a.x+=dx*error*.5;a.y+=dy*error*.5}b.x-=dx*error*.5;b.y-=dy*error*.5}}ctx.strokeStyle='#38bdf8';ctx.lineWidth=4;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke()`),
      },
      {
        key: 'dynamics-particle-emitter', label: 'Particle emitter', level: 'Intermediate', kind: 'Mini project', mode: '2d',
        concepts: ['object pool', 'lifetime', 'procedural motion'],
        summary: 'Emit, update, fade, and recycle a bounded set of particles.',
        explanation: ['A lifetime gives every particle a deterministic removal condition.', 'Capping the collection prevents an effect from becoming an accidental memory and performance leak.'],
        code: `function emit(x, y) {
  const angle = Math.random() * Math.PI * 2
  const speed = 40 + Math.random() * 120
  particles.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 1
  })
  if (particles.length > 500) particles.shift()
}
for (const p of particles) {
  p.vy += 90 * dt
  p.x += p.vx * dt; p.y += p.vy * dt
  p.life -= dt
}
particles = particles.filter(p => p.life > 0)`,
        walkthrough: [
          note('1–3', 'Sample an initial velocity', 'A random angle covers every direction while randomized speed prevents a perfectly uniform ring.'),
          note('4–9', 'Store independent particle state', 'Position, velocity, and remaining life are all the update loop needs.'),
          note('10', 'Enforce a hard budget', 'Removing the oldest particle makes performance predictable even if emission spikes.'),
          note('12–17', 'Advance and retire', 'Gravity changes vertical velocity, velocity changes position, and lifetime decides which particles survive.'),
        ],
        previewCode: canvasPreview('let particles=[];function emit(x,y){const a=Math.random()*Math.PI*2,s=40+Math.random()*120;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1});if(particles.length>500)particles.shift()}', `for(let i=0;i<5;i++)emit(W/2,H/2);for(const p of particles){p.vy+=90*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle='#38bdf8';ctx.fillRect(p.x,p.y,4,4)}ctx.globalAlpha=1;particles=particles.filter(p=>p.life>0)`),
      },
    ],
  },
  {
    category: 'Effects & Custom Drawing',
    color: 'text-emerald-400',
    items: [
      {
        key: 'draw-motion-trails', label: 'Motion trails', level: 'Beginner', kind: 'Effect', mode: '2d',
        concepts: ['alpha blending', 'feedback', 'persistence'],
        summary: 'Fade old frames instead of erasing them to produce inexpensive motion trails.',
        explanation: ['A translucent background preserves part of the previous frame.', 'Lower alpha produces longer trails; higher alpha erases history faster.'],
        code: `ctx.fillStyle = 'rgba(2, 6, 15, 0.12)'
ctx.fillRect(0, 0, W, H)
ctx.beginPath()
ctx.arc(x, y, 8, 0, Math.PI * 2)
ctx.fillStyle = '#38bdf8'
ctx.fill()`,
        walkthrough: [
          note('1–2', 'Partially cover history', 'Alpha 0.12 replaces only a small fraction of each old pixel, creating exponential decay over many frames.'),
          note('3–6', 'Draw the newest sample opaque', 'The current position remains crisp while older positions fade behind it.'),
        ],
        previewCode: `let t=0
function init(){ctx.fillStyle='#02060f';ctx.fillRect(0,0,W,H)}
function update(dt){t+=dt;ctx.fillStyle='rgba(2,6,15,.12)';ctx.fillRect(0,0,W,H);const x=W/2+Math.cos(t*1.7)*W*.3,y=H/2+Math.sin(t*2.3)*H*.3;ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.fillStyle='#38bdf8';ctx.fill()}`,
      },
      {
        key: 'draw-bezier', label: 'Cubic Bézier', level: 'Intermediate', kind: 'Drawing', mode: '2d',
        concepts: ['parametric curve', 'control points', 'handles'],
        summary: 'Draw and understand a cubic Bézier curve controlled by two endpoint tangents.',
        explanation: ['The curve starts at P0 and ends at P3.', 'P1 pulls the departure tangent and P2 pulls the arrival tangent without requiring the curve to pass through either handle.'],
        code: `ctx.beginPath()
ctx.moveTo(p0.x, p0.y)
ctx.bezierCurveTo(
  p1.x, p1.y,
  p2.x, p2.y,
  p3.x, p3.y
)
ctx.stroke()`,
        walkthrough: [
          note('1–2', 'Start at the first endpoint', '`moveTo` changes the path cursor without creating an unwanted line from a previous shape.'),
          note('3–7', 'Supply two handles and an endpoint', 'Canvas evaluates the cubic Bernstein-polynomial blend between all four points.'),
          note('8', 'Rasterize the path', 'Path commands only describe geometry; `stroke` turns it into visible pixels using current line settings.'),
        ],
        previewCode: canvasPreview('let t=0', `t+=dt;const p0={x:40,y:H-50},p1={x:W*.3,y:40+Math.sin(t)*60},p2={x:W*.7,y:H-40},p3={x:W-40,y:60};ctx.strokeStyle='#475569';ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.moveTo(p2.x,p2.y);ctx.lineTo(p3.x,p3.y);ctx.stroke();ctx.strokeStyle='#4ade80';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.bezierCurveTo(p1.x,p1.y,p2.x,p2.y,p3.x,p3.y);ctx.stroke()`),
      },
      {
        key: 'draw-star-polygon', label: 'Custom star path', level: 'Beginner', kind: 'Drawing', mode: '2d',
        concepts: ['polar coordinates', 'path construction', 'alternating radius'],
        summary: 'Generate a reusable star or gear-like polygon procedurally.',
        explanation: ['Alternating outer and inner radii produces points and valleys.', 'The same polar-to-Cartesian conversion works for regular polygons, gears, flowers, and radial charts.'],
        code: `function starPath(ctx, cx, cy, points, outer, inner) {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const angle = -Math.PI/2 + i * Math.PI/points
    const radius = i % 2 ? inner : outer
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
  }
  ctx.closePath()
}`,
        walkthrough: [
          note('1–3', 'Create two vertices per point', 'Each visible point needs one outer tip and one inner valley, so a five-point star uses ten vertices.'),
          note('4–6', 'Convert polar samples to pixels', 'The angle advances uniformly while radius alternates. Cosine supplies x and sine supplies y.'),
          note('7', 'Start once, then connect', 'The first vertex moves the path cursor; every later vertex adds an edge.'),
          note('9', 'Close the final edge', '`closePath` connects the last vertex back to the first and makes fills seamless.'),
        ],
        previewCode: canvasPreview('let t=0;function starPath(ctx,cx,cy,points,outer,inner){ctx.beginPath();for(let i=0;i<points*2;i++){const a=-Math.PI/2+i*Math.PI/points,r=i%2?inner:outer,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath()}', `t+=dt;ctx.save();ctx.translate(W/2,H/2);ctx.rotate(t*.3);ctx.translate(-W/2,-H/2);starPath(ctx,W/2,H/2,9,Math.min(W,H)*.32,Math.min(W,H)*.14);ctx.fillStyle='#f59e0b';ctx.shadowColor='#f59e0b';ctx.shadowBlur=24;ctx.fill();ctx.restore()`),
      },
      {
        key: 'draw-additive-glow', label: 'Additive glow', level: 'Intermediate', kind: 'Effect', mode: '2d',
        concepts: ['compositing', 'radial gradient', 'light accumulation'],
        summary: 'Layer colored radial gradients with additive blending to simulate luminous particles.',
        explanation: ['`lighter` adds color channels, so overlapping lights become brighter instead of covering one another.', 'A radial gradient supplies a bright core and transparent falloff without a blur filter.'],
        code: `ctx.save()
ctx.globalCompositeOperation = 'lighter'
const glow = ctx.createRadialGradient(x, y, 0, x, y, radius)
glow.addColorStop(0, 'rgba(80,220,255,0.9)')
glow.addColorStop(1, 'rgba(80,120,255,0)')
ctx.fillStyle = glow
ctx.fillRect(x-radius, y-radius, radius*2, radius*2)
ctx.restore()`,
        walkthrough: [
          note('1–2', 'Isolate a blend mode', 'Saving context state prevents additive blending from accidentally affecting later UI or background drawing.'),
          note('3–5', 'Describe light falloff', 'The radial gradient moves from an opaque bright core to fully transparent at `radius`.'),
          note('6–7', 'Paint only the affected bounds', 'A small rectangle is sufficient because every pixel outside the radial gradient would be transparent.'),
          note('8', 'Restore normal painting', 'The saved source-over blend mode and other context settings return immediately.'),
        ],
        previewCode: canvasPreview('let t=0;const colors=[[56,189,248],[244,114,182],[74,222,128]]', `t+=dt;ctx.save();ctx.globalCompositeOperation='lighter';colors.forEach((c,i)=>{const a=t*(.6+i*.17)+i*2,x=W/2+Math.cos(a)*W*.22,y=H/2+Math.sin(a*1.3)*H*.22,r=75,g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,\`rgba(\${c.join(',')},.9)\`);g.addColorStop(1,\`rgba(\${c.join(',')},0)\`);ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)});ctx.restore()`),
      },
      {
        key: 'draw-coordinate-transform', label: 'Math coordinates', level: 'Beginner', kind: 'Drawing', mode: '2d',
        concepts: ['coordinate system', 'transform stack', 'y-axis flip'],
        summary: 'Move the canvas origin to the center and make positive y point upward like a math graph.',
        explanation: ['Canvas normally starts at the top-left with y increasing downward.', 'Translate then scale the context so equations can be drawn in familiar Cartesian coordinates.'],
        code: `ctx.save()
ctx.translate(W / 2, H / 2)
ctx.scale(1, -1)
// Draw mathematical coordinates here.
ctx.moveTo(-100, 0)
ctx.lineTo(100, 0)
ctx.restore()`,
        walkthrough: [
          note('1', 'Protect the outer coordinate system', '`save` records the current transform so UI drawing can return to ordinary canvas coordinates later.'),
          note('2', 'Center the origin', 'All following positions are measured from the middle of the viewport.'),
          note('3', 'Flip only the vertical basis', 'Scaling y by −1 mirrors the axis, making positive values travel upward.'),
          note('5–7', 'Draw and restore', 'The example line spans negative to positive x, then restoration removes both transforms.'),
        ],
        previewCode: canvasPreview('', `ctx.save();ctx.translate(W/2,H/2);ctx.scale(1,-1);ctx.strokeStyle='#475569';ctx.beginPath();ctx.moveTo(-W/2,0);ctx.lineTo(W/2,0);ctx.moveTo(0,-H/2);ctx.lineTo(0,H/2);ctx.stroke();ctx.strokeStyle='#38bdf8';ctx.lineWidth=3;ctx.beginPath();for(let x=-W/2;x<W/2;x+=2){const y=Math.sin(x*.03)*70;x===-W/2?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.stroke();ctx.restore()`),
      },
      {
        key: 'effect-instanced-field', label: 'Instanced field', level: 'Advanced', kind: 'Effect', mode: '3d',
        concepts: ['instancing', 'matrices', 'GPU batching'],
        summary: 'Animate hundreds of repeated meshes with one draw call by updating instance matrices.',
        explanation: ['Instancing shares geometry and material while supplying one transform per copy.', 'A temporary Object3D is a convenient matrix composer; `needsUpdate` uploads changed matrices to the GPU.'],
        code: `const count = 400
const field = new THREE.InstancedMesh(geometry, material, count)
const dummy = new THREE.Object3D()
for (let i = 0; i < count; i++) {
  dummy.position.set((i%20)-10, height[i], Math.floor(i/20)-10)
  dummy.scale.setScalar(0.3 + height[i] * 0.1)
  dummy.updateMatrix()
  field.setMatrixAt(i, dummy.matrix)
}
field.instanceMatrix.needsUpdate = true`,
        walkthrough: [
          note('1–3', 'Allocate shared rendering data', 'All 400 copies reuse one geometry and material. The dummy never renders; it only builds transforms.'),
          note('4–8', 'Write one transform per instance', 'Index arithmetic forms a grid, height affects placement and scale, and `updateMatrix` composes the dummy’s transform.'),
          note('9', 'Signal a GPU upload', 'Changing CPU-side matrices is not visible until the attribute is marked dirty.'),
        ],
        previewCode: threePreview('let field,dummy=new THREE.Object3D(),t=0;const size=20,count=size*size', `field=new THREE.InstancedMesh(new THREE.BoxGeometry(.65,.65,.65),new THREE.MeshStandardMaterial({color:0x38bdf8}),count);scene.add(field);camera.position.set(12,12,16);camera.lookAt(0,0,0)`, `t+=dt;for(let i=0;i<count;i++){const x=i%size-size/2,z=Math.floor(i/size)-size/2,h=Math.sin(x*.55+t*2)*Math.cos(z*.55+t)*1.5;dummy.position.set(x*.65,h,z*.65);dummy.scale.set(1,1+Math.abs(h),1);dummy.updateMatrix();field.setMatrixAt(i,dummy.matrix)}field.instanceMatrix.needsUpdate=true;renderer.render(scene,camera)`),
      },
    ],
  },
  {
    category: 'Controls & Interaction',
    color: 'text-blue-400',
    items: [
      {
        key: 'control-pointer-normalize', label: 'Pointer to NDC', level: 'Beginner', kind: 'Input', mode: '3d',
        concepts: ['coordinates', 'normalization', 'raycasting'],
        summary: 'Convert pointer pixels into the −1…1 normalized device coordinates used by Three.js raycasting.',
        explanation: ['Use the canvas rectangle rather than the whole window because the preview may be embedded or resized.', 'The y formula flips browser-down coordinates into clip-space-up coordinates.'],
        code: `const pointer = new THREE.Vector2()
renderer.domElement.addEventListener('pointermove', event => {
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
})`,
        walkthrough: [
          note('1–2', 'Keep reusable pointer state', 'The Vector2 is updated in place on input rather than allocated every animation frame.'),
          note('3', 'Measure the real canvas bounds', 'Client coordinates are page-relative; subtracting the canvas corner makes them element-relative.'),
          note('4', 'Normalize horizontal position', 'Divide by width for 0…1, double for 0…2, then subtract one for −1…1.'),
          note('5', 'Normalize and flip vertical position', 'The leading minus converts the browser’s downward y direction to WebGL’s upward convention.'),
        ],
        previewCode: threePreview('let pointer=new THREE.Vector2(),marker', `marker=new THREE.Mesh(new THREE.SphereGeometry(.3,20,20),new THREE.MeshBasicMaterial({color:0x38bdf8}));scene.add(marker);camera.position.set(0,0,8);renderer.domElement.addEventListener('pointermove',e=>{const r=renderer.domElement.getBoundingClientRect();pointer.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1)})`, `marker.position.set(pointer.x*4,pointer.y*3,0);renderer.render(scene,camera)`),
      },
      {
        key: 'control-keyboard-state', label: 'Keyboard state', level: 'Beginner', kind: 'Input', mode: '2d',
        concepts: ['events', 'state', 'diagonal normalization'],
        summary: 'Track held keys as state and turn them into consistent movement inside the animation loop.',
        explanation: ['Events update intent; the animation loop consumes it using `dt`.', 'Normalizing the input vector prevents diagonal movement from being √2 times faster.'],
        code: `const keys = new Set()
addEventListener('keydown', e => keys.add(e.code))
addEventListener('keyup', e => keys.delete(e.code))
let dx = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'))
let dy = Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp'))
const length = Math.hypot(dx, dy) || 1
dx /= length; dy /= length
x += dx * speed * dt
y += dy * speed * dt`,
        walkthrough: [
          note('1–3', 'Store held-key state', 'A Set naturally prevents duplicate keydown events and removes a key on release.'),
          note('4–5', 'Convert booleans into an axis', '`Number(true)` is 1 and `Number(false)` is 0, so opposing keys cancel.'),
          note('6–7', 'Normalize the intent vector', 'A diagonal (1,1) has length √2. Dividing restores unit length.'),
          note('8–9', 'Apply speed over elapsed time', 'Movement becomes units per second rather than units per frame.'),
        ],
        previewCode: canvasPreview(`const keys=new Set();addEventListener('keydown',e=>keys.add(e.code));addEventListener('keyup',e=>keys.delete(e.code));let x=200,y=150;const speed=180`, `let dx=Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')),dy=Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp')),length=Math.hypot(dx,dy)||1;dx/=length;dy/=length;x=Math.max(15,Math.min(W-15,x+dx*speed*dt));y=Math.max(15,Math.min(H-15,y+dy*speed*dt));ctx.beginPath();ctx.arc(x,y,15,0,Math.PI*2);ctx.fillStyle='#38bdf8';ctx.fill();ctx.fillStyle='#94a3b8';ctx.font='14px system-ui';ctx.fillText('Use arrow keys',16,26)`),
      },
      {
        key: 'control-raycast-pick', label: 'Raycast picking', level: 'Intermediate', kind: 'Input', mode: '3d',
        concepts: ['raycaster', 'intersection', 'selection'],
        summary: 'Turn the normalized pointer into a world-space ray and select the nearest mesh it crosses.',
        explanation: ['The camera maps a clip-space pointer to a ray origin and direction.', 'Intersections are distance-sorted, so index zero is the closest visible candidate.'],
        code: `const raycaster = new THREE.Raycaster()
raycaster.setFromCamera(pointer, camera)
const hits = raycaster.intersectObjects(selectable, false)
for (const mesh of selectable) mesh.material.emissive.setHex(0x000000)
if (hits.length) {
  hits[0].object.material.emissive.setHex(0x2255aa)
}`,
        walkthrough: [
          note('1–2', 'Create the world-space ray', '`setFromCamera` unprojects the normalized pointer through the active camera.'),
          note('3', 'Test only selectable objects', 'A dedicated array avoids wasting intersection work on lights, grids, helpers, and scenery.'),
          note('4', 'Clear previous selection', 'Resetting visual state makes selection exclusive and avoids stale highlights.'),
          note('5–7', 'Use the nearest hit', 'The first intersection owns the smallest positive distance along the ray.'),
        ],
        previewCode: threePreview('let pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster(),selectable=[]', `for(let i=0;i<7;i++){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(.7,1),new THREE.MeshStandardMaterial({color:0x64748b,emissive:0x000000}));m.position.set((i-3)*1.4,Math.sin(i)*1.1,0);scene.add(m);selectable.push(m)}camera.position.set(0,0,10);renderer.domElement.addEventListener('pointermove',e=>{const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1)})`, `raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(selectable,false);for(const m of selectable)m.material.emissive.setHex(0);if(hits.length)hits[0].object.material.emissive.setHex(0x2255aa);renderer.render(scene,camera)`),
      },
      {
        key: 'control-drag-plane', label: 'Drag on a plane', level: 'Advanced', kind: 'Input', mode: '3d',
        concepts: ['ray-plane intersection', 'dragging', 'world space'],
        summary: 'Drag a 3D object across a mathematical plane instead of guessing depth from pointer pixels.',
        explanation: ['A screen pointer describes a ray, not one 3D point.', 'Intersecting that ray with a chosen plane supplies a stable world position for dragging.'],
        code: `const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const hitPoint = new THREE.Vector3()
function updateDrag(pointer) {
  raycaster.setFromCamera(pointer, camera)
  if (raycaster.ray.intersectPlane(plane, hitPoint)) {
    object.position.copy(hitPoint)
  }
}`,
        walkthrough: [
          note('1', 'Define permitted motion', 'Normal (0,1,0) with constant 0 describes the horizontal plane y=0.'),
          note('2', 'Reuse result storage', 'The intersection method writes into this Vector3, avoiding a new allocation on every pointer move.'),
          note('3–4', 'Build a ray from input', 'The pointer and camera together define every world point beneath that screen pixel.'),
          note('5–7', 'Move only on a valid intersection', 'Parallel rays return no point; otherwise copying the hit guarantees y remains on the plane.'),
        ],
        previewCode: threePreview('let pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3(),object', `object=new THREE.Mesh(new THREE.SphereGeometry(.7,24,24),new THREE.MeshStandardMaterial({color:0x38bdf8}));object.position.y=.7;scene.add(object);scene.add(new THREE.GridHelper(20,20,0x334155,0x172033));camera.position.set(6,7,9);camera.lookAt(0,0,0);renderer.domElement.addEventListener('pointermove',e=>{const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);if(raycaster.ray.intersectPlane(plane,hit))object.position.set(hit.x,.7,hit.z)})`, `renderer.render(scene,camera)`),
      },
    ],
  },
  {
    category: 'SVG',
    color: 'text-orange-400',
    items: [
      {
        key: 'svg-viewbox', label: 'Responsive viewBox', level: 'Beginner', kind: 'SVG', mode: 'html',
        concepts: ['viewBox', 'scaling', 'vector coordinates'],
        summary: 'Build an SVG whose internal coordinate system scales cleanly to any preview size.',
        explanation: ['The viewBox defines logical coordinates independently of rendered CSS pixels.', '`preserveAspectRatio` keeps geometry undistorted while fitting it inside the available space.'],
        code: `app.innerHTML = \`
  <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid meet"
       style="width:100%;height:100%;background:#02060f">
    <circle cx="200" cy="120" r="70" fill="#38bdf8" />
    <path d="M80 190 L200 40 L320 190 Z"
          fill="none" stroke="#f59e0b" stroke-width="6" />
  </svg>\``,
        walkthrough: [
          note('1–3', 'Separate logical size from CSS size', 'Every shape uses a stable 400×240 coordinate system while CSS stretches the SVG element to its container.'),
          note('4', 'Place geometry with SVG attributes', 'Circle center and radius stay readable and scale automatically with the viewBox.'),
          note('5–6', 'Describe a path with commands', 'M moves to the first point, each L adds a line, and Z closes the triangle.'),
        ],
        previewCode: `app.style.height='100vh';app.innerHTML='<svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;background:#02060f"><circle cx="200" cy="120" r="70" fill="#38bdf8"/><path d="M80 190 L200 40 L320 190 Z" fill="none" stroke="#f59e0b" stroke-width="6"/></svg>'`,
      },
      {
        key: 'svg-path-curve', label: 'SVG curve path', level: 'Intermediate', kind: 'SVG', mode: 'html',
        concepts: ['path data', 'cubic curve', 'stroke'],
        summary: 'Construct a smooth vector curve with cubic path commands and visible control handles.',
        explanation: ['The C command takes two control points and one endpoint.', 'Because SVG remains vector data, the curve stays sharp under zoom and can be styled or animated with CSS.'],
        code: `const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
path.setAttribute('d', 'M 40 180 C 110 20, 290 20, 360 180')
path.setAttribute('fill', 'none')
path.setAttribute('stroke', '#38bdf8')
path.setAttribute('stroke-width', '8')
path.setAttribute('stroke-linecap', 'round')
svg.appendChild(path)`,
        walkthrough: [
          note('1', 'Create in the SVG namespace', 'SVG elements need `createElementNS`; ordinary `createElement` does not reliably create vector geometry.'),
          note('2', 'Encode the geometry', 'M starts at (40,180); C uses (110,20) and (290,20) as handles before ending at (360,180).'),
          note('3–6', 'Separate shape from appearance', 'The path data remains untouched while attributes control fill, color, thickness, and cap style.'),
          note('7', 'Attach to an SVG root', 'Vector elements render only after entering the SVG document tree.'),
        ],
        previewCode: `app.style.height='100vh';app.innerHTML='<svg id="s" viewBox="0 0 400 240" style="width:100%;height:100%;background:#02060f"></svg>';const svg=app.querySelector('#s'),path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M 40 180 C 110 20, 290 20, 360 180');path.setAttribute('fill','none');path.setAttribute('stroke','#38bdf8');path.setAttribute('stroke-width','8');path.setAttribute('stroke-linecap','round');svg.appendChild(path);svg.insertAdjacentHTML('beforeend','<path d="M40 180 L110 20 M290 20 L360 180" stroke="#475569" stroke-dasharray="6 6"/><circle cx="110" cy="20" r="6" fill="#f59e0b"/><circle cx="290" cy="20" r="6" fill="#f59e0b"/>')`,
      },
      {
        key: 'svg-transform-group', label: 'Transform group', level: 'Beginner', kind: 'SVG', mode: 'html',
        concepts: ['grouping', 'transform', 'local coordinates'],
        summary: 'Move and rotate several SVG shapes as one object while keeping their local coordinates simple.',
        explanation: ['A `<g>` element creates a shared transform and style context.', 'Transform order matters because each operation changes the coordinate system used by the next.'],
        code: `const group = document.createElementNS(svg.namespaceURI, 'g')
group.setAttribute('transform', 'translate(200 120) rotate(35)')
group.innerHTML = \`
  <rect x="-70" y="-25" width="140" height="50" rx="12" fill="#8b5cf6" />
  <circle cx="-45" cy="0" r="10" fill="white" />
  <circle cx="45" cy="0" r="10" fill="white" />\`
svg.appendChild(group)`,
        walkthrough: [
          note('1', 'Create a scene-graph node', 'The group has no pixels of its own; it organizes children under one coordinate frame.'),
          note('2', 'Place then rotate the local frame', 'Translation moves the group origin to center; rotation turns every child around that new origin.'),
          note('3–6', 'Author around local zero', 'The rectangle and circles use small symmetric coordinates because placement belongs to the parent group.'),
          note('7', 'Attach one composite object', 'Future transforms or event handlers can target the whole group.'),
        ],
        previewCode: `app.style.height='100vh';app.innerHTML='<svg id="s" viewBox="0 0 400 240" style="width:100%;height:100%;background:#02060f"></svg>';const svg=app.querySelector('#s'),group=document.createElementNS(svg.namespaceURI,'g');group.setAttribute('transform','translate(200 120) rotate(35)');group.innerHTML='<rect x="-70" y="-25" width="140" height="50" rx="12" fill="#8b5cf6"/><circle cx="-45" cy="0" r="10" fill="white"/><circle cx="45" cy="0" r="10" fill="white"/>';svg.appendChild(group)`,
      },
      {
        key: 'svg-data-plot', label: 'SVG data plot', level: 'Intermediate', kind: 'Mini project', mode: 'html',
        concepts: ['data mapping', 'polyline', 'labels'],
        summary: 'Map numeric samples into SVG coordinates and render a scalable line chart.',
        explanation: ['Data coordinates need an explicit scale and a y-axis inversion.', 'Joining mapped points creates a polyline while preserving the original data array for labels or interaction.'],
        code: `const data = [12, 18, 14, 27, 23, 34, 31]
const width = 360, height = 180, max = Math.max(...data)
const points = data.map((value, index) => {
  const x = index / (data.length - 1) * width
  const y = height - value / max * height
  return \`${'${x}'},${'${y}'}\`
}).join(' ')
polyline.setAttribute('points', points)`,
        walkthrough: [
          note('1–2', 'Define data and drawing domain', 'The largest value becomes the top of the plot and the width spans all sample indices.'),
          note('3–6', 'Map each sample', 'Index becomes evenly spaced x. Value becomes a fraction of maximum, then subtraction flips it for SVG’s downward y-axis.'),
          note('7', 'Serialize vector points', 'A polyline expects space-separated x,y pairs rather than an array of objects.'),
          note('8', 'Update geometry independently', 'Changing only the points attribute lets CSS continue owning color, width, and other presentation.'),
        ],
        previewCode: `app.style.height='100vh';const data=[12,18,14,27,23,34,31],width=360,height=180,max=Math.max(...data),points=data.map((v,i)=>\`${'${20+i/(data.length-1)*width}'},${'${210-v/max*height}'}\`).join(' ');app.innerHTML=\`<svg viewBox="0 0 400 240" style="width:100%;height:100%;background:#02060f"><path d="M20 210H380 M20 30V210" stroke="#475569"/><polyline points="${'${points}'}" fill="none" stroke="#4ade80" stroke-width="5" stroke-linejoin="round"/>${'${data.map((v,i)=>`<circle cx="${20+i/(data.length-1)*width}" cy="${210-v/max*height}" r="6" fill="#38bdf8"/>`).join(\'\')}'}</svg>\`` ,
      },
      {
        key: 'svg-dash-animation', label: 'Draw-on animation', level: 'Intermediate', kind: 'SVG effect', mode: 'html',
        concepts: ['path length', 'dash offset', 'CSS animation'],
        summary: 'Animate a vector path as though it is being drawn by moving one full-length dash.',
        explanation: ['A dash equal to total path length can cover the entire stroke.', 'Starting the offset at that same length hides it; animating to zero reveals the stroke from start to finish.'],
        code: `const length = path.getTotalLength()
path.style.strokeDasharray = String(length)
path.style.strokeDashoffset = String(length)
path.animate(
  [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
  { duration: 1800, easing: 'ease-in-out', fill: 'forwards' }
)`,
        walkthrough: [
          note('1', 'Measure actual geometry', 'The browser calculates length for lines, curves, and compound path commands in the current user coordinate system.'),
          note('2–3', 'Turn the stroke into one dash', 'Dash length covers the whole path; offsetting it by one length moves that dash just beyond the visible start.'),
          note('4–7', 'Animate the offset', 'The Web Animations API interpolates from hidden to aligned while `fill: forwards` preserves the final state.'),
        ],
        previewCode: `app.style.height='100vh';app.innerHTML='<svg viewBox="0 0 400 240" style="width:100%;height:100%;background:#02060f"><path id="p" d="M30 180 C80 20 140 220 200 90 S320 20 370 170" fill="none" stroke="#f59e0b" stroke-width="8" stroke-linecap="round"/></svg>';const path=app.querySelector('#p'),length=path.getTotalLength();path.style.strokeDasharray=String(length);path.style.strokeDashoffset=String(length);path.animate([{strokeDashoffset:length},{strokeDashoffset:0}],{duration:2200,easing:'ease-in-out',fill:'forwards',iterations:Infinity,direction:'alternate'})`,
      },
      {
        key: 'svg-interactive-nodes', label: 'Interactive nodes', level: 'Advanced', kind: 'Mini project', mode: 'html',
        concepts: ['SVG DOM', 'pointer events', 'coordinate conversion'],
        summary: 'Drag vector nodes in SVG coordinates and update connected geometry live.',
        explanation: ['Pointer coordinates arrive in screen pixels, so the inverse screen transform converts them into SVG user coordinates.', 'Updating attributes keeps the data visual, handles, and connecting line synchronized.'],
        code: `function svgPoint(event) {
  const point = svg.createSVGPoint()
  point.x = event.clientX; point.y = event.clientY
  return point.matrixTransform(svg.getScreenCTM().inverse())
}
node.addEventListener('pointermove', event => {
  if (!node.hasPointerCapture(event.pointerId)) return
  const p = svgPoint(event)
  node.setAttribute('cx', p.x)
  node.setAttribute('cy', p.y)
  edge.setAttribute('x2', p.x)
  edge.setAttribute('y2', p.y)
})`,
        walkthrough: [
          note('1–4', 'Convert coordinate spaces', 'The screen CTM maps SVG coordinates to the browser. Inverting it maps pointer pixels back into the viewBox.'),
          note('6–7', 'Move only during an owned drag', 'Pointer capture keeps events arriving even if the cursor leaves the node; this guard ignores ordinary hover motion.'),
          note('8–10', 'Move the node', 'The converted point directly supplies SVG circle center attributes.'),
          note('11–12', 'Keep dependent geometry synchronized', 'The edge endpoint follows the same data so the diagram stays connected.'),
        ],
        previewCode: `app.style.height='100vh';app.innerHTML='<svg id="s" viewBox="0 0 400 240" style="width:100%;height:100%;background:#02060f;touch-action:none"><line id="e" x1="70" y1="120" x2="300" y2="120" stroke="#64748b" stroke-width="5"/><circle cx="70" cy="120" r="18" fill="#8b5cf6"/><circle id="n" cx="300" cy="120" r="22" fill="#38bdf8" style="cursor:grab"/></svg>';const svg=app.querySelector('#s'),node=app.querySelector('#n'),edge=app.querySelector('#e');function svgPoint(event){const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;return p.matrixTransform(svg.getScreenCTM().inverse())}node.addEventListener('pointerdown',e=>node.setPointerCapture(e.pointerId));node.addEventListener('pointermove',e=>{if(!node.hasPointerCapture(e.pointerId))return;const p=svgPoint(e);node.setAttribute('cx',p.x);node.setAttribute('cy',p.y);edge.setAttribute('x2',p.x);edge.setAttribute('y2',p.y)})`,
      },
    ],
  },
  {
    category: 'Simulation Projects',
    color: 'text-lime-400',
    items: [
      {
        key: 'project-boids', label: 'Boid flock', level: 'Advanced', kind: 'Mini project', mode: '2d',
        concepts: ['emergence', 'steering', 'neighborhood'],
        summary: 'Combine separation, alignment, and cohesion to produce emergent flocking behavior.',
        explanation: ['No boid knows the flock shape; each one reacts only to nearby neighbors.', 'Weighted local rules create coordinated global motion without a leader.'],
        code: `for (const boid of boids) {
  const nearby = boids.filter(other =>
    other !== boid && distance(boid, other) < perception)
  const separation = steerAway(boid, nearby)
  const alignment = matchVelocity(boid, nearby)
  const cohesion = seekCenter(boid, nearby)
  boid.acceleration
    .addScaledVector(separation, 1.5)
    .addScaledVector(alignment, 1.0)
    .addScaledVector(cohesion, 0.8)
}`,
        walkthrough: [
          note('1–3', 'Build a local neighborhood', 'Perception radius limits both the model and the cost; a spatial grid can later replace the all-pairs filter.'),
          note('4–6', 'Calculate independent steering goals', 'Separation prevents crowding, alignment matches heading, and cohesion pulls toward the neighborhood center.'),
          note('7–10', 'Blend behaviors by priority', 'Weights make collision avoidance strongest while allowing alignment and group attraction to shape the flock.'),
        ],
        previewCode: canvasPreview(`const boids=Array.from({length:55},()=>({x:Math.random()*600,y:Math.random()*400,vx:Math.random()*80-40,vy:Math.random()*80-40}));const perception=65`, `for(const b of boids){let cx=0,cy=0,avx=0,avy=0,sx=0,sy=0,n=0;for(const o of boids){if(o===b)continue;const dx=o.x-b.x,dy=o.y-b.y,d=Math.hypot(dx,dy);if(d<perception){cx+=o.x;cy+=o.y;avx+=o.vx;avy+=o.vy;if(d<24){sx-=dx/(d||1);sy-=dy/(d||1)}n++}}if(n){b.vx+=(sx*.9+(avx/n-b.vx)*.08+(cx/n-b.x)*.012)*dt*10;b.vy+=(sy*.9+(avy/n-b.vy)*.08+(cy/n-b.y)*.012)*dt*10}const s=Math.hypot(b.vx,b.vy)||1;if(s>90){b.vx=b.vx/s*90;b.vy=b.vy/s*90}b.x=(b.x+b.vx*dt+W)%W;b.y=(b.y+b.vy*dt+H)%H;ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx));ctx.fillStyle='#4ade80';ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-7,5);ctx.lineTo(-7,-5);ctx.closePath();ctx.fill();ctx.restore()}`),
      },
      {
        key: 'project-nbody', label: 'N-body gravity', level: 'Advanced', kind: 'Mini project', mode: '2d',
        concepts: ['pairwise force', 'softening', 'conservation'],
        summary: 'Simulate several mutually attracting bodies while applying each pair force only once.',
        explanation: ['Pairwise iteration updates both bodies with equal and opposite acceleration.', 'Softening avoids singular acceleration when bodies pass extremely close.'],
        code: `for (let i = 0; i < bodies.length; i++) {
  for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j]
    const dx = b.x-a.x, dy = b.y-a.y
    const r2 = dx*dx + dy*dy + softening*softening
    const invR3 = 1 / Math.pow(r2, 1.5)
    const fx = G * dx * invR3, fy = G * dy * invR3
    a.ax += fx*b.mass; a.ay += fy*b.mass
    b.ax -= fx*a.mass; b.ay -= fy*a.mass
  }
}`,
        walkthrough: [
          note('1–2', 'Visit every unordered pair once', 'Starting j at i+1 avoids self-force and duplicate A–B/B–A calculations.'),
          note('3–6', 'Compute softened inverse-cube scale', 'Direction contributes one power of distance, so multiplying displacement by 1/r³ produces inverse-square acceleration.'),
          note('7', 'Build directional gravity', 'The displacement components turn scalar strength into x and y acceleration factors.'),
          note('8–9', 'Apply Newton’s third law', 'Both bodies receive opposite effects, scaled by the other body’s mass.'),
        ],
        previewCode: canvasPreview(`const G=9000,softening=18,bodies=[{x:300,y:200,vx:0,vy:0,mass:80,color:'#f59e0b'},{x:430,y:200,vx:0,vy:70,mass:3,color:'#38bdf8'},{x:210,y:200,vx:0,vy:-85,mass:2,color:'#fb7185'},{x:300,y:95,vx:75,vy:0,mass:1,color:'#4ade80'}]`, `for(const b of bodies){b.ax=0;b.ay=0}for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){const a=bodies[i],b=bodies[j],dx=b.x-a.x,dy=b.y-a.y,r2=dx*dx+dy*dy+softening*softening,inv=1/Math.pow(r2,1.5),fx=G*dx*inv,fy=G*dy*inv;a.ax+=fx*b.mass;a.ay+=fy*b.mass;b.ax-=fx*a.mass;b.ay-=fy*a.mass}for(const b of bodies){b.vx+=b.ax*dt;b.vy+=b.ay*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;ctx.beginPath();ctx.arc(b.x,b.y,4+Math.sqrt(b.mass),0,Math.PI*2);ctx.fillStyle=b.color;ctx.fill()}`),
      },
      {
        key: 'project-wave-field', label: 'Wave interference', level: 'Intermediate', kind: 'Math project', mode: '2d',
        concepts: ['superposition', 'phase', 'sampling'],
        summary: 'Visualize interference by summing the phase contribution from multiple wave sources.',
        explanation: ['Each source contributes a sine wave based on distance and time.', 'Superposition is simple addition; constructive and destructive interference emerge from phase alignment.'],
        code: `for (let y = 0; y < H; y += cell) {
  for (let x = 0; x < W; x += cell) {
    let amplitude = 0
    for (const source of sources) {
      const distance = Math.hypot(x-source.x, y-source.y)
      amplitude += Math.sin(distance * frequency - time * speed)
    }
    const value = 128 + amplitude / sources.length * 127
    ctx.fillStyle = \`rgb(0, ${'${value}'}, ${'${255-value/2}'})\`
    ctx.fillRect(x, y, cell, cell)
  }
}`,
        walkthrough: [
          note('1–2', 'Sample a regular spatial grid', 'Larger cells improve performance; smaller cells produce a smoother field.'),
          note('3–7', 'Sum source phases', 'Distance sets spatial phase, time advances every wave, and addition implements linear superposition.'),
          note('8–10', 'Map signed amplitude into color', 'A normalized −1…1 signal becomes a visible color range and fills one sample cell.'),
        ],
        previewCode: `let time=0;const cell=7,sources=[{x:180,y:200},{x:420,y:200}],frequency=.075,speed=5
function init(){}
function update(dt){time+=dt;for(let y=0;y<H;y+=cell)for(let x=0;x<W;x+=cell){let a=0;for(const s of sources){const d=Math.hypot(x-s.x,y-s.y);a+=Math.sin(d*frequency-time*speed)}const v=Math.max(0,Math.min(255,128+a/sources.length*127));ctx.fillStyle=\`rgb(0,${'${v}'},${'${255-v/2}'})\`;ctx.fillRect(x,y,cell,cell)}}`,
      },
      {
        key: 'project-solar-system', label: 'Hierarchical orbit', level: 'Intermediate', kind: 'Mini project', mode: '3d',
        concepts: ['scene graph', 'parent transform', 'local orbit'],
        summary: 'Use nested Object3D pivots so a moon follows its planet while both orbit a star.',
        explanation: ['Scene-graph parenting composes transforms automatically.', 'Rotating an empty pivot creates an orbit without recalculating sine and cosine positions by hand.'],
        code: `const planetOrbit = new THREE.Object3D()
const moonOrbit = new THREE.Object3D()
scene.add(planetOrbit)
planetOrbit.add(planet)
planet.position.x = 5
planet.add(moonOrbit)
moonOrbit.add(moon)
moon.position.x = 1.4
function update(dt) {
  planetOrbit.rotation.y += dt * 0.35
  moonOrbit.rotation.y += dt * 1.8
}`,
        walkthrough: [
          note('1–3', 'Create transform-only parents', 'Object3D pivots do not render; they provide coordinate frames whose origins become orbit centers.'),
          note('4–5', 'Offset the planet inside its orbit frame', 'Rotating the parent now sweeps that five-unit offset around the star.'),
          note('6–8', 'Nest the moon system', 'Because the moon pivot belongs to the planet, it inherits the planet’s orbital motion before adding its own.'),
          note('9–12', 'Animate independent angular speeds', 'Each hierarchy level rotates locally, producing combined motion through matrix composition.'),
        ],
        previewCode: threePreview('let planetOrbit,moonOrbit', `const star=new THREE.Mesh(new THREE.SphereGeometry(1.3,28,28),new THREE.MeshBasicMaterial({color:0xf59e0b}));scene.add(star);planetOrbit=new THREE.Object3D();moonOrbit=new THREE.Object3D();scene.add(planetOrbit);const planet=new THREE.Mesh(new THREE.SphereGeometry(.7,24,24),new THREE.MeshStandardMaterial({color:0x38bdf8}));planetOrbit.add(planet);planet.position.x=5;planet.add(moonOrbit);const moon=new THREE.Mesh(new THREE.SphereGeometry(.25,16,16),new THREE.MeshStandardMaterial({color:0xcbd5e1}));moonOrbit.add(moon);moon.position.x=1.4;camera.position.set(0,8,12);camera.lookAt(0,0,0)`, `planetOrbit.rotation.y+=dt*.35;moonOrbit.rotation.y+=dt*1.8;renderer.render(scene,camera)`),
      },
    ],
  },
]
