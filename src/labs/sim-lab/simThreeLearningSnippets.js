const threePreview = (setup, init, update = 'renderer.render(scene, camera)') => `${setup}

function init() {
  ${init}
}

function update(dt) {
  ${update}
}`

const note = (lines, title, detail) => ({ lines, title, detail })

export const THREE_LEARNING_SNIPPETS = [
  {
    category: '3D Movement & Controllers',
    color: 'text-cyan-400',
    items: [
      {
        key: 'controller-drive-car', label: 'Drive a car with WASD', level: 'Intermediate', kind: 'Mini project', mode: '3d',
        concepts: ['local coordinates', 'acceleration', 'steering', 'friction'],
        summary: 'Build an arcade vehicle whose steering depends on forward speed and whose velocity decays through friction.',
        explanation: ['The car stores scalar forward speed while its quaternion stores heading.', 'Movement uses the car’s local forward axis transformed into world space, so forward follows the vehicle rather than the camera.'],
        code: `const keys = new Set()
addEventListener('keydown', event => keys.add(event.code))
addEventListener('keyup', event => keys.delete(event.code))
let speed = 0

function updateCar(dt) {
  const throttle = Number(keys.has('KeyW')) - Number(keys.has('KeyS'))
  const steering = Number(keys.has('KeyA')) - Number(keys.has('KeyD'))
  speed += throttle * 12 * dt
  speed *= Math.exp(-2.4 * dt)
  speed = THREE.MathUtils.clamp(speed, -5, 14)
  car.rotation.y += steering * speed * 0.055 * dt
  const forward = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(car.quaternion)
  car.position.addScaledVector(forward, speed * dt)
}`,
        walkthrough: [
          note('1–3', 'Track held controls', 'A Set records key state independently from frame rate and ignores repeated keydown events.'),
          note('6–8', 'Convert keys into signed axes', 'Opposing controls subtract, producing −1, 0, or 1 for throttle and steering.'),
          note('9–11', 'Integrate and limit speed', 'Throttle accelerates, exponential friction removes speed smoothly, and clamping sets reverse and forward limits.'),
          note('12', 'Make steering depend on motion', 'Multiplying by speed means the car cannot pivot unrealistically while stopped and reverses steering behavior while backing up.'),
          note('13–15', 'Move along local forward', 'The quaternion rotates local −z into the vehicle’s current world direction before position is advanced.'),
        ],
        previewCode: threePreview(`const keys=new Set();addEventListener('keydown',e=>keys.add(e.code));addEventListener('keyup',e=>keys.delete(e.code));let car,speed=0`, `car=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(1.5,.45,3),new THREE.MeshStandardMaterial({color:0x38bdf8}));body.position.y=.5;car.add(body);for(const x of [-.65,.65])for(const z of [-1,1]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.22,16),new THREE.MeshStandardMaterial({color:0x111827}));wheel.rotation.z=Math.PI/2;wheel.position.set(x,.25,z);car.add(wheel)}scene.add(car);scene.add(new THREE.GridHelper(60,60,0x334155,0x172033));camera.position.set(8,7,12);camera.lookAt(0,0,0)`, `const throttle=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),steering=Number(keys.has('KeyA'))-Number(keys.has('KeyD'));speed+=throttle*12*dt;speed*=Math.exp(-2.4*dt);speed=THREE.MathUtils.clamp(speed,-5,14);car.rotation.y+=steering*speed*.055*dt;const forward=new THREE.Vector3(0,0,-1).applyQuaternion(car.quaternion);car.position.addScaledVector(forward,speed*dt);const desired=car.position.clone().add(new THREE.Vector3(0,5,9).applyQuaternion(car.quaternion));camera.position.lerp(desired,1-Math.exp(-4*dt));camera.lookAt(car.position);renderer.render(scene,camera)`),
      },
      {
        key: 'controller-spline-track', label: 'Car follows a track', level: 'Advanced', kind: 'Mini project', mode: '3d',
        concepts: ['spline', 'tangent', 'orientation', 'parameterization'],
        summary: 'Move a vehicle along a closed spline and orient it from the curve tangent.',
        explanation: ['A curve parameter `u` describes progress independently from the number of control points.', 'The tangent gives instantaneous travel direction; a quaternion turns the vehicle’s local forward axis toward it.'],
        code: `let progress = 0
function updateTrackCar(dt) {
  progress = (progress + dt * 0.04) % 1
  const position = track.getPointAt(progress)
  const tangent = track.getTangentAt(progress).normalize()
  car.position.copy(position)
  const forward = new THREE.Vector3(0, 0, -1)
  car.quaternion.setFromUnitVectors(forward, tangent)
}`,
        walkthrough: [
          note('1–3', 'Advance normalized progress', 'Modulo wraps the 0…1 curve parameter so a closed track loops forever.'),
          note('4–5', 'Sample position and direction', '`getPointAt` uses arc-length spacing, while the derivative-like tangent points along the road.'),
          note('6', 'Place the vehicle', 'Copying preserves the sampled Vector3 and updates only the car transform.'),
          note('7–8', 'Align local forward to the tangent', '`setFromUnitVectors` constructs the shortest quaternion rotation from −z to the travel direction.'),
        ],
        previewCode: threePreview('let track,car,progress=0', `track=new THREE.CatmullRomCurve3([new THREE.Vector3(-6,0,-2),new THREE.Vector3(-2,0,-6),new THREE.Vector3(5,0,-4),new THREE.Vector3(7,0,2),new THREE.Vector3(2,0,6),new THREE.Vector3(-6,0,4)],true,'catmullrom',.35);const road=new THREE.Mesh(new THREE.TubeGeometry(track,160,1.1,8,true),new THREE.MeshStandardMaterial({color:0x334155,roughness:.9}));road.scale.y=.08;scene.add(road);car=new THREE.Mesh(new THREE.BoxGeometry(1,.55,2),new THREE.MeshStandardMaterial({color:0xf59e0b}));scene.add(car);camera.position.set(0,11,13);camera.lookAt(0,0,0)`, `progress=(progress+dt*.045)%1;const p=track.getPointAt(progress),tangent=track.getTangentAt(progress).normalize();car.position.copy(p).add(new THREE.Vector3(0,.45,0));car.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),tangent);renderer.render(scene,camera)`),
      },
      {
        key: 'controller-click-move', label: 'Click-to-move', level: 'Intermediate', kind: 'Interaction', mode: '3d',
        concepts: ['raycasting', 'ground plane', 'steering'],
        summary: 'Convert a screen click into a world-space destination and steer a character toward it.',
        explanation: ['A pointer pixel becomes a camera ray, and the ground plane turns that ray into one unambiguous 3D point.', 'Movement stops inside a small arrival radius so the character does not oscillate around the target.'],
        code: `const raycaster = new THREE.Raycaster()
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const destination = new THREE.Vector3()

function chooseDestination(pointer) {
  raycaster.setFromCamera(pointer, camera)
  raycaster.ray.intersectPlane(ground, destination)
}

function updateAgent(dt) {
  const delta = destination.clone().sub(agent.position)
  if (delta.length() < 0.1) return
  const direction = delta.normalize()
  agent.position.addScaledVector(direction, 4 * dt)
  agent.lookAt(destination)
}`,
        walkthrough: [
          note('1–3', 'Define ray, movement surface, and persistent target', 'The plane y=0 represents walkable ground and the destination vector is reused across clicks.'),
          note('5–8', 'Project a click into the world', 'The camera ray contains every 3D point under the pointer; plane intersection selects the ground point.'),
          note('11–12', 'Measure remaining motion', 'Subtract current position from destination and stop when the gap is smaller than the arrival tolerance.'),
          note('13–15', 'Move and face the goal', 'Normalization separates direction from distance, then fixed speed and `dt` advance the agent consistently.'),
        ],
        previewCode: threePreview(`let agent,destination=new THREE.Vector3(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0)`, `agent=new THREE.Mesh(new THREE.ConeGeometry(.6,1.8,4),new THREE.MeshStandardMaterial({color:0x4ade80}));agent.rotation.x=Math.PI/2;agent.position.y=.8;scene.add(agent);scene.add(new THREE.GridHelper(24,24,0x334155,0x172033));camera.position.set(7,9,10);camera.lookAt(0,0,0);renderer.domElement.addEventListener('pointerdown',e=>{const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);raycaster.ray.intersectPlane(ground,destination)})`, `const flatTarget=destination.clone();flatTarget.y=.8;const delta=flatTarget.sub(agent.position);if(delta.length()>.12){const direction=delta.normalize();agent.position.addScaledVector(direction,4*dt);agent.lookAt(destination)}renderer.render(scene,camera)`),
      },
      {
        key: 'controller-turret-track', label: 'Turret tracks pointer', level: 'Advanced', kind: 'Interaction', mode: '3d',
        concepts: ['ray-plane target', 'look rotation', 'quaternion smoothing'],
        summary: 'Aim a turret at the pointer while restricting rotation to a horizontal yaw axis.',
        explanation: ['The pointer ray intersects a horizontal plane to create a stable target.', 'Flattening the target direction removes pitch, and quaternion slerp prevents snapping.'],
        code: `raycaster.setFromCamera(pointer, camera)
raycaster.ray.intersectPlane(aimPlane, target)
const flatTarget = target.clone()
flatTarget.y = turret.position.y
const helper = new THREE.Object3D()
helper.position.copy(turret.position)
helper.lookAt(flatTarget)
const blend = 1 - Math.exp(-10 * dt)
turret.quaternion.slerp(helper.quaternion, blend)`,
        walkthrough: [
          note('1–2', 'Turn pointer into a world target', 'The camera ray and aim plane resolve screen position into 3D coordinates.'),
          note('3–4', 'Remove unwanted pitch', 'Matching target y to turret y leaves only horizontal direction.'),
          note('5–7', 'Calculate orientation without moving the turret', 'A helper object uses `lookAt` to produce the desired quaternion at the turret origin.'),
          note('8–9', 'Smoothly rotate toward the target', 'Exponential blending is frame-rate independent and slerp follows the shortest orientation arc.'),
        ],
        previewCode: threePreview(`let turret,pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster(),aimPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),target=new THREE.Vector3(),helper=new THREE.Object3D()`, `turret=new THREE.Group();const base=new THREE.Mesh(new THREE.CylinderGeometry(1,1.2,.7,24),new THREE.MeshStandardMaterial({color:0x475569}));const barrel=new THREE.Mesh(new THREE.BoxGeometry(.35,.35,3.5),new THREE.MeshStandardMaterial({color:0xfb7185}));barrel.position.set(0,.35,-1.4);turret.add(base,barrel);scene.add(turret);scene.add(new THREE.GridHelper(24,24,0x334155,0x172033));camera.position.set(7,9,10);camera.lookAt(0,0,0);renderer.domElement.addEventListener('pointermove',e=>{const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1)})`, `raycaster.setFromCamera(pointer,camera);raycaster.ray.intersectPlane(aimPlane,target);const flat=target.clone();flat.y=turret.position.y;helper.position.copy(turret.position);helper.lookAt(flat);turret.quaternion.slerp(helper.quaternion,1-Math.exp(-10*dt));renderer.render(scene,camera)`),
      },
    ],
  },
  {
    category: 'Animation & Rigging',
    color: 'text-purple-400',
    items: [
      {
        key: 'animation-mixer-clip', label: 'AnimationMixer clip', level: 'Intermediate', kind: 'Animation', mode: '3d',
        concepts: ['AnimationMixer', 'keyframes', 'clip'],
        summary: 'Animate any Object3D with a reusable keyframe clip and advance it using elapsed time.',
        explanation: ['Tracks target named properties over time; a clip groups related tracks into one action.', 'The mixer owns playback state and must receive `dt` every frame.'],
        code: `const times = [0, 0.5, 1]
const values = [0, 1.4, 0]
const jumpTrack = new THREE.NumberKeyframeTrack(
  '.position[y]', times, values
)
const clip = new THREE.AnimationClip('jump', 1, [jumpTrack])
const mixer = new THREE.AnimationMixer(character)
const action = mixer.clipAction(clip)
action.setLoop(THREE.LoopRepeat).play()

function update(dt) {
  mixer.update(dt)
}`,
        walkthrough: [
          note('1–2', 'Define time and value samples', 'The arrays pair each timestamp with the character y-position at that moment.'),
          note('3–5', 'Bind samples to a property', 'The property path targets the y component of position and interpolates between values.'),
          note('6–8', 'Create playback state', 'The clip groups tracks, the mixer controls one root object, and the action is a playable instance of that clip.'),
          note('9', 'Choose looping behavior', 'LoopRepeat restarts the one-second jump whenever it finishes.'),
          note('11–13', 'Advance the timeline', 'Passing real elapsed time keeps animation speed independent from render frame rate.'),
        ],
        previewCode: threePreview('let character,mixer', `character=new THREE.Mesh(new THREE.BoxGeometry(1.2,2,1.2),new THREE.MeshNormalMaterial());character.position.y=1;scene.add(character);scene.add(new THREE.GridHelper(16,16,0x334155,0x172033));const track=new THREE.NumberKeyframeTrack('.position[y]',[0,.5,1],[1,3,1]);const clip=new THREE.AnimationClip('jump',1,[track]);mixer=new THREE.AnimationMixer(character);mixer.clipAction(clip).setLoop(THREE.LoopRepeat).play();camera.position.set(5,4,8);camera.lookAt(0,1,0)`, `mixer.update(dt);renderer.render(scene,camera)`),
      },
      {
        key: 'animation-crossfade', label: 'Idle-to-run crossfade', level: 'Advanced', kind: 'Animation', mode: '3d',
        concepts: ['action weights', 'crossfade', 'state transition'],
        summary: 'Blend between two animation actions without popping or restarting the target pose.',
        explanation: ['Both actions can play simultaneously while weights decide their contribution.', '`crossFadeTo` schedules complementary weight changes over a duration.'],
        code: `idleAction.play()
runAction.play()

function setMoving(isMoving) {
  const from = isMoving ? idleAction : runAction
  const to = isMoving ? runAction : idleAction
  to.reset().play()
  from.crossFadeTo(to, 0.35, true)
}`,
        walkthrough: [
          note('1–2', 'Keep both actions available', 'Playing actions registers them with the mixer; their weights determine the visible result.'),
          note('4–6', 'Choose transition direction', 'The same function handles entering and leaving movement by swapping source and destination actions.'),
          note('7', 'Restart the target cleanly', 'Reset sets its local time to zero before playback contributes weight.'),
          note('8', 'Blend instead of switch', 'Over 0.35 seconds the source fades out as the target fades in; warping aligns differing clip durations.'),
        ],
        previewCode: threePreview('let mesh,mixer,idle,run,t=0,last=false', `mesh=new THREE.Mesh(new THREE.BoxGeometry(1.5,2.5,1),new THREE.MeshNormalMaterial());scene.add(mesh);const idleClip=new THREE.AnimationClip('idle',2,[new THREE.NumberKeyframeTrack('.rotation[z]',[0,1,2],[-.06,.06,-.06])]);const runClip=new THREE.AnimationClip('run',.5,[new THREE.NumberKeyframeTrack('.rotation[z]',[0,.25,.5],[-.35,.35,-.35]),new THREE.NumberKeyframeTrack('.scale[y]',[0,.25,.5],[1,.75,1])]);mixer=new THREE.AnimationMixer(mesh);idle=mixer.clipAction(idleClip);run=mixer.clipAction(runClip);idle.play();run.play();run.weight=0;camera.position.set(0,2,8)`, `t+=dt;const moving=Math.floor(t/2)%2===1;if(moving!==last){const from=moving?idle:run,to=moving?run:idle;to.reset().play();from.crossFadeTo(to,.35,true);last=moving}mixer.update(dt);renderer.render(scene,camera)`),
      },
      {
        key: 'animation-procedural-walk', label: 'Procedural walking legs', level: 'Advanced', kind: 'Rigging', mode: '3d',
        concepts: ['phase offset', 'joint hierarchy', 'procedural animation'],
        summary: 'Animate a simple leg rig mathematically without loading an animation clip.',
        explanation: ['Parent-child joints make the foot inherit hip and knee motion.', 'A half-cycle phase offset makes the left and right legs alternate.'],
        code: `function poseLeg(hip, knee, phase, stride) {
  const swing = Math.sin(phase) * stride
  const lift = Math.max(0, Math.sin(phase))
  hip.rotation.x = swing
  knee.rotation.x = 0.25 + lift * 0.9
}

walkPhase += speed * dt
poseLeg(leftHip, leftKnee, walkPhase, 0.65)
poseLeg(rightHip, rightKnee, walkPhase + Math.PI, 0.65)`,
        walkthrough: [
          note('1–3', 'Convert phase into gait signals', 'Sine creates a smooth forward/back swing; clamping its positive half creates a one-sided lift signal.'),
          note('4–5', 'Pose two connected joints', 'Hip rotation swings the whole leg, while knee bend increases during the lifted half-cycle.'),
          note('8', 'Advance phase by speed and time', 'Faster movement advances the gait more quickly while `dt` removes frame-rate dependence.'),
          note('9–10', 'Alternate the legs', 'Adding π shifts the right leg exactly half a cycle from the left.'),
        ],
        previewCode: threePreview(`let leftHip,leftKnee,rightHip,rightKnee,phase=0;function makeLeg(x){const hip=new THREE.Group();hip.position.set(x,1.8,0);const upper=new THREE.Mesh(new THREE.BoxGeometry(.45,1.5,.45),new THREE.MeshStandardMaterial({color:0x38bdf8}));upper.position.y=-.75;hip.add(upper);const knee=new THREE.Group();knee.position.y=-1.5;hip.add(knee);const lower=new THREE.Mesh(new THREE.BoxGeometry(.38,1.4,.38),new THREE.MeshStandardMaterial({color:0x4ade80}));lower.position.y=-.7;knee.add(lower);scene.add(hip);return[hip,knee]}function pose(hip,knee,p){const lift=Math.max(0,Math.sin(p));hip.rotation.x=Math.sin(p)*.65;knee.rotation.x=.25+lift*.9}`, `const left=makeLeg(-.45),right=makeLeg(.45);leftHip=left[0];leftKnee=left[1];rightHip=right[0];rightKnee=right[1];scene.add(new THREE.GridHelper(12,12,0x334155,0x172033));camera.position.set(5,3,8);camera.lookAt(0,.5,0)`, `phase+=4*dt;pose(leftHip,leftKnee,phase);pose(rightHip,rightKnee,phase+Math.PI);renderer.render(scene,camera)`),
      },
    ],
  },
  {
    category: 'CAD & Inspection',
    color: 'text-amber-400',
    items: [
      {
        key: 'cad-exploded-view', label: 'Exploded assembly', level: 'Intermediate', kind: 'CAD pattern', mode: '3d',
        concepts: ['scene graph', 'stored transforms', 'lerp'],
        summary: 'Store original part transforms and animate an assembly between compact and exploded states.',
        explanation: ['Every part keeps immutable assembly and exploded positions in `userData`.', 'One shared progress value makes the whole assembly reversible and scrub-friendly.'],
        code: `for (const part of assembly.children) {
  part.userData.assembled = part.position.clone()
  const direction = part.position.clone().normalize()
  part.userData.exploded = part.position.clone()
    .addScaledVector(direction, 4)
}

function setExplosion(progress) {
  for (const part of assembly.children) {
    part.position.lerpVectors(
      part.userData.assembled,
      part.userData.exploded,
      progress
    )
  }
}`,
        walkthrough: [
          note('1–2', 'Preserve assembly transforms', 'Cloning avoids storing a live reference that would change as the part animates.'),
          note('3–5', 'Derive an outward destination', 'The normalized position points away from the assembly center and scales into an explosion offset.'),
          note('8–15', 'Drive every part from one parameter', '`lerpVectors` computes a stable position directly from endpoints, so scrubbing backward does not accumulate error.'),
        ],
        previewCode: threePreview('let assembly,progress=0,direction=1', `assembly=new THREE.Group();for(let i=0;i<9;i++){const part=new THREE.Mesh(new THREE.BoxGeometry(1.4,.7,1.4),new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(i/9,.75,.55)}));part.position.set((i%3-1)*1.5,(Math.floor(i/3)-1)*.8,0);part.userData.assembled=part.position.clone();part.userData.exploded=part.position.clone().add(new THREE.Vector3((i%3-1)*2,(Math.floor(i/3)-1)*1.5,(i%2?1:-1)*2));assembly.add(part)}scene.add(assembly);camera.position.set(7,5,10);camera.lookAt(0,0,0)`, `progress+=direction*dt*.35;if(progress>=1||progress<=0){progress=THREE.MathUtils.clamp(progress,0,1);direction*=-1}for(const part of assembly.children)part.position.lerpVectors(part.userData.assembled,part.userData.exploded,progress);assembly.rotation.y+=dt*.15;renderer.render(scene,camera)`),
      },
      {
        key: 'cad-section-plane', label: 'Dynamic section plane', level: 'Advanced', kind: 'CAD pattern', mode: '3d',
        concepts: ['clipping plane', 'signed distance', 'material'],
        summary: 'Cut through a model interactively with a renderer clipping plane.',
        explanation: ['A plane stores a normal and signed distance from the origin.', 'Local clipping must be enabled on the renderer and assigned to every material that should be sectioned.'],
        code: `renderer.localClippingEnabled = true
const section = new THREE.Plane(
  new THREE.Vector3(1, 0, 0), 0
)
model.traverse(child => {
  if (!child.isMesh) return
  child.material.clippingPlanes = [section]
  child.material.clipShadows = true
})

function updateSection(offset) {
  section.constant = offset
}`,
        walkthrough: [
          note('1', 'Enable material clipping globally', 'The renderer skips clipping shader work unless local clipping is explicitly enabled.'),
          note('2–4', 'Define the cutting half-space', 'Normal (1,0,0) creates a plane perpendicular to x; constant moves it along that normal.'),
          note('5–9', 'Attach the plane to every mesh material', 'Imported assemblies contain nested meshes, so traversal applies consistent section behavior throughout the model.'),
          note('11–13', 'Move the section without rebuilding materials', 'Changing the plane constant updates the uniform used by existing shaders.'),
        ],
        previewCode: threePreview('let section,t=0', `renderer.localClippingEnabled=true;section=new THREE.Plane(new THREE.Vector3(1,0,0),0);const model=new THREE.Mesh(new THREE.TorusKnotGeometry(2,.7,180,32),new THREE.MeshStandardMaterial({color:0x38bdf8,side:THREE.DoubleSide,clippingPlanes:[section]}));scene.add(model);camera.position.set(0,1,8)`, `t+=dt;section.constant=Math.sin(t)*2.4;renderer.render(scene,camera)`),
      },
      {
        key: 'cad-xray-mode', label: 'X-ray inspection', level: 'Intermediate', kind: 'CAD pattern', mode: '3d',
        concepts: ['transparency', 'depth write', 'material override'],
        summary: 'Temporarily ghost an assembly while preserving each part’s original material for restoration.',
        explanation: ['Transparent surfaces still depth-test, but disabling depth writes lets internal parts remain visible.', 'Cloning materials prevents the inspection mode from mutating shared materials elsewhere.'],
        code: `function setXRay(root, enabled) {
  root.traverse(child => {
    if (!child.isMesh) return
    if (!child.userData.originalMaterial) {
      child.userData.originalMaterial = child.material
    }
    child.material = enabled
      ? child.userData.originalMaterial.clone()
      : child.userData.originalMaterial
    child.material.transparent = enabled
    child.material.opacity = enabled ? 0.22 : 1
    child.material.depthWrite = !enabled
  })
}`,
        walkthrough: [
          note('1–5', 'Visit meshes and remember source materials', 'Imported roots contain groups and lights too. The first pass stores the exact material needed to restore normal rendering.'),
          note('6–9', 'Swap safely', 'Inspection uses a clone so opacity changes cannot leak to another mesh sharing the source material.'),
          note('10–12', 'Configure translucent depth behavior', 'Low opacity reveals internals; disabling depth writes prevents the shell from hiding later transparent fragments.'),
        ],
        previewCode: threePreview('let root,t=0,last=false;function setXRay(root,on){root.traverse(c=>{if(!c.isMesh)return;if(!c.userData.original)c.userData.original=c.material;c.material=on?c.userData.original.clone():c.userData.original;c.material.transparent=on;c.material.opacity=on?.2:1;c.material.depthWrite=!on})}', `root=new THREE.Group();const shell=new THREE.Mesh(new THREE.BoxGeometry(4,4,4),new THREE.MeshStandardMaterial({color:0x38bdf8,side:THREE.DoubleSide}));const core=new THREE.Mesh(new THREE.TorusKnotGeometry(1.2,.35,100,16),new THREE.MeshStandardMaterial({color:0xfb7185}));root.add(shell,core);scene.add(root);camera.position.set(6,5,8);camera.lookAt(0,0,0)`, `t+=dt;const on=Math.floor(t/2)%2===1;if(on!==last){setXRay(root,on);last=on}root.rotation.y+=dt*.25;renderer.render(scene,camera)`),
      },
      {
        key: 'cad-measure-points', label: 'Measure two points', level: 'Advanced', kind: 'CAD tool', mode: '3d',
        concepts: ['raycast points', 'world distance', 'dimension line'],
        summary: 'Capture two surface points, draw a dimension line, and calculate their world-space distance.',
        explanation: ['Raycast intersection points are already in world coordinates.', 'Distance and midpoint provide the numeric measurement and label placement without depending on model hierarchy.'],
        code: `const measured = []
function addMeasurement(hit) {
  measured.push(hit.point.clone())
  if (measured.length < 2) return null
  const [a, b] = measured
  const distance = a.distanceTo(b)
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([a, b]),
    new THREE.LineBasicMaterial({ color: 0xffff00 })
  )
  const midpoint = a.clone().lerp(b, 0.5)
  return { distance, line, midpoint }
}`,
        walkthrough: [
          note('1–3', 'Freeze clicked world positions', 'Cloning prevents later raycaster reuse from changing stored measurement endpoints.'),
          note('4–6', 'Wait for a complete pair', 'The first click only records A; the second unlocks distance calculation.'),
          note('7–10', 'Build dimension graphics', 'A two-point BufferGeometry renders the exact measured segment.'),
          note('12–13', 'Find label data', 'Halfway interpolation gives a stable label anchor and the returned object keeps calculation separate from presentation.'),
        ],
        previewCode: threePreview('let points=[],line,raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),model', `model=new THREE.Mesh(new THREE.TorusKnotGeometry(2,.6,160,24),new THREE.MeshStandardMaterial({color:0x64748b}));scene.add(model);camera.position.set(0,1,8);renderer.domElement.addEventListener('pointerdown',e=>{const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObject(model)[0];if(!hit)return;points.push(hit.point.clone());if(points.length>2)points.shift();if(line)scene.remove(line);if(points.length===2){line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xffff00}));scene.add(line);console.log('Distance:',points[0].distanceTo(points[1]).toFixed(3))}})`, `renderer.render(scene,camera)`),
      },
      {
        key: 'cad-selected-outline', label: 'Outline selected part', level: 'Intermediate', kind: 'CAD tool', mode: '3d',
        concepts: ['EdgesGeometry', 'selection', 'world transform'],
        summary: 'Highlight a selected mesh with a lightweight edge overlay that follows its transform.',
        explanation: ['EdgesGeometry extracts sharp topology edges from the source geometry.', 'Parenting the outline to the selected mesh makes it inherit position, rotation, and scale automatically.'],
        code: `function outlineSelection(mesh) {
  const edges = new THREE.EdgesGeometry(mesh.geometry, 20)
  const outline = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0xffff00 })
  )
  outline.scale.setScalar(1.01)
  mesh.add(outline)
  return outline
}`,
        walkthrough: [
          note('1–2', 'Extract meaningful edges', 'The threshold angle excludes nearly coplanar triangle edges while retaining visible corners.'),
          note('3–6', 'Render edges as independent lines', 'LineSegments interprets each position pair as one edge and uses a bright unlit material.'),
          note('7', 'Avoid z-fighting', 'A tiny scale increase places the overlay just outside the original surface.'),
          note('8–9', 'Inherit the selected transform', 'Making the outline a child keeps it aligned as the part moves or rotates.'),
        ],
        previewCode: threePreview('let selected', `selected=new THREE.Mesh(new THREE.DodecahedronGeometry(2),new THREE.MeshStandardMaterial({color:0x475569}));scene.add(selected);const outline=new THREE.LineSegments(new THREE.EdgesGeometry(selected.geometry,20),new THREE.LineBasicMaterial({color:0xffff00}));outline.scale.setScalar(1.01);selected.add(outline);camera.position.set(0,1,7)`, `selected.rotation.x+=dt*.15;selected.rotation.y+=dt*.3;renderer.render(scene,camera)`),
      },
    ],
  },
  {
    category: 'Procedural Geometry & Paths',
    color: 'text-lime-400',
    items: [
      {
        key: 'geometry-cnc-toolpath', label: 'Draw a CNC toolpath', level: 'Intermediate', kind: 'CNC visualization', mode: '3d',
        concepts: ['BufferGeometry', 'coordinate data', 'line segments'],
        summary: 'Convert machine coordinate records into a colored rapid-and-cut toolpath.',
        explanation: ['BufferGeometry stores tool positions directly in GPU-friendly typed arrays.', 'Separate rapid and cutting segments can use different colors without changing coordinate data.'],
        code: `const positions = []
for (let i = 1; i < moves.length; i++) {
  const previous = moves[i - 1]
  const current = moves[i]
  positions.push(
    previous.x, previous.z, -previous.y,
    current.x, current.z, -current.y
  )
}
const geometry = new THREE.BufferGeometry()
geometry.setAttribute(
  'position', new THREE.Float32BufferAttribute(positions, 3)
)
const path = new THREE.LineSegments(geometry, material)`,
        walkthrough: [
          note('1–4', 'Turn consecutive moves into segments', 'Each move after the first pairs with its predecessor to form one visible toolpath segment.'),
          note('5–7', 'Map machine axes into scene axes', 'This example uses machine Z as world Y and negates machine Y to match the chosen handedness.'),
          note('10–13', 'Upload positions as a vertex attribute', 'Three components per vertex tell the GPU how to read xyz triples.'),
          note('14', 'Render independent segments', 'LineSegments draws pairs without connecting the end of one move to the start of an unrelated one.'),
        ],
        previewCode: threePreview('let path,t=0', `const moves=[];for(let i=0;i<160;i++){const a=i*.16;moves.push({x:Math.cos(a)*(.7+a*.045),y:Math.sin(a)*(.7+a*.045),z:i*.018})}const positions=[];for(let i=1;i<moves.length;i++){const a=moves[i-1],b=moves[i];positions.push(a.x,a.z,-a.y,b.x,b.z,-b.y)}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));path=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0x4ade80}));scene.add(path);camera.position.set(7,6,9);camera.lookAt(0,1,0)`, `path.rotation.y+=dt*.15;renderer.render(scene,camera)`),
      },
      {
        key: 'geometry-curve-follower', label: 'Tool follows 3D curve', level: 'Advanced', kind: 'CNC visualization', mode: '3d',
        concepts: ['curve tangent', 'quaternion', 'arc length'],
        summary: 'Move and orient a cutter along a 3D curve using its position and tangent.',
        explanation: ['Arc-length sampling keeps travel speed more uniform along uneven curve segments.', 'A quaternion aligns the cutter axis with the instantaneous tangent.'],
        code: `progress = (progress + feedRate * dt) % 1
const position = curve.getPointAt(progress)
const tangent = curve.getTangentAt(progress).normalize()
tool.position.copy(position)
tool.quaternion.setFromUnitVectors(
  new THREE.Vector3(0, 1, 0), tangent
)`,
        walkthrough: [
          note('1', 'Advance by normalized feed', 'Progress wraps at one; a production system would convert physical feed rate through total curve length.'),
          note('2–3', 'Sample the path frame', 'Position locates the tool tip and tangent gives the instantaneous direction of travel.'),
          note('4', 'Place the cutter', 'Copying avoids replacing the Object3D position instance.'),
          note('5–7', 'Align the cutter axis', 'The shortest quaternion rotation maps local +y, the cylinder axis, onto the curve tangent.'),
        ],
        previewCode: threePreview('let curve,tool,progress=0', `curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-5,0,-2),new THREE.Vector3(-2,3,1),new THREE.Vector3(1,-1,3),new THREE.Vector3(5,2,-1)]);scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(160)),new THREE.LineBasicMaterial({color:0x38bdf8})));tool=new THREE.Mesh(new THREE.CylinderGeometry(.35,.15,2,20),new THREE.MeshStandardMaterial({color:0xf59e0b}));scene.add(tool);camera.position.set(8,6,10);camera.lookAt(0,1,0)`, `progress=(progress+dt*.08)%1;const p=curve.getPointAt(progress),t=curve.getTangentAt(progress).normalize();tool.position.copy(p);tool.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),t);renderer.render(scene,camera)`),
      },
      {
        key: 'geometry-helix', label: 'Generate a helix', level: 'Intermediate', kind: 'Procedural geometry', mode: '3d',
        concepts: ['parametric equation', 'pitch', 'sampling'],
        summary: 'Generate a helical path from radius, pitch, turns, and angular samples.',
        explanation: ['Cosine and sine trace the circular cross-section while angle controls height.', 'Increasing samples improves visual smoothness without changing the mathematical curve.'],
        code: `const points = []
const turns = 6, radius = 2, pitch = 0.6
for (let i = 0; i <= 240; i++) {
  const t = i / 240
  const angle = t * turns * Math.PI * 2
  points.push(new THREE.Vector3(
    radius * Math.cos(angle),
    pitch * angle / (Math.PI * 2),
    radius * Math.sin(angle)
  ))
}`,
        walkthrough: [
          note('1–2', 'Choose geometric parameters', 'Radius controls cylinder size, turns controls revolutions, and pitch is vertical rise per complete turn.'),
          note('3–5', 'Map sample index to angle', 'Normalized `t` spans the whole curve and angle converts progress into the requested number of revolutions.'),
          note('6–10', 'Evaluate the parametric helix', 'Cosine/sine make the circular xz motion while angle divided by 2π counts completed turns for y.'),
        ],
        previewCode: threePreview('let line', `const points=[],turns=7,radius=2,pitch=.55;for(let i=0;i<=280;i++){const t=i/280,a=t*turns*Math.PI*2;points.push(new THREE.Vector3(radius*Math.cos(a),pitch*a/(Math.PI*2)-2,radius*Math.sin(a)))}line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x4ade80}));scene.add(line);camera.position.set(7,5,9);camera.lookAt(0,0,0)`, `line.rotation.y+=dt*.2;renderer.render(scene,camera)`),
      },
      {
        key: 'geometry-tube-path', label: 'Tube around a path', level: 'Intermediate', kind: 'Procedural geometry', mode: '3d',
        concepts: ['TubeGeometry', 'Frenet frame', 'curve'],
        summary: 'Turn a centerline curve into a shaded pipe or swept toolpath.',
        explanation: ['TubeGeometry samples a curve and constructs perpendicular rings along it.', 'Tubular segments control length resolution; radial segments control roundness.'],
        code: `const curve = new THREE.CatmullRomCurve3(controlPoints)
const geometry = new THREE.TubeGeometry(
  curve,
  160,
  0.22,
  12,
  false
)
const tube = new THREE.Mesh(geometry, material)
scene.add(tube)`,
        walkthrough: [
          note('1', 'Interpolate the centerline', 'Catmull–Rom passes smoothly through the supplied control points.'),
          note('2–7', 'Sweep circular rings', 'The constructor samples 160 positions, creates radius 0.22 rings with 12 sides, and leaves the path open.'),
          note('8–9', 'Shade and attach the surface', 'Unlike a line, the resulting triangles have normals and respond to scene lighting.'),
        ],
        previewCode: threePreview('let tube', `const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-5,-1,0),new THREE.Vector3(-2,2,2),new THREE.Vector3(1,-2,1),new THREE.Vector3(5,1,-1)]);tube=new THREE.Mesh(new THREE.TubeGeometry(curve,160,.25,12,false),new THREE.MeshStandardMaterial({color:0x8b5cf6,metalness:.3,roughness:.25}));scene.add(tube);camera.position.set(7,5,9);camera.lookAt(0,0,0)`, `tube.rotation.y+=dt*.2;renderer.render(scene,camera)`),
      },
      {
        key: 'geometry-lathe-profile', label: 'Revolve a 2D profile', level: 'Intermediate', kind: 'Procedural geometry', mode: '3d',
        concepts: ['surface of revolution', 'profile', 'LatheGeometry'],
        summary: 'Turn radial profile points into a rotationally symmetric 3D part.',
        explanation: ['Each Vector2 stores radius in x and height in y.', 'LatheGeometry rotates that profile around the y-axis to create rings of vertices.'],
        code: `const profile = [
  new THREE.Vector2(0.0, -2.0),
  new THREE.Vector2(1.4, -1.8),
  new THREE.Vector2(1.1, -0.5),
  new THREE.Vector2(1.8,  0.3),
  new THREE.Vector2(0.8,  1.8),
  new THREE.Vector2(0.0,  2.0)
]
const geometry = new THREE.LatheGeometry(profile, 64)
geometry.computeVertexNormals()`,
        walkthrough: [
          note('1–8', 'Describe only the cross-section', 'The x value is distance from the rotation axis, so zero-valued endpoints cap the top and bottom.'),
          note('9', 'Sweep the profile around y', 'Sixty-four radial segments create the full 360° surface.'),
          note('10', 'Prepare smooth lighting', 'Recomputed vertex normals make the revolved surface shade continuously.'),
        ],
        previewCode: threePreview('let part', `const p=[new THREE.Vector2(0,-2),new THREE.Vector2(1.4,-1.8),new THREE.Vector2(1.1,-.5),new THREE.Vector2(1.8,.3),new THREE.Vector2(.8,1.8),new THREE.Vector2(0,2)],g=new THREE.LatheGeometry(p,64);g.computeVertexNormals();part=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xf59e0b,metalness:.45,roughness:.25}));scene.add(part);camera.position.set(5,3,8);camera.lookAt(0,0,0)`, `part.rotation.y+=dt*.35;renderer.render(scene,camera)`),
      },
    ],
  },
  {
    category: 'Model I/O',
    color: 'text-sky-400',
    items: [
      {
        key: 'model-upload-glb', label: 'Upload GLB / glTF', level: 'Intermediate', kind: 'Model import', mode: '3d',
        concepts: ['File API', 'GLTFLoader', 'object URL'],
        summary: 'Let the learner choose a local GLB or self-contained glTF file and load it directly into the scene.',
        explanation: ['Object URLs expose a selected local file to the loader without uploading it to a server.', 'GLB is the most reliable single-file choice because external textures and binary buffers are packed inside it.'],
        code: `const input = document.createElement('input')
input.type = 'file'
input.accept = '.glb,.gltf,model/gltf-binary,model/gltf+json'
input.className = 'sim-overlay'
document.body.appendChild(input)

input.addEventListener('change', async () => {
  const file = input.files[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  try {
    const gltf = await new THREE.GLTFLoader().loadAsync(url)
    gltf.scene.traverse(child => {
      if (child.isMesh) child.castShadow = child.receiveShadow = true
    })
    scene.add(gltf.scene)
  } finally {
    URL.revokeObjectURL(url)
  }
})`,
        walkthrough: [
          note('1–5', 'Create a local-file picker', 'The accept list guides the operating-system dialog while the overlay class lets Sim Lab remove the control on reset.'),
          note('7–11', 'Convert the selected File into a loader URL', 'No network upload occurs. The browser grants this page temporary access through a blob URL.'),
          note('12–15', 'Load and prepare the imported hierarchy', 'GLTFLoader returns a scene graph; traversal finds nested meshes and enables their shadow participation.'),
          note('16–19', 'Attach and release resources', 'The loaded objects enter the Sim Lab scene, then the temporary URL is revoked after parsing completes.'),
        ],
        previewCode: threePreview('let model', `const label=document.createElement('label');label.className='sim-overlay';label.textContent='Choose .glb / .gltf';Object.assign(label.style,{top:'14px',left:'14px',padding:'9px 12px',borderRadius:'8px',background:'#7c3aed',color:'white',cursor:'pointer'});const input=document.createElement('input');input.type='file';input.accept='.glb,.gltf,model/gltf-binary,model/gltf+json';input.style.display='none';label.appendChild(input);document.body.appendChild(label);input.addEventListener('change',async()=>{const file=input.files[0];if(!file)return;const url=URL.createObjectURL(file);try{const gltf=await new THREE.GLTFLoader().loadAsync(url);if(model)scene.remove(model);model=gltf.scene;model.traverse(c=>{if(c.isMesh)c.castShadow=c.receiveShadow=true});scene.add(model);const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()).length(),center=box.getCenter(new THREE.Vector3());model.position.sub(center);camera.position.set(size*.7,size*.45,size*.8);camera.lookAt(0,0,0)}finally{URL.revokeObjectURL(url)}});const demo=new THREE.Mesh(new THREE.TorusKnotGeometry(1.5,.45,120,16),new THREE.MeshNormalMaterial());scene.add(demo);model=demo;camera.position.set(0,1,7)`, `if(model)model.rotation.y+=dt*.2;renderer.render(scene,camera)`),
      },
      {
        key: 'model-upload-obj', label: 'Upload OBJ', level: 'Intermediate', kind: 'Model import', mode: '3d',
        concepts: ['OBJLoader', 'FileReader', 'fallback material'],
        summary: 'Parse a local OBJ text file and assign a fallback material to geometry that has no usable material.',
        explanation: ['OBJ is text-based and can be parsed directly after FileReader loads the selected file.', 'A standalone OBJ may reference an external MTL file, so this example supplies a consistent material itself.'],
        code: `const reader = new FileReader()
reader.addEventListener('load', () => {
  const object = new THREE.OBJLoader().parse(reader.result)
  object.traverse(child => {
    if (!child.isMesh) return
    child.material = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.65
    })
    child.geometry.computeVertexNormals()
  })
  scene.add(object)
})
reader.readAsText(file)`,
        walkthrough: [
          note('1–2', 'Wait for local text', 'FileReader runs asynchronously and exposes file contents through `result` when loading finishes.'),
          note('3', 'Parse OBJ records into a hierarchy', 'OBJLoader converts vertices, normals, texture coordinates, faces, and groups into Three.js objects.'),
          note('4–10', 'Standardize every mesh', 'Traversal handles multi-part files, replaces missing/external materials, and ensures lighting normals exist.'),
          note('12–14', 'Attach after parsing', 'Reading begins only after the listener is ready, and the completed hierarchy enters the scene once.'),
        ],
        previewCode: threePreview('let model', `const label=document.createElement('label');label.className='sim-overlay';label.textContent='Choose .obj';Object.assign(label.style,{top:'14px',left:'14px',padding:'9px 12px',borderRadius:'8px',background:'#0284c7',color:'white',cursor:'pointer'});const input=document.createElement('input');input.type='file';input.accept='.obj,text/plain';input.style.display='none';label.appendChild(input);document.body.appendChild(label);input.addEventListener('change',()=>{const file=input.files[0];if(!file)return;const reader=new FileReader();reader.addEventListener('load',()=>{if(model)scene.remove(model);model=new THREE.OBJLoader().parse(reader.result);model.traverse(c=>{if(c.isMesh){c.material=new THREE.MeshStandardMaterial({color:0x94a3b8,roughness:.65});c.geometry.computeVertexNormals()}});scene.add(model);const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()).length();model.position.sub(center);camera.position.set(size*.7,size*.45,size*.8);camera.lookAt(0,0,0)});reader.readAsText(file)});model=new THREE.Mesh(new THREE.IcosahedronGeometry(1.8,2),new THREE.MeshStandardMaterial({color:0x94a3b8,flatShading:true}));scene.add(model);camera.position.set(0,1,7)`, `if(model)model.rotation.y+=dt*.2;renderer.render(scene,camera)`),
      },
      {
        key: 'model-fit-camera', label: 'Frame any model', level: 'Intermediate', kind: 'Model utility', mode: '3d',
        concepts: ['bounding box', 'field of view', 'camera framing'],
        summary: 'Center an arbitrary imported model and position the perspective camera so the whole object fits.',
        explanation: ['A world-space bounding box handles nested meshes and their transforms.', 'The vertical field-of-view triangle converts model height into a required camera distance.'],
        code: `function frameModel(model, padding = 1.25) {
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  model.position.sub(center)

  const maxSize = Math.max(size.x, size.y, size.z)
  const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5)
  const distance = padding * maxSize / (2 * Math.tan(halfFov))
  camera.position.set(distance, distance * 0.45, distance)
  camera.near = Math.max(distance / 100, 0.01)
  camera.far = distance * 100
  camera.updateProjectionMatrix()
  camera.lookAt(0, 0, 0)
}`,
        walkthrough: [
          note('1–4', 'Measure the complete hierarchy', '`setFromObject` expands around transformed descendants; size and center summarize that world-space box.'),
          note('5', 'Move the model origin to its visual center', 'Subtracting the center makes orbit controls and camera aiming behave naturally.'),
          note('7–9', 'Solve viewing distance', 'The largest dimension and half-FOV form a right triangle; padding adds breathing room.'),
          note('10–14', 'Place and configure depth range', 'Near/far scale with the model to preserve depth precision across tiny and huge imports.'),
          note('15', 'Aim at the normalized center', 'After recentering, the origin is the correct camera target.'),
        ],
        previewCode: threePreview('let model,t=0;function frameModel(model,padding=1.25){const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());model.position.sub(center);const max=Math.max(size.x,size.y,size.z),half=THREE.MathUtils.degToRad(camera.fov*.5),distance=padding*max/(2*Math.tan(half));camera.position.set(distance,distance*.45,distance);camera.near=Math.max(distance/100,.01);camera.far=distance*100;camera.updateProjectionMatrix();camera.lookAt(0,0,0)}', `model=new THREE.Mesh(new THREE.BoxGeometry(1,5,2),new THREE.MeshNormalMaterial());model.position.set(4,3,-2);model.rotation.z=.35;scene.add(model);frameModel(model)`, `t+=dt;model.rotation.y+=dt*.2;renderer.render(scene,camera)`),
      },
      {
        key: 'model-inspect-materials', label: 'Inspect model materials', level: 'Intermediate', kind: 'Model utility', mode: '3d',
        concepts: ['traverse', 'material arrays', 'metadata'],
        summary: 'Walk an imported hierarchy and build an inventory of meshes, geometry sizes, and material names.',
        explanation: ['Imported assets can contain deeply nested groups and either one material or a material array per mesh.', 'An inventory is the first step toward material editors, isolation tools, and CAD assembly browsers.'],
        code: `function inspectModel(root) {
  const report = []
  root.traverse(child => {
    if (!child.isMesh) return
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material]
    report.push({
      name: child.name || '(unnamed mesh)',
      vertices: child.geometry.attributes.position?.count || 0,
      materials: materials.map(material => material.name || material.type)
    })
  })
  return report
}`,
        walkthrough: [
          note('1–4', 'Find meshes at any depth', '`traverse` removes assumptions about how the exporter grouped the model.'),
          note('5–7', 'Normalize one-or-many materials', 'Turning both cases into an array makes the reporting logic uniform.'),
          note('8–12', 'Extract practical metadata', 'Names identify parts, vertex counts estimate geometry weight, and material identifiers power later editing UI.'),
          note('15', 'Return data instead of rendering it', 'Keeping inspection pure makes the report reusable in tables, logs, filters, or export validation.'),
        ],
        previewCode: threePreview('let model,t=0', `model=new THREE.Group();for(let i=0;i<5;i++){const mesh=new THREE.Mesh(i%2?new THREE.SphereGeometry(.6,12,12):new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({name:i%2?'Paint':'Metal',color:new THREE.Color().setHSL(i/5,.7,.55)}));mesh.name='Part '+(i+1);mesh.position.x=(i-2)*1.4;model.add(mesh)}scene.add(model);const report=[];model.traverse(c=>{if(c.isMesh)report.push({name:c.name,vertices:c.geometry.attributes.position.count,material:c.material.name})});console.table(report);camera.position.set(0,3,9)`, `t+=dt;model.rotation.y=Math.sin(t*.4)*.4;renderer.render(scene,camera)`),
      },
      {
        key: 'model-export-glb', label: 'Export scene as GLB', level: 'Advanced', kind: 'Model export', mode: '3d',
        concepts: ['GLTFExporter', 'Blob', 'download'],
        summary: 'Serialize a chosen model hierarchy into a compact binary GLB and download it locally.',
        explanation: ['GLTFExporter preserves supported geometry, materials, transforms, animations, and hierarchy.', 'A Blob URL turns the in-memory ArrayBuffer into a browser download without a server.'],
        code: `function exportGLB(model, filename = 'model.glb') {
  const exporter = new THREE.GLTFExporter()
  exporter.parse(
    model,
    result => {
      const blob = new Blob([result], {
        type: 'model/gltf-binary'
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    },
    error => console.error('GLB export failed', error),
    { binary: true, onlyVisible: true }
  )
}`,
        walkthrough: [
          note('1–3', 'Create an exporter for one chosen root', 'Exporting a model group avoids accidentally including Sim Lab lights, grids, helpers, or camera.'),
          note('4–8', 'Convert the binary result into a typed download', 'Binary mode returns an ArrayBuffer; Blob supplies the correct MIME type.'),
          note('9–13', 'Trigger and clean up the local download', 'A temporary anchor starts the save operation and the object URL is revoked afterward.'),
          note('15–16', 'Handle failure and choose export policy', 'The final options produce GLB and omit objects the learner marked invisible.'),
        ],
        previewCode: threePreview('let model,t=0;function exportGLB(model,filename="model.glb"){new THREE.GLTFExporter().parse(model,result=>{const blob=new Blob([result],{type:"model/gltf-binary"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url)},error=>console.error(error),{binary:true,onlyVisible:true})}', `model=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(3,1,2),new THREE.MeshStandardMaterial({color:0x38bdf8}));model.add(body);for(const x of [-1,1])for(const z of [-.7,.7]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,.25,16),new THREE.MeshStandardMaterial({color:0x111827}));wheel.rotation.z=Math.PI/2;wheel.position.set(x,-.55,z);model.add(wheel)}scene.add(model);const button=document.createElement('button');button.className='sim-overlay';button.textContent='Export demo GLB';Object.assign(button.style,{top:'14px',left:'14px',padding:'9px 12px',border:0,borderRadius:'8px',background:'#16a34a',color:'white',cursor:'pointer'});button.onclick=()=>exportGLB(model);document.body.appendChild(button);camera.position.set(6,4,8);camera.lookAt(0,0,0)`, `t+=dt;model.rotation.y+=dt*.25;renderer.render(scene,camera)`),
      },
      {
        key: 'model-export-geometry-json', label: 'Export geometry JSON', level: 'Beginner', kind: 'Model export', mode: '3d',
        concepts: ['toJSON', 'Blob', 'round trip'],
        summary: 'Save one generated or edited BufferGeometry as readable Three.js JSON.',
        explanation: ['Geometry JSON records attributes, groups, morph data, and metadata without scene lights or materials.', 'BufferGeometryLoader can later reconstruct the geometry from the parsed JSON object.'],
        code: `function exportGeometry(geometry, filename = 'geometry.json') {
  const json = geometry.toJSON()
  const text = JSON.stringify(json, null, 2)
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const restored = new THREE.BufferGeometryLoader().parse(json)`,
        walkthrough: [
          note('1–3', 'Serialize geometry data', '`toJSON` returns a plain object; pretty-printing makes it inspectable and version-control friendly.'),
          note('4–9', 'Create the download', 'The JSON string becomes a Blob, then a temporary URL and anchor request the browser save dialog.'),
          note('10', 'Release the object URL', 'Revoking after the click avoids retaining the generated file in browser memory.'),
          note('13', 'Demonstrate the round trip', 'BufferGeometryLoader converts the parsed JSON representation back into renderable attributes and indices.'),
        ],
        previewCode: threePreview('let mesh,t=0;function exportGeometry(geometry,filename="geometry.json"){const json=geometry.toJSON(),text=JSON.stringify(json,null,2),blob=new Blob([text],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url)}', `mesh=new THREE.Mesh(new THREE.TorusKnotGeometry(1.6,.45,100,16),new THREE.MeshNormalMaterial());scene.add(mesh);const button=document.createElement('button');button.className='sim-overlay';button.textContent='Export geometry JSON';Object.assign(button.style,{top:'14px',left:'14px',padding:'9px 12px',border:0,borderRadius:'8px',background:'#2563eb',color:'white',cursor:'pointer'});button.onclick=()=>exportGeometry(mesh.geometry);document.body.appendChild(button);camera.position.set(0,1,7)`, `t+=dt;mesh.rotation.y+=dt*.25;renderer.render(scene,camera)`),
      },
    ],
  },
]
