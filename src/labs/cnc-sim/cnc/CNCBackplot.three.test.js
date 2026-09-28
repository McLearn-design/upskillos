// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'

describe('CNC Backplot three.js controls', () => {
  it('constructs the controls and adds the transform gizmo to a scene', () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
    const canvas = document.createElement('canvas')
    const orbit = new OrbitControls(camera, canvas)
    const transform = new TransformControls(camera, canvas)
    const helper = typeof transform.getHelper === 'function'
      ? transform.getHelper()
      : transform

    expect(helper).toBeInstanceOf(THREE.Object3D)
    expect(() => scene.add(helper)).not.toThrow()
    expect(scene.children).toContain(helper)

    orbit.dispose()
    transform.dispose()
  })
})
