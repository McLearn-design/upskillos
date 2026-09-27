import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { useThemeColors } from '../../hooks/useThemeColors';

interface MeshLabProps {
  onBack?: () => void;
}

type TransformMode = 'translate' | 'rotate' | 'scale';

interface OutlinerItem {
  id: string;
  name: string;
  type: string;
  meshRef: THREE.Object3D;
  isLight?: boolean;
}

interface CommandHistory {
  input: string;
  output: string;
  isError: boolean;
}

const COLLAPSED_SECTIONS_INITIAL = {
  matrix: true,
  derivation: true,
  geometry: false,
  material: false,
};

export default function MeshLab({ onBack }: MeshLabProps) {
  const colors = useThemeColors();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const consoleBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const orbitControlsRef = useRef<OrbitControls | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const outlineRef = useRef<THREE.LineSegments | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const rafRef = useRef<number>(0);
  
  const [objects, setObjects] = useState<OutlinerItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<TransformMode>('translate');
  const [frameCount, setFrameCount] = useState(0);
  
  const [collapsedSections, setCollapsedSections] = useState(COLLAPSED_SECTIONS_INITIAL);
  const [consoleInput, setConsoleInput] = useState('');
  const [consoleHistory, setConsoleHistory] = useState<CommandHistory[]>([
    { input: '', output: '// MeshLab. Select an object and try: selected.rotation.y = Math.PI/4', isError: false }
  ]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Throttled state for inspector
  const selectedMesh = objects.find(o => o.id === selectedId)?.meshRef as THREE.Mesh | undefined;
  
  // Create Scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(colors.background || '#1a1a1a');
    sceneRef.current = scene;
    
    const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    camera.position.set(5, 4, 7);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvasRef.current });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbitControlsRef.current = orbit;
    
    const transform = new TransformControls(camera, renderer.domElement);
    transform.addEventListener('dragging-changed', (event) => {
      if (orbitControlsRef.current) {
        orbitControlsRef.current.enabled = !event.value;
      }
    });
    // TransformControls was itself an Object3D up to three r168, so it went
    // into the scene directly. In r169 it became a Controls subclass and the
    // visible gizmo moved to a separate object returned by getHelper().
    //
    // This project is on 0.168.0, where calling getHelper() throws and the lab
    // does not load at all. Support both, so neither an upgrade nor a rollback
    // silently breaks the viewport again.
    const withHelper = transform as unknown as { getHelper?: () => THREE.Object3D };
    const gizmo: THREE.Object3D = typeof withHelper.getHelper === 'function'
      ? withHelper.getHelper()
      : (transform as unknown as THREE.Object3D);
    scene.add(gizmo);
    transformControlsRef.current = transform;
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0x404060, 0.8);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);
    
    // Helpers
    const gridHelper = new THREE.GridHelper(10, 10);
    scene.add(gridHelper);
    
    const axesHelper = new THREE.AxesHelper(2);
    scene.add(axesHelper);
    
    // Initial Objects
    const initialObjects: OutlinerItem[] = [];
    
    const cubeGeo = new THREE.BoxGeometry(2, 2, 2);
    const cubeMat = new THREE.MeshStandardMaterial({ color: 0x4488ff, roughness: 0.4, metalness: 0.3 });
    const cube = new THREE.Mesh(cubeGeo, cubeMat);
    cube.position.set(0, 0, 0);
    cube.castShadow = true;
    cube.receiveShadow = true;
    scene.add(cube);
    initialObjects.push({ id: cube.uuid, name: 'Cube', type: 'BoxGeometry', meshRef: cube });
    
    const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
    const sphereMat = new THREE.MeshStandardMaterial({ color: 0xff6644, roughness: 0.6 });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.set(3, 1, 0);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    scene.add(sphere);
    initialObjects.push({ id: sphere.uuid, name: 'Sphere', type: 'SphereGeometry', meshRef: sphere });
    
    const planeGeo = new THREE.PlaneGeometry(4, 4);
    const planeMat = new THREE.MeshStandardMaterial({ color: 0x44cc88, roughness: 0.8, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(-2, 0, 1);
    plane.receiveShadow = true;
    scene.add(plane);
    initialObjects.push({ id: plane.uuid, name: 'Plane', type: 'PlaneGeometry', meshRef: plane });
    
    const pointLight = new THREE.PointLight(0xffffff, 1, 10);
    pointLight.position.set(0, 2, 0);
    scene.add(pointLight);
    const pointLightHelper = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
    pointLight.add(pointLightHelper);
    initialObjects.push({ id: pointLight.uuid, name: 'Point Light', type: 'PointLight', meshRef: pointLight, isLight: true });
    
    setObjects(initialObjects);
    
    // Animation Loop
    let fCount = 0;
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      if (orbitControlsRef.current) orbitControlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      fCount++;
      if (fCount % 6 === 0) {
        setFrameCount(fCount);
      }
    };
    animate();
    
    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.target === containerRef.current) {
          const w = entry.contentRect.width;
          const h = entry.contentRect.height;
          if (rendererRef.current && cameraRef.current) {
            rendererRef.current.setSize(w, h, false);
            cameraRef.current.aspect = w / h;
            cameraRef.current.updateProjectionMatrix();
          }
        }
      }
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    
    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
      if (rendererRef.current) rendererRef.current.dispose();
      if (orbitControlsRef.current) orbitControlsRef.current.dispose();
      if (transformControlsRef.current) transformControlsRef.current.dispose();
      
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(m => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        }
      });
      if (outlineRef.current) {
        outlineRef.current.geometry.dispose();
        (outlineRef.current.material as THREE.Material).dispose();
      }
    };
  }, []);

  // Update selection outline and transform controls
  useEffect(() => {
    if (!sceneRef.current || !transformControlsRef.current) return;
    
    const selected = objects.find(o => o.id === selectedId)?.meshRef;
    
    if (outlineRef.current && outlineRef.current.parent) {
      outlineRef.current.parent.remove(outlineRef.current);
      outlineRef.current.geometry.dispose();
      (outlineRef.current.material as THREE.Material).dispose();
      outlineRef.current = null;
    }
    
    if (selected) {
      transformControlsRef.current.attach(selected);
      
      if (selected instanceof THREE.Mesh) {
        const edges = new THREE.EdgesGeometry(selected.geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffff00 }));
        selected.add(line);
        outlineRef.current = line;
      }
    } else {
      transformControlsRef.current.detach();
    }
  }, [selectedId, objects]);

  // Transform Mode
  useEffect(() => {
    if (transformControlsRef.current) {
      transformControlsRef.current.setMode(transformMode);
    }
  }, [transformMode]);

  // Raycaster click
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!canvasRef.current || !cameraRef.current || !sceneRef.current) return;
      if (transformControlsRef.current?.dragging) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      mouseRef.current.x = (x / rect.width) * 2 - 1;
      mouseRef.current.y = -(y / rect.height) * 2 + 1;
      
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      
      const meshes = objects.map(o => o.meshRef);
      const intersects = raycasterRef.current.intersectObjects(meshes, false);
      
      if (intersects.length > 0) {
        setSelectedId(intersects[0].object.uuid);
      } else {
        setSelectedId(null);
      }
    };
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('pointerdown', handlePointerDown);
    }
    
    return () => {
      if (canvas) {
        canvas.removeEventListener('pointerdown', handlePointerDown);
      }
    };
  }, [objects]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key.toLowerCase()) {
        case 'g':
          setTransformMode('translate');
          break;
        case 'r':
          setTransformMode('rotate');
          break;
        case 's':
          setTransformMode('scale');
          break;
        case 'escape':
          setSelectedId(null);
          break;
        case 'delete':
        case 'backspace':
          if (selectedId) {
            const obj = objects.find(o => o.id === selectedId);
            if (obj && !obj.isLight) {
              if (sceneRef.current) {
                sceneRef.current.remove(obj.meshRef);
                if (obj.meshRef instanceof THREE.Mesh) {
                  obj.meshRef.geometry.dispose();
                  if (Array.isArray(obj.meshRef.material)) {
                    obj.meshRef.material.forEach(m => m.dispose());
                  } else {
                    obj.meshRef.material.dispose();
                  }
                }
              }
              setObjects(prev => prev.filter(o => o.id !== selectedId));
              setSelectedId(null);
            }
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, objects]);

  // Console scroll
  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleHistory]);

  const toggleSection = (section: keyof typeof COLLAPSED_SECTIONS_INITIAL) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleConsoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consoleInput.trim()) return;
    
    let output = '';
    let isError = false;
    
    try {
      const selected = objects.find(o => o.id === selectedId)?.meshRef || null;
      const fn = new Function('scene', 'selected', 'add', 'THREE', 'Math', `
        return (function() {
          ${consoleInput}
        })();
      `);
      const result = fn(sceneRef.current, selected, handleAddObject, THREE, Math);
      output = result !== undefined ? String(result) : 'undefined';
    } catch (err: any) {
      output = err.toString();
      isError = true;
    }
    
    setConsoleHistory(prev => [...prev, { input: `> ${consoleInput}`, output, isError }]);
    setConsoleInput('');
    setHistoryIndex(-1);
  };

  const handleConsoleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const inputs = consoleHistory.filter(h => h.input.startsWith('> ')).map(h => h.input.substring(2));
      if (inputs.length > 0) {
        const newIndex = historyIndex < inputs.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setConsoleInput(inputs[inputs.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const inputs = consoleHistory.filter(h => h.input.startsWith('> ')).map(h => h.input.substring(2));
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setConsoleInput(inputs[inputs.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setConsoleInput('');
      }
    }
  };

  const handleAddObject = (type: string) => {
    if (!sceneRef.current) return;
    
    const x = (Math.random() - 0.5) * 6;
    const z = (Math.random() - 0.5) * 6;
    
    let geo: THREE.BufferGeometry;
    let name: string;
    
    switch (type.toLowerCase()) {
      case 'box':
        geo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        name = 'Box';
        break;
      case 'sphere':
        geo = new THREE.SphereGeometry(1, 32, 32);
        name = 'Sphere';
        break;
      case 'cylinder':
        geo = new THREE.CylinderGeometry(1, 1, 2, 32);
        name = 'Cylinder';
        break;
      case 'cone':
        geo = new THREE.ConeGeometry(1, 2, 32);
        name = 'Cone';
        break;
      case 'torus':
        geo = new THREE.TorusGeometry(1, 0.4, 16, 50);
        name = 'Torus';
        break;
      default:
        geo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        name = 'Box';
    }
    
    const mat = new THREE.MeshStandardMaterial({ 
      color: Math.random() * 0xffffff, 
      roughness: Math.random(), 
      metalness: Math.random() * 0.5 
    });
    
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    sceneRef.current.add(mesh);
    
    const newItem = { id: mesh.uuid, name: `${name} ${objects.length}`, type: name + 'Geometry', meshRef: mesh };
    setObjects(prev => [...prev, newItem]);
    setSelectedId(mesh.uuid);
    setShowAddMenu(false);
    return mesh;
  };

  const renderMatrix = (matrix: THREE.Matrix4) => {
    const e = matrix.elements;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', color: '#00d4ff', fontFamily: "'Space Mono', monospace", fontSize: '11px', textAlign: 'right' }}>
        {[
          e[0], e[4], e[8], e[12],
          e[1], e[5], e[9], e[13],
          e[2], e[6], e[10], e[14],
          e[3], e[7], e[11], e[15]
        ].map((val, i) => (
          <div key={i}>{(val || 0).toFixed(4)}</div>
        ))}
      </div>
    );
  };

  const renderDerivation = (mesh: THREE.Mesh) => {
    const rx = mesh.rotation.x;
    const ry = mesh.rotation.y;
    const rz = mesh.rotation.z;
    const tx = mesh.position.x;
    const ty = mesh.position.y;
    const tz = mesh.position.z;
    const sx = mesh.scale.x;
    const sy = mesh.scale.y;
    const sz = mesh.scale.z;
    
    const hasRx = Math.abs(rx) > 0.001;
    const hasRy = Math.abs(ry) > 0.001;
    const hasRz = Math.abs(rz) > 0.001;
    
    const count = (hasRx ? 1 : 0) + (hasRy ? 1 : 0) + (hasRz ? 1 : 0);
    
    return (
      <div style={{ color: 'white', fontSize: '11px', fontFamily: "'Space Mono', monospace", display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {count > 1 && (
          <div>
            <div style={{ color: '#ffb300', marginBottom: '4px' }}>M = Rx · Ry · Rz</div>
            <div>(rotation order: XYZ)</div>
          </div>
        )}
        
        {hasRy && count <= 1 && (
          <div>
            <div style={{ color: '#ffb300', marginBottom: '4px' }}>ROTATION MATRIX (Y axis)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', textAlign: 'right', marginBottom: '8px' }}>
              <div>{Math.cos(ry).toFixed(4)}</div><div>0</div><div>{Math.sin(ry).toFixed(4)}</div><div>0</div>
              <div>0</div><div>1</div><div>0</div><div>0</div>
              <div>{(-Math.sin(ry)).toFixed(4)}</div><div>0</div><div>{Math.cos(ry).toFixed(4)}</div><div>0</div>
              <div>0</div><div>0</div><div>0</div><div>1</div>
            </div>
            <div>θ = {(ry * 180 / Math.PI).toFixed(2)}°</div>
            <div>cos(θ) = {Math.cos(ry).toFixed(4)}</div>
            <div>sin(θ) = {Math.sin(ry).toFixed(4)}</div>
          </div>
        )}
        
        {hasRx && count <= 1 && (
          <div>
            <div style={{ color: '#ffb300', marginBottom: '4px' }}>ROTATION MATRIX (X axis)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', textAlign: 'right', marginBottom: '8px' }}>
              <div>1</div><div>0</div><div>0</div><div>0</div>
              <div>0</div><div>{Math.cos(rx).toFixed(4)}</div><div>{(-Math.sin(rx)).toFixed(4)}</div><div>0</div>
              <div>0</div><div>{Math.sin(rx).toFixed(4)}</div><div>{Math.cos(rx).toFixed(4)}</div><div>0</div>
              <div>0</div><div>0</div><div>0</div><div>1</div>
            </div>
            <div>θ = {(rx * 180 / Math.PI).toFixed(2)}°</div>
            <div>cos(θ) = {Math.cos(rx).toFixed(4)}</div>
            <div>sin(θ) = {Math.sin(rx).toFixed(4)}</div>
          </div>
        )}

        {hasRz && count <= 1 && (
          <div>
            <div style={{ color: '#ffb300', marginBottom: '4px' }}>ROTATION MATRIX (Z axis)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', textAlign: 'right', marginBottom: '8px' }}>
              <div>{Math.cos(rz).toFixed(4)}</div><div>{(-Math.sin(rz)).toFixed(4)}</div><div>0</div><div>0</div>
              <div>{Math.sin(rz).toFixed(4)}</div><div>{Math.cos(rz).toFixed(4)}</div><div>0</div><div>0</div>
              <div>0</div><div>0</div><div>1</div><div>0</div>
              <div>0</div><div>0</div><div>0</div><div>1</div>
            </div>
            <div>θ = {(rz * 180 / Math.PI).toFixed(2)}°</div>
            <div>cos(θ) = {Math.cos(rz).toFixed(4)}</div>
            <div>sin(θ) = {Math.sin(rz).toFixed(4)}</div>
          </div>
        )}

        {(tx !== 0 || ty !== 0 || tz !== 0) && (
          <div>
            <div style={{ color: '#ffb300', marginBottom: '4px' }}>TRANSLATION</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', textAlign: 'right' }}>
              <div>1</div><div>0</div><div>0</div><div>{tx.toFixed(2)}</div>
              <div>0</div><div>1</div><div>0</div><div>{ty.toFixed(2)}</div>
              <div>0</div><div>0</div><div>1</div><div>{tz.toFixed(2)}</div>
              <div>0</div><div>0</div><div>0</div><div>1</div>
            </div>
          </div>
        )}

        {(sx !== 1 || sy !== 1 || sz !== 1) && (
          <div>
            <div style={{ color: '#ffb300', marginBottom: '4px' }}>SCALE</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', textAlign: 'right' }}>
              <div>{sx.toFixed(2)}</div><div>0</div><div>0</div><div>0</div>
              <div>0</div><div>{sy.toFixed(2)}</div><div>0</div><div>0</div>
              <div>0</div><div>0</div><div>{sz.toFixed(2)}</div><div>0</div>
              <div>0</div><div>0</div><div>0</div><div>1</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleTransformChange = (axis: 'x' | 'y' | 'z', type: 'position' | 'rotation' | 'scale', value: string) => {
    if (!selectedMesh) return;
    const num = parseFloat(value);
    if (isNaN(num)) return;
    
    if (type === 'position') {
      selectedMesh.position[axis] = num;
    } else if (type === 'rotation') {
      selectedMesh.rotation[axis] = num * Math.PI / 180;
    } else if (type === 'scale') {
      selectedMesh.scale[axis] = num;
    }
    
    selectedMesh.updateMatrix();
    selectedMesh.updateMatrixWorld(true);
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateRows: '44px 1fr 160px',
      gridTemplateColumns: '200px 1fr 280px',
      width: '100%',
      height: '100%',
      backgroundColor: '#111',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        gridColumn: '1 / -1',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        justifyContent: 'space-between',
        backgroundColor: '#1a1a1a'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {onBack && (
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}>
              ←
            </button>
          )}
          <div style={{ fontWeight: 'bold', fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase' }}>
            3D Workshop
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setTransformMode('translate')} 
            style={{ 
              background: transformMode === 'translate' ? '#333' : 'transparent',
              border: '1px solid #444', 
              color: '#fff', 
              padding: '4px 8px', 
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Move (G)
          </button>
          <button 
            onClick={() => setTransformMode('rotate')} 
            style={{ 
              background: transformMode === 'rotate' ? '#333' : 'transparent',
              border: '1px solid #444', 
              color: '#fff', 
              padding: '4px 8px', 
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Rotate (R)
          </button>
          <button 
            onClick={() => setTransformMode('scale')} 
            style={{ 
              background: transformMode === 'scale' ? '#333' : 'transparent',
              border: '1px solid #444', 
              color: '#fff', 
              padding: '4px 8px', 
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Scale (S)
          </button>
        </div>
      </div>

      {/* Outliner (Left Panel) */}
      <div style={{
        gridColumn: '1',
        borderRight: '1px solid #333',
        backgroundColor: '#1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto'
      }}>
        <div style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', padding: '12px 16px', color: '#888' }}>
          Scene Outliner
        </div>
        <div style={{ flex: 1 }}>
          {objects.map(obj => (
            <div 
              key={obj.id}
              onClick={() => setSelectedId(obj.id)}
              style={{
                padding: '8px 16px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: selectedId === obj.id ? '#4488ff22' : 'transparent',
                borderLeft: `2px solid ${selectedId === obj.id ? '#4488ff' : 'transparent'}`,
                fontSize: '13px'
              }}
            >
              <span>{obj.name}</span>
              {!obj.isLight && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (sceneRef.current) {
                      sceneRef.current.remove(obj.meshRef);
                      if (obj.meshRef instanceof THREE.Mesh) {
                        obj.meshRef.geometry.dispose();
                        if (Array.isArray(obj.meshRef.material)) {
                          obj.meshRef.material.forEach(m => m.dispose());
                        } else {
                          obj.meshRef.material.dispose();
                        }
                      }
                    }
                    setObjects(prev => prev.filter(o => o.id !== obj.id));
                    if (selectedId === obj.id) setSelectedId(null);
                  }}
                  style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '0' }}
                >
                  🗑
                </button>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: '16px', position: 'relative' }}>
          <button 
            onClick={() => setShowAddMenu(!showAddMenu)}
            style={{ width: '100%', padding: '8px', background: '#333', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
          >
            + Add
          </button>
          {showAddMenu && (
            <div style={{ position: 'absolute', bottom: '100%', left: '16px', right: '16px', marginBottom: '8px', background: '#222', border: '1px solid #444', borderRadius: '4px', overflow: 'hidden' }}>
              {['Box', 'Sphere', 'Cylinder', 'Cone', 'Torus'].map(type => (
                <div 
                  key={type}
                  onClick={() => handleAddObject(type)}
                  style={{ padding: '8px 16px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #333' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {type}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3D Viewport (Center) */}
      <div ref={containerRef} style={{ gridColumn: '2', position: 'relative', overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      {/* Inspector (Right Panel) */}
      <div style={{
        gridColumn: '3',
        borderLeft: '1px solid #333',
        backgroundColor: '#1a1a1a',
        overflowY: 'auto'
      }}>
        {!selectedMesh ? (
          <div style={{ padding: '24px', color: '#888', textAlign: 'center', fontSize: '13px' }}>
            Select an object to inspect
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* Transform Section */}
            <div style={{ padding: '16px', backgroundColor: '#222' }}>
              <div style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#888', marginBottom: '12px' }}>
                Transform
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', fontFamily: "'Space Mono', monospace" }}>
                  <span style={{ width: '60px', color: '#aaa' }}>Position</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    X <input type="number" step="0.1" value={selectedMesh.position.x.toFixed(2)} onChange={e => handleTransformChange('x', 'position', e.target.value)} style={{ width: '48px', background: '#111', color: '#fff', border: '1px solid #333', padding: '2px 4px', fontFamily: "'Space Mono', monospace", fontSize: '11px' }} />
                    Y <input type="number" step="0.1" value={selectedMesh.position.y.toFixed(2)} onChange={e => handleTransformChange('y', 'position', e.target.value)} style={{ width: '48px', background: '#111', color: '#fff', border: '1px solid #333', padding: '2px 4px', fontFamily: "'Space Mono', monospace", fontSize: '11px' }} />
                    Z <input type="number" step="0.1" value={selectedMesh.position.z.toFixed(2)} onChange={e => handleTransformChange('z', 'position', e.target.value)} style={{ width: '48px', background: '#111', color: '#fff', border: '1px solid #333', padding: '2px 4px', fontFamily: "'Space Mono', monospace", fontSize: '11px' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', fontFamily: "'Space Mono', monospace" }}>
                  <span style={{ width: '60px', color: '#aaa' }}>Rotation</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    X <input type="number" step="1" value={(selectedMesh.rotation.x * 180 / Math.PI).toFixed(0)} onChange={e => handleTransformChange('x', 'rotation', e.target.value)} style={{ width: '48px', background: '#111', color: '#fff', border: '1px solid #333', padding: '2px 4px', fontFamily: "'Space Mono', monospace", fontSize: '11px' }} />
                    Y <input type="number" step="1" value={(selectedMesh.rotation.y * 180 / Math.PI).toFixed(0)} onChange={e => handleTransformChange('y', 'rotation', e.target.value)} style={{ width: '48px', background: '#111', color: '#fff', border: '1px solid #333', padding: '2px 4px', fontFamily: "'Space Mono', monospace", fontSize: '11px' }} />
                    Z <input type="number" step="1" value={(selectedMesh.rotation.z * 180 / Math.PI).toFixed(0)} onChange={e => handleTransformChange('z', 'rotation', e.target.value)} style={{ width: '48px', background: '#111', color: '#fff', border: '1px solid #333', padding: '2px 4px', fontFamily: "'Space Mono', monospace", fontSize: '11px' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', fontFamily: "'Space Mono', monospace" }}>
                  <span style={{ width: '60px', color: '#aaa' }}>Scale</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    X <input type="number" step="0.1" value={selectedMesh.scale.x.toFixed(2)} onChange={e => handleTransformChange('x', 'scale', e.target.value)} style={{ width: '48px', background: '#111', color: '#fff', border: '1px solid #333', padding: '2px 4px', fontFamily: "'Space Mono', monospace", fontSize: '11px' }} />
                    Y <input type="number" step="0.1" value={selectedMesh.scale.y.toFixed(2)} onChange={e => handleTransformChange('y', 'scale', e.target.value)} style={{ width: '48px', background: '#111', color: '#fff', border: '1px solid #333', padding: '2px 4px', fontFamily: "'Space Mono', monospace", fontSize: '11px' }} />
                    Z <input type="number" step="0.1" value={selectedMesh.scale.z.toFixed(2)} onChange={e => handleTransformChange('z', 'scale', e.target.value)} style={{ width: '48px', background: '#111', color: '#fff', border: '1px solid #333', padding: '2px 4px', fontFamily: "'Space Mono', monospace", fontSize: '11px' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Matrix Section */}
            <div style={{ backgroundColor: '#222' }}>
              <div 
                onClick={() => toggleSection('matrix')}
                style={{ padding: '12px 16px', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#888', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
              >
                <span>World Matrix</span>
                <span>{collapsedSections.matrix ? '▶' : '▼'}</span>
              </div>
              {!collapsedSections.matrix && (
                <div style={{ padding: '0 16px 16px 16px' }}>
                  {(() => {
                    selectedMesh.updateMatrixWorld(true);
                    return renderMatrix(selectedMesh.matrixWorld);
                  })()}
                </div>
              )}
            </div>

            {/* Derivation Section */}
            <div style={{ backgroundColor: '#222' }}>
              <div 
                onClick={() => toggleSection('derivation')}
                style={{ padding: '12px 16px', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#888', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
              >
                <span>Derivation</span>
                <span>{collapsedSections.derivation ? '▶' : '▼'}</span>
              </div>
              {!collapsedSections.derivation && (
                <div style={{ padding: '0 16px 16px 16px' }}>
                  {renderDerivation(selectedMesh)}
                </div>
              )}
            </div>

            {/* Geometry Section */}
            <div style={{ backgroundColor: '#222' }}>
              <div 
                onClick={() => toggleSection('geometry')}
                style={{ padding: '12px 16px', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#888', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
              >
                <span>Geometry</span>
                <span>{collapsedSections.geometry ? '▶' : '▼'}</span>
              </div>
              {!collapsedSections.geometry && selectedMesh.geometry && (
                <div style={{ padding: '0 16px 16px 16px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>Type: {selectedMesh.geometry.type}</div>
                  <div>Vertices: {selectedMesh.geometry.attributes.position.count}</div>
                  <div>Triangles: {selectedMesh.geometry.index ? Math.floor(selectedMesh.geometry.index.count / 3) : Math.floor(selectedMesh.geometry.attributes.position.count / 3)}</div>
                </div>
              )}
            </div>

            {/* Material Section */}
            <div style={{ backgroundColor: '#222' }}>
              <div 
                onClick={() => toggleSection('material')}
                style={{ padding: '12px 16px', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#888', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
              >
                <span>Material</span>
                <span>{collapsedSections.material ? '▶' : '▼'}</span>
              </div>
              {!collapsedSections.material && selectedMesh.material && (
                <div style={{ padding: '0 16px 16px 16px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(() => {
                    const mat = Array.isArray(selectedMesh.material) ? selectedMesh.material[0] : selectedMesh.material;
                    return (
                      <>
                        <div>Type: {mat.type}</div>
                        {'color' in mat && <div>Color: #{(mat as any).color.getHexString()}</div>}
                        {'roughness' in mat && <div>Roughness: {(mat as any).roughness.toFixed(2)}</div>}
                        {'metalness' in mat && <div>Metalness: {(mat as any).metalness.toFixed(2)}</div>}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Console (Bottom Panel) */}
      <div style={{
        gridColumn: '1 / -1',
        borderTop: '1px solid #333',
        backgroundColor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Space Mono', monospace",
        fontSize: '12px'
      }}>
        <div style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', padding: '8px 16px', color: '#888', borderBottom: '1px solid #222' }}>
          Console
        </div>
        
        <div style={{ flex: 1, padding: '8px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {consoleHistory.slice(-8).map((hist, i) => (
            <div key={i}>
              {hist.input && <div style={{ color: '#aaa' }}>{hist.input}</div>}
              {hist.output && <div style={{ color: hist.isError ? '#ff4444' : '#fff' }}>{hist.output}</div>}
            </div>
          ))}
          <div ref={consoleBottomRef} />
        </div>
        
        <form onSubmit={handleConsoleSubmit} style={{ display: 'flex', padding: '8px 16px', borderTop: '1px solid #222', alignItems: 'center' }}>
          <span style={{ color: '#4488ff', marginRight: '8px' }}>{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            value={consoleInput}
            onChange={e => setConsoleInput(e.target.value)}
            onKeyDown={handleConsoleKeyDown}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              outline: 'none',
              fontFamily: "'Space Mono', monospace",
              fontSize: '12px'
            }}
            placeholder="scene.background = new THREE.Color('red')"
          />
        </form>
      </div>

    </div>
  );
}
