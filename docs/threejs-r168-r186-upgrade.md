# Three.js r168 → r186 upgrade

This upgrade is deliberately tested in two steps (`r168 → r178 → r186`) because the official Three.js migration guide recommends increments of no more than ten releases.

## Preflight findings

| Migration | Repository use | Action |
|---|---|---|
| r168 → r169: `TransformControls` no longer extends `Object3D` | CNC Backplot added the control directly; Mesh Lab already handled both APIs | Add `getHelper()` compatibility and regression coverage before upgrading |
| r169 → r178 removals and renames | No active runtime use found | Verify build and 3D smoke tests at r178 |
| r178 → r179: `Timer` enters core | Basketball, Mini Golf, and teaching examples use `Clock` | Migrate the active games now; update the teaching examples separately so each explanation changes with its code |
| r179 → r180: `RGBELoader` renamed to `HDRLoader` | Two Three.js lessons mention or demonstrate the old loader | Update the lessons after the runtime upgrade |
| r181 → r182: `PCFSoftShadowMap` deprecated for WebGL | Runtime games/labs and teaching examples use it | Move to `PCFShadowMap`, which is soft on current releases |
| r183 → r184: FBX +Z-up conversion and environment rotation changed | CNC imports FBX; scenes use environment lighting | Browser-smoke model loading and visually inspect representative lighting |
| r184 → r185: PLY attribute types are preserved | CNC imports PLY | Smoke-test a PLY fixture and convert float64 attributes if encountered |
| r185 → r186 changes | No `GTAONode`, `SimplifyModifier`, `LightProbeGrid`, or `toTrianglesDrawMode` use found | No source repair expected |

## Automated verification

1. Run the Mesh Lab and CNC control compatibility tests.
2. Run all tests colocated with 3D labs and games.
3. Run the lesson JavaScript checker for the Three.js course.
4. Build the production application.
5. Open representative routes in a real browser and fail on page errors:
   - Three.js course and Sim Lab
   - CNC Simulator
   - Mesh Lab
   - Robot Arm Simulator
   - Basketball and Mini Golf

## Completed runtime repairs

- CNC now adds the `TransformControls` helper object required by r169 and later.
- Active WebGL games and labs now use `PCFShadowMap`.
- Basketball and Mini Golf now use `Timer`, call `update()` once per frame, and disconnect the document visibility listener on cleanup.

## Follow-up content cleanup

Update teaching examples from `Clock` to `Timer`, from `PCFSoftShadowMap` to `PCFShadowMap`, and from `RGBELoader` to `HDRLoader` so new learners see current APIs. These are content edits as well as code edits: each explanation and expected result must be reviewed with its example. `Timer` requires `update()` once per frame and uses `getElapsed()` instead of `getElapsedTime()`.
