import React, { useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
import * as THREE from "three";
import { X, Box, Layers, Settings2, Trash2, Plus, Info, Activity } from "lucide-react";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useThemeColors } from "../../hooks/useThemeColors.js";

// ── Color maps ────────────────────────────────────────────────────────────────
const COLOR_MAPS = {
  parula:  ["#352a87", "#0f5cdd", "#00b5a6", "#7fd34e", "#f5e663"],
  jet:     ["#00007f", "#0055ff", "#00d4ff", "#ffe600", "#ff5500", "#7f0000"],
  viridis: ["#440154", "#414487", "#2a788e", "#22a884", "#7ad151", "#fde725"],
  hot:     ["#200000", "#7f0000", "#ff5500", "#ffd200", "#ffffcc"],
  cool:    ["#00ffff", "#00a0ff", "#0040ff", "#8000ff", "#ff00ff"],
  gray:    ["#000000", "#404040", "#808080", "#c0c0c0", "#ffffff"],
  hsv:     ["#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ff0000"],
  spring:  ["#ff00ff", "#ff4dbf", "#ff9980", "#ffdb40", "#ffff00"],
  summer:  ["#008066", "#40a640", "#80cc00", "#c0e600", "#ffff66"],
  autumn:  ["#ff0000", "#ff4000", "#ff8000", "#ffbf00", "#ffff00"],
  winter:  ["#0000ff", "#0040df", "#0080bf", "#00bfbf", "#00ff80"],
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));

const sampleColorMap = (name = "parula", t = 0) => {
  const palette = COLOR_MAPS[String(name).toLowerCase()] || COLOR_MAPS.parula;
  const n = clamp01(t);
  if (palette.length === 1) return new THREE.Color(palette[0]);
  const scaled = n * (palette.length - 1);
  const idx = Math.floor(scaled);
  const lt = scaled - idx;
  return new THREE.Color(palette[idx]).lerp(new THREE.Color(palette[Math.min(idx + 1, palette.length - 1)]), lt);
};

const valuesToColorBuffer = (values = [], range, colorMap = "parula") => {
  const min = range?.[0] ?? Math.min(...values);
  const max = range?.[1] ?? Math.max(...values);
  const span = max - min || 1;
  const buf = new Float32Array(values.length * 3);
  values.forEach((v, i) => {
    const c = sampleColorMap(colorMap, (Number(v) - min) / span);
    buf[i * 3] = c.r; buf[i * 3 + 1] = c.g; buf[i * 3 + 2] = c.b;
  });
  return buf;
};

// ── Nice axis ticks ───────────────────────────────────────────────────────────
function niceTicks(min, max, count = 5) {
  const span = max - min;
  if (span === 0) return [min];
  const rough = span / (count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const nice = [1, 2, 2.5, 5, 10].find((f) => f * mag >= rough) * mag;
  const start = Math.ceil(min / nice) * nice;
  const ticks = [];
  for (let v = start; v <= max + nice * 0.01; v += nice) {
    ticks.push(parseFloat(v.toPrecision(6)));
    if (ticks.length >= count + 1) break;
  }
  return ticks.filter((t) => t >= min - nice * 0.01 && t <= max + nice * 0.01);
}

const fmtNum = (v) => {
  const n = Number(v);
  if (!isFinite(n)) return "";
  if (Math.abs(n) >= 1000 || (Math.abs(n) < 0.01 && n !== 0)) return n.toExponential(1);
  return parseFloat(n.toPrecision(4)).toString();
};

// ── Box frame with tick labels ────────────────────────────────────────────────
const BoxFrame = ({ xlim, ylim, zlim, xlabel, ylabel, zlabel, isDark }) => {
  const [xMin, xMax] = xlim;
  const [yMin, yMax] = ylim;
  const [zMin, zMax] = zlim;
  const edgeColor  = isDark ? "#3b5278" : "#8aadda";
  const gridColor  = isDark ? "#1d2e48" : "#c8daf0";
  const tickColor  = isDark ? "#8ab4e0" : "#4a6fa5";
  const labelColor = isDark ? "#e2eaf8" : "#1a3055";
  const titleFs    = 0.38;

  // 12 edges of the bounding box (Three.js: Y=up, Z=depth)
  const edges = [
    [[xMin, zMin, yMin], [xMax, zMin, yMin]],
    [[xMin, zMax, yMin], [xMax, zMax, yMin]],
    [[xMin, zMin, yMax], [xMax, zMin, yMax]],
    [[xMin, zMax, yMax], [xMax, zMax, yMax]],
    [[xMin, zMin, yMin], [xMin, zMax, yMin]],
    [[xMax, zMin, yMin], [xMax, zMax, yMin]],
    [[xMin, zMin, yMax], [xMin, zMax, yMax]],
    [[xMax, zMin, yMax], [xMax, zMax, yMax]],
    [[xMin, zMin, yMin], [xMin, zMin, yMax]],
    [[xMax, zMin, yMin], [xMax, zMin, yMax]],
    [[xMin, zMax, yMin], [xMin, zMax, yMax]],
    [[xMax, zMax, yMin], [xMax, zMax, yMax]],
  ];

  // Grid planes (3 walls of the MATLAB-style box)
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;
  const zSpan = zMax - zMin || 1;

  const xTicks = niceTicks(xMin, xMax);
  const yTicks = niceTicks(yMin, yMax);
  const zTicks = niceTicks(zMin, zMax);

  // Grid lines on bottom (Z = zMin), back-y (yMin), and back-x (xMax) walls
  const bottomGridX = xTicks.map((tx) => [[tx, zMin, yMin], [tx, zMin, yMax]]);
  const bottomGridY = yTicks.map((ty) => [[xMin, zMin, ty], [xMax, zMin, ty]]);
  const backYGridX  = xTicks.map((tx) => [[tx, zMin, yMin], [tx, zMax, yMin]]);
  const backYGridZ  = zTicks.map((tz) => [[xMin, tz, yMin], [xMax, tz, yMin]]);
  const backXGridY  = yTicks.map((ty) => [[xMax, zMin, ty], [xMax, zMax, ty]]);
  const backXGridZ  = zTicks.map((tz) => [[xMax, tz, yMin], [xMax, tz, yMax]]);

  const tickOffset = 0.06 * Math.max(xSpan, ySpan, zSpan) * 0.15 + 0.25;
  const fs = Math.max(0.18, Math.min(0.38, Math.max(xSpan, ySpan, zSpan) * 0.03));

  return (
    <group>
      {/* Box edges */}
      {edges.map((pts, i) => (
        <Line key={i} points={pts} color={edgeColor} lineWidth={1.2} transparent opacity={0.9} />
      ))}

      {/* Bottom grid */}
      {[...bottomGridX, ...bottomGridY].map((pts, i) => (
        <Line key={`bg${i}`} points={pts} color={gridColor} lineWidth={0.5} transparent opacity={0.7} />
      ))}

      {/* Back-Y wall grid */}
      {[...backYGridX, ...backYGridZ].map((pts, i) => (
        <Line key={`byg${i}`} points={pts} color={gridColor} lineWidth={0.5} transparent opacity={0.55} />
      ))}

      {/* Back-X wall grid */}
      {[...backXGridY, ...backXGridZ].map((pts, i) => (
        <Line key={`bxg${i}`} points={pts} color={gridColor} lineWidth={0.5} transparent opacity={0.55} />
      ))}

      {/* X axis tick labels (bottom front edge) */}
      {xTicks.map((tx) => (
        <Text key={`xt${tx}`} position={[tx, zMin - tickOffset * 0.6, yMax + tickOffset]}
          fontSize={fs} color={tickColor} anchorX="center" anchorY="top">
          {fmtNum(tx)}
        </Text>
      ))}

      {/* Y axis tick labels (bottom right edge) */}
      {yTicks.map((ty) => (
        <Text key={`yt${ty}`} position={[xMax + tickOffset, zMin - tickOffset * 0.6, ty]}
          fontSize={fs} color={tickColor} anchorX="left" anchorY="top">
          {fmtNum(ty)}
        </Text>
      ))}

      {/* Z axis tick labels (left back edge) */}
      {zTicks.map((tz) => (
        <Text key={`zt${tz}`} position={[xMin - tickOffset, tz, yMin - tickOffset * 0.3]}
          fontSize={fs} color={tickColor} anchorX="right" anchorY="middle">
          {fmtNum(tz)}
        </Text>
      ))}

      {/* Axis labels */}
      <Text position={[(xMin + xMax) / 2, zMin - tickOffset * 1.6, yMax + tickOffset * 1.8]}
        fontSize={titleFs} color={labelColor} fontWeight="bold" anchorX="center">
        {xlabel || "X"}
      </Text>
      <Text position={[xMax + tickOffset * 2.2, zMin - tickOffset * 1.6, (yMin + yMax) / 2]}
        fontSize={titleFs} color={labelColor} fontWeight="bold" anchorX="left">
        {ylabel || "Y"}
      </Text>
      <Text position={[xMin - tickOffset * 2.4, (zMin + zMax) / 2, yMin - tickOffset * 0.3]}
        fontSize={titleFs} color={labelColor} fontWeight="bold" anchorX="right" anchorY="middle">
        {zlabel || "Z"}
      </Text>
    </group>
  );
};

// ── Surface geometry builder ──────────────────────────────────────────────────
function buildSurfaceGeo(surfaceData, colorMap, colorRange, flatShading) {
  const { X, Y, Z } = surfaceData;
  const rows = Z.length;
  const cols = rows ? Z[0].length : 0;
  if (!rows || !cols) return null;

  const geo = new THREE.PlaneGeometry(1, 1, Math.max(cols - 1, 1), Math.max(rows - 1, 1));
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;

  const zFlat = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const xv = X?.[r]?.[c] ?? c;
      const yv = Y?.[r]?.[c] ?? r;
      let zv = Number(Z?.[r]?.[c] ?? 0);
      if (!isFinite(zv)) zv = 0;
      pos.setX(idx, xv);
      pos.setZ(idx, yv);
      pos.setY(idx, zv);
      zFlat.push(zv);
    }
  }
  pos.needsUpdate = true;

  const [zMin, zMax] = colorRange ?? [Math.min(...zFlat), Math.max(...zFlat)];
  const colors = valuesToColorBuffer(zFlat, [zMin, zMax], colorMap);
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  if (flatShading) geo.computeVertexNormals();
  else geo.computeVertexNormals();

  return geo;
}

// ── Mesh (wireframe) geometry builder ─────────────────────────────────────────
function buildMeshLines(surfaceData, color) {
  const { X, Y, Z } = surfaceData;
  const rows = Z.length;
  const cols = rows ? Z[0].length : 0;
  const lines = [];
  // Row lines
  for (let r = 0; r < rows; r++) {
    const pts = [];
    for (let c = 0; c < cols; c++) {
      const xv = X?.[r]?.[c] ?? c;
      const yv = Y?.[r]?.[c] ?? r;
      let zv = Number(Z?.[r]?.[c] ?? 0);
      if (!isFinite(zv)) zv = 0;
      pts.push([xv, zv, yv]); // Three.js Y-up convention
    }
    if (pts.length >= 2) lines.push(pts);
  }
  // Column lines
  for (let c = 0; c < cols; c++) {
    const pts = [];
    for (let r = 0; r < rows; r++) {
      const xv = X?.[r]?.[c] ?? c;
      const yv = Y?.[r]?.[c] ?? r;
      let zv = Number(Z?.[r]?.[c] ?? 0);
      if (!isFinite(zv)) zv = 0;
      pts.push([xv, zv, yv]);
    }
    if (pts.length >= 2) lines.push(pts);
  }
  return lines;
}

// ── 3D function renderer ──────────────────────────────────────────────────────
const OpenMatFunction3D = ({ fn, settings }) => {
  const flatShading = settings.flatShading !== false;
  // settings.colormapOverride means the user explicitly picked a colormap in the
  // Render Settings panel — that takes priority over the per-function default.
  const colorMap = (settings.colormapOverride ? settings.colormap : null)
    || fn.colorMap
    || settings.colormap
    || "parula";
  const size = settings.range || 10;
  const segs = settings.resolution || 64;

  // All useMemo calls MUST be at the top (React Rules of Hooks — no early returns before this block)
  const surfaceGeo = useMemo(() => {
    if (!fn.surfaceData?.Z) return null;
    return buildSurfaceGeo(fn.surfaceData, colorMap, fn.colorRange, flatShading);
  }, [fn.surfaceData, colorMap, fn.colorRange, flatShading]);

  const meshLines = useMemo(() => {
    if ((fn.plotType !== "mesh" && !fn.wireframe) || !fn.surfaceData?.Z) return [];
    return buildMeshLines(fn.surfaceData, fn.color);
  }, [fn.surfaceData, fn.plotType, fn.wireframe, fn.color]);

  const linePoints = useMemo(() => {
    if (fn.plotType !== "line3") return [];
    const { xs = [], ys = [], zs = [] } = fn;
    const count = Math.min(xs.length, ys.length, zs.length);
    return Array.from({ length: count }, (_, i) => [xs[i] ?? 0, zs[i] ?? 0, ys[i] ?? 0]);
  }, [fn.plotType, fn.xs, fn.ys, fn.zs]);

  const scatterGeo = useMemo(() => {
    if (fn.plotType !== "scatter3") return null;
    const { xs = [], ys = [], zs = [] } = fn;
    const count = Math.min(xs.length, ys.length, zs.length);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = xs[i] ?? 0;
      positions[i * 3 + 1] = zs[i] ?? 0;
      positions[i * 3 + 2] = ys[i] ?? 0;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    if (fn.colorValues?.length) {
      const cv = fn.colorValues.slice(0, count).map(Number);
      geo.setAttribute("color", new THREE.BufferAttribute(valuesToColorBuffer(cv, fn.colorRange, colorMap), 3));
    }
    return geo;
  }, [fn.plotType, fn.xs, fn.ys, fn.zs, fn.colorValues, fn.colorRange, colorMap]);

  // Latex expression surface (fallback formula mode — built only when no surfaceData)
  const latexGeo = useMemo(() => {
    if (fn.surfaceData?.Z || fn.plotType === "line3" || fn.plotType === "scatter3") return null;
    const g = new THREE.PlaneGeometry(size, size, segs, segs);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let z = 0;
      try {
        const expr = (fn.latex || "0")
          .replace(/sin/g, "Math.sin").replace(/cos/g, "Math.cos")
          .replace(/tan/g, "Math.tan").replace(/exp/g, "Math.exp")
          .replace(/sqrt/g, "Math.sqrt").replace(/abs/g, "Math.abs")
          .replace(/log/g, "Math.log").replace(/\^/g, "**").replace(/pi/g, "Math.PI");
        const evalFn = new Function("x", "y", `return ${expr}`);
        z = evalFn(p.getX(i), p.getZ(i));
        if (!isFinite(z)) z = 0;
      } catch { z = 0; }
      p.setY(i, z);
    }
    g.computeVertexNormals();
    return g;
  }, [fn.latex, fn.surfaceData, fn.plotType, size, segs]);

  // ── Early visibility guard (after all hooks) ──
  if (!fn.visible) return null;

  // mesh: wireframe grid lines only
  if (fn.plotType === "mesh" || (fn.wireframe && fn.surfaceData?.Z)) {
    return (
      <group>
        {meshLines.map((pts, i) => (
          <Line key={i} points={pts} color={fn.color || "#4d7cff"} lineWidth={1.4} transparent opacity={fn.opacity ?? 1} />
        ))}
      </group>
    );
  }

  // surf: colored solid surface
  if ((fn.plotType === "surf" || fn.surfaceData?.Z) && surfaceGeo) {
    return (
      <group>
        <mesh geometry={surfaceGeo}>
          <meshStandardMaterial
            side={THREE.DoubleSide}
            vertexColors
            transparent
            opacity={fn.opacity ?? 0.9}
            roughness={0.45}
            metalness={0.08}
          />
        </mesh>
        {/* Thin edge lines (subtle, like MATLAB surf) */}
        {!fn.wireframe && (
          <mesh geometry={surfaceGeo}>
            <meshBasicMaterial color="#000000" wireframe transparent opacity={0.06} />
          </mesh>
        )}
      </group>
    );
  }

  // 3D line
  if (fn.plotType === "line3" && linePoints.length >= 2) {
    return <Line points={linePoints} color={fn.color || "#22c55e"} lineWidth={2.5} transparent opacity={fn.opacity ?? 1} />;
  }

  // scatter3
  if (fn.plotType === "scatter3" && scatterGeo) {
    const hasVertexColors = !!scatterGeo.getAttribute("color");
    return (
      <points geometry={scatterGeo}>
        <pointsMaterial
          color={fn.color}
          size={fn.pointSize ?? 0.14}
          transparent
          opacity={fn.opacity ?? 0.95}
          sizeAttenuation
          vertexColors={hasVertexColors}
        />
      </points>
    );
  }

  // Fallback: latex expression surface
  if (latexGeo) {
    return (
      <mesh geometry={latexGeo}>
        <meshStandardMaterial color={fn.color || "#6366f1"} side={THREE.DoubleSide}
          wireframe={fn.wireframe} transparent opacity={fn.opacity ?? 0.88}
          roughness={0.4} metalness={0.06} />
      </mesh>
    );
  }

  return null;
};

// ── Camera controller (MATLAB default: az=-37.5, el=30) ──────────────────────
const CameraController = ({ view, bounds }) => {
  const { camera } = useThree();
  const bounds_key = JSON.stringify(bounds);
  useEffect(() => {
    const xl = bounds.xlim || [-6, 6];
    const yl = bounds.ylim || [-6, 6];
    const zl = bounds.zlim || [-6, 6];
    const center = new THREE.Vector3(
      (xl[0] + xl[1]) / 2,
      (zl[0] + zl[1]) / 2, // Three.js Y = MATLAB Z
      (yl[0] + yl[1]) / 2,
    );
    const span = Math.max(xl[1] - xl[0], yl[1] - yl[0], zl[1] - zl[0], 4);
    let az, el;
    if (Array.isArray(view) && view.length >= 2) {
      az = THREE.MathUtils.degToRad(Number(view[0]));
      el = THREE.MathUtils.degToRad(Number(view[1]));
    } else if (String(view) === "2") {
      // Top-down (xy plane)
      az = 0; el = THREE.MathUtils.degToRad(90);
    } else if (String(view) === "front") {
      az = 0; el = THREE.MathUtils.degToRad(0);
    } else if (String(view) === "side") {
      az = THREE.MathUtils.degToRad(90); el = 0;
    } else {
      // MATLAB default: view(-37.5, 30)
      az = THREE.MathUtils.degToRad(-37.5);
      el = THREE.MathUtils.degToRad(30);
    }
    const r = span * 1.6;
    const pos = new THREE.Vector3(
      center.x + r * Math.cos(el) * Math.sin(az),
      center.y + r * Math.sin(el),
      center.z + r * Math.cos(el) * Math.cos(az),
    );
    camera.position.copy(pos);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }, [bounds_key, view]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

// ── Full scene ────────────────────────────────────────────────────────────────
const OpenMatScene = ({ functions, settings }) => {
  const xl = settings.xlim || [-6, 6];
  const yl = settings.ylim || [-6, 6];
  const zl = settings.zlim || [-6, 6];
  const cx = (xl[0] + xl[1]) / 2;
  const cy = (yl[0] + yl[1]) / 2;
  const cz = (zl[0] + zl[1]) / 2;
  const span = Math.max(xl[1] - xl[0], yl[1] - yl[0], zl[1] - zl[0], 4);

  const titleFs  = Math.max(0.3, Math.min(0.55, span * 0.045));

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[span, span * 1.5, span * 0.8]} intensity={1.05} castShadow={false} />
      <directionalLight position={[-span * 0.6, span * 0.4, -span * 0.4]} intensity={0.3} />
      <CameraController view={settings.view} bounds={{ xlim: xl, ylim: yl, zlim: zl }} />
      <OrbitControls
        makeDefault
        dampingFactor={0.08}
        target={[cx, cz, cy]}   /* Three.js Y = MATLAB Z */
        autoRotate={settings.autoRotate}
        autoRotateSpeed={0.5}
      />

      {settings.showGrid !== false && (
        <BoxFrame
          xlim={xl} ylim={yl} zlim={zl}
          xlabel={settings.xlabel} ylabel={settings.ylabel} zlabel={settings.zlabel}
          isDark={settings.isDark}
        />
      )}

      {functions.map((fn) => (
        <OpenMatFunction3D key={fn.id} fn={fn} settings={settings} />
      ))}

      {/* Plot title */}
      {settings.title && (
        <Text
          position={[cx, zl[1] + titleFs * 2.4, cy]}
          fontSize={titleFs}
          color={settings.isDark ? "#e8f0ff" : "#1a2b4a"}
          fontWeight="bold"
          anchorX="center"
        >
          {settings.title}
        </Text>
      )}
    </>
  );
};

// ── Colorbar overlay ──────────────────────────────────────────────────────────
const Colorbar = ({ colorMap, range }) => {
  const [zMin, zMax] = range;
  const palette = COLOR_MAPS[colorMap] || COLOR_MAPS.parula;
  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-3 shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/90">
      <div
        className="h-28 w-3.5 rounded"
        style={{ background: `linear-gradient(to top, ${palette.join(", ")})` }}
      />
      <div className="flex h-28 flex-col justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
        <span>{fmtNum(zMax)}</span>
        <span className="text-[9px] uppercase tracking-widest text-slate-400">{colorMap}</span>
        <span>{fmtNum(zMin)}</span>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
function readCanvasBg(isDark) {
  const varName = isDark ? '--tw-custom-slate-900' : '--tw-custom-slate-50';
  const channels = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  if (!channels) return isDark ? '#0f172a' : '#f8fafc';
  const parts = channels.split(' ').map(Number);
  if (parts.length === 3 && parts.every(n => !isNaN(n))) return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
  return isDark ? '#0f172a' : '#f8fafc';
}

const OpenMatGrapher3D = ({ isOpen, onClose, onSwitchTo2D, onSwitchToJSX, launchConfig, embedded = false }) => {
  const C = useThemeColors();
  const [canvasBg, setCanvasBg] = useState(() => readCanvasBg(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  ));

  useEffect(() => {
    function update() { setCanvasBg(readCanvasBg(C.isDark)); }
    update();
    const el = document.getElementById('oc-dynamic-theme-styles');
    if (!el) return;
    const obs = new MutationObserver(update);
    obs.observe(el, { characterData: true, childList: true, subtree: true });
    return () => obs.disconnect();
  }, [C.isDark]);
  const [functions, setFunctions] = useLocalStorage("openmat-grapher-3d-funcs", [
    { id: 1, latex: "sin(x) * cos(y)", color: "#6366f1", visible: true, plotType: "surf", wireframe: false, opacity: 0.9 },
  ]);
  const [activePanel, setActivePanel] = useState(null);
  const [settings, setSettings] = useLocalStorage("openmat-grapher-3d-settings", {
    showGrid: true,
    range: 12,
    resolution: 64,
    autoRotate: false,
    colormap: "parula",
    flatShading: true,
  });
  const lastSigRef = useRef("");

  // Apply launchConfig from engine
  useEffect(() => {
    if (!isOpen || !launchConfig) return;
    const sig = JSON.stringify({
      functions: launchConfig.functions || [],
      settings:  launchConfig.settings  || {},
      replace:   launchConfig.replace   !== false,
      title:     launchConfig.title     || "",
    });
    if (lastSigRef.current === sig) return;
    lastSigRef.current = sig;

    if (Array.isArray(launchConfig.functions) && launchConfig.functions.length) {
      const next = launchConfig.functions.map((fn, i) => ({
        id:          fn.id ?? Date.now() + i,
        latex:       fn.latex || fn.expr || fn.label || "surface",
        color:       fn.color || "#6366f1",
        visible:     fn.visible !== false,
        plotType:    fn.plotType ?? null,
        wireframe:   !!fn.wireframe,
        opacity:     fn.opacity ?? 0.9,
        surfaceData: fn.surfaceData ?? null,
        xs: fn.xs ?? [], ys: fn.ys ?? [], zs: fn.zs ?? [],
        pointSize:   fn.pointSize   ?? 0.14,
        pointSizes:  fn.pointSizes  ?? [],
        colorValues: fn.colorValues ?? [],
        colorMap:    fn.colorMap    ?? launchConfig.settings?.colormap ?? "parula",
        colorRange:  fn.colorRange  ?? null,
        filled:      !!fn.filled,
      }));
      setFunctions((cur) => (launchConfig.replace === false ? [...cur, ...next] : next));
    }
    if (launchConfig.settings) {
      setSettings((cur) => ({ ...cur, ...launchConfig.settings }));
    }
  }, [isOpen, launchConfig, setFunctions, setSettings]);

  if (!isOpen) return null;

  const addFunction = () => {
    const colors = ["#6366f1","#22c55e","#f97316","#ef4444","#06b6d4","#a855f7"];
    setFunctions([...functions, {
      id: Date.now(), latex: "x*y/5", color: colors[functions.length % colors.length],
      visible: true, plotType: null, wireframe: false, opacity: 0.9,
    }]);
  };

  const updateFn  = (id, upd) => setFunctions(functions.map((f) => (f.id === id ? { ...f, ...upd } : f)));
  const removeFn  = (id) => {
    const next = functions.filter((f) => f.id !== id);
    setFunctions(next.length ? next : [{ id: Date.now(), latex: "surface", color: "#6366f1", visible: true, wireframe: false, opacity: 0.9 }]);
  };
  const setSetting = (k, v) => setSettings((p) => ({
    ...p,
    [k]: v,
    // Track that the user has explicitly chosen a colormap so it overrides per-function defaults
    ...(k === "colormap" ? { colormapOverride: true } : {}),
  }));

  // Colorbar info: use the first function that has a colorRange
  const colorbarFn = functions.find((fn) =>
    fn.surfaceData?.Z && Array.isArray(fn.colorRange) && fn.colorRange.length >= 2
  );
  const showColorbar = settings.colorbar !== false && colorbarFn;

  const xl = settings.xlim || [-6, 6];
  const yl = settings.ylim || [-6, 6];
  const zl = settings.zlim || [-6, 6];

  const panels = [
    { id: "objects", label: `Objects (${functions.length})`, icon: Layers },
    { id: "appearance", label: "Appearance", icon: Settings2 },
    { id: "view", label: "View & Help", icon: Info },
  ];

  return (
    <div className={embedded
      ? "h-full w-full overflow-hidden"
      : "fixed inset-0 z-[1800] overflow-hidden bg-slate-900/80 backdrop-blur-xl sm:flex sm:items-center sm:justify-center sm:p-4"
    }>
      <div className={embedded
        ? "flex h-full w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        : "flex h-full w-full flex-col overflow-hidden rounded-none bg-white shadow-2xl dark:bg-slate-900 sm:h-[92vh] sm:max-w-7xl sm:rounded-3xl sm:border sm:border-slate-200 dark:sm:border-slate-800"
      }>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex min-w-0 items-center gap-2 truncate text-sm font-bold text-slate-800 dark:text-slate-100">
            <Box className="h-4 w-4 shrink-0 text-indigo-500" />
            {launchConfig?.title || "OpenMAT 3D"}
          </h3>
          <div className="flex items-center gap-1">
            {typeof onSwitchTo2D === "function" && <button onClick={onSwitchTo2D} title="Switch to 2D" className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/40"><Activity className="h-4 w-4" /></button>}
            {typeof onSwitchToJSX === "function" && <button onClick={onSwitchToJSX} title="Open JSXGraph Pro" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/40"><Settings2 className="h-4 w-4" /></button>}
            {!embedded && onClose && <button onClick={onClose} title="Close 3D viewer" className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/40"><X className="h-4 w-4" /></button>}
          </div>
        </div>

        <div className="relative min-h-0 flex-1" style={{ background: canvasBg }}>
          <Canvas camera={{ position: [10, 8, 10], fov: 40 }}>
            <color attach="background" args={[canvasBg]} />
            <OpenMatScene functions={functions} settings={{ ...settings, isDark: C.isDark }} />
          </Canvas>
          {showColorbar && <div className="pointer-events-none absolute right-3 top-3"><Colorbar colorMap={(settings.colormapOverride ? settings.colormap : null) || colorbarFn.colorMap || settings.colormap || "parula"} range={colorbarFn.colorRange} /></div>}
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {[["X","#e84040"],["Y","#22c55e"],["Z","#4d7cff"]].map(([axis,color]) => <div key={axis} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /><span className="uppercase text-slate-400">{axis}</span></div>)}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-1 overflow-x-auto px-2 py-2">
            <span className="mr-1 hidden text-[10px] font-bold uppercase tracking-widest text-slate-400 sm:inline">3D controls</span>
            {panels.map((panel) => {
              const Icon = panel.icon;
              const active = activePanel === panel.id;
              return <button key={panel.id} type="button" onClick={() => setActivePanel(active ? null : panel.id)} aria-expanded={active} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${active ? "border-indigo-500 bg-indigo-500 text-white" : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}><Icon className="h-3.5 w-3.5" />{panel.label}</button>;
            })}
            <button type="button" onClick={() => { addFunction(); setActivePanel("objects"); }} className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white"><Plus className="h-3.5 w-3.5" />Add object</button>
          </div>

          {activePanel === "objects" && (
            <div className="max-h-56 overflow-auto border-t border-slate-200 p-3 dark:border-slate-800">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {functions.map((fn) => <div key={fn.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-2"><button onClick={() => updateFn(fn.id, { visible: !fn.visible })} aria-label={`Toggle ${fn.latex}`} className="h-4 w-4 shrink-0 rounded-full border-2" style={{ backgroundColor: fn.visible ? fn.color : undefined, borderColor: fn.color, opacity: fn.visible ? 1 : 0.4 }} /><input value={fn.latex} onChange={(event) => updateFn(fn.id, { latex: event.target.value })} className="min-w-0 flex-1 bg-transparent font-mono text-xs text-slate-700 outline-none dark:text-slate-200" /><button onClick={() => removeFn(fn.id)} aria-label={`Delete ${fn.latex}`} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></div><div className="mt-2 flex items-center gap-2"><span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-slate-800">{fn.plotType || "expr"}</span><button onClick={() => updateFn(fn.id, { wireframe: !fn.wireframe })} className={`rounded border px-2 py-1 text-[10px] font-bold ${fn.wireframe ? "border-indigo-500 bg-indigo-500 text-white" : "border-slate-200 text-slate-500 dark:border-slate-700"}`}>Wireframe</button><label className="ml-auto flex items-center gap-2 text-[10px] text-slate-500">Opacity<input type="range" min="0" max="1" step="0.05" value={fn.opacity} onChange={(event) => updateFn(fn.id, { opacity: parseFloat(event.target.value) })} className="h-1 w-20 accent-indigo-500" /></label></div></div>)}
              </div>
            </div>
          )}

          {activePanel === "appearance" && (
            <div className="grid max-h-56 gap-3 overflow-auto border-t border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900"><span>Colormap</span><select value={settings.colormap || "parula"} onChange={(event) => setSetting("colormap", event.target.value)} className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">{Object.keys(COLOR_MAPS).map((map) => <option key={map} value={map}>{map}</option>)}</select></label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900"><span>Resolution</span><select value={settings.resolution} onChange={(event) => setSetting("resolution", parseInt(event.target.value))} className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800"><option value="32">Low</option><option value="64">Medium</option><option value="128">High</option></select></label>
              {[["showGrid","Axis box & grid"],["colorbar","Colorbar"],["autoRotate","Auto-rotate"],["flatShading","Smooth shading"]].map(([key,label]) => <label key={key} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900"><input type="checkbox" checked={!!settings[key]} onChange={(event) => setSetting(key, event.target.checked)} className="rounded text-indigo-500" />{label}</label>)}
            </div>
          )}

          {activePanel === "view" && (
            <div className="grid max-h-56 gap-3 overflow-auto border-t border-slate-200 p-3 md:grid-cols-2 dark:border-slate-800">
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"><div className="font-semibold text-slate-800 dark:text-slate-100">Current view</div><div className="mt-1">View: {Array.isArray(settings.view) ? `${settings.view[0]}°, ${settings.view[1]}°` : (settings.view || "default")}</div><div>X: [{xl.map(fmtNum).join(", ")}] · Y: [{yl.map(fmtNum).join(", ")}] · Z: [{zl.map(fmtNum).join(", ")}]</div></div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs leading-5 text-slate-600 dark:border-indigo-900 dark:bg-indigo-950 dark:text-slate-300"><div className="font-semibold text-indigo-700 dark:text-indigo-300">Mouse controls</div><div className="mt-1">Drag to orbit · wheel to zoom · right-drag to pan.</div><div className="mt-1 font-mono text-[10px]">surf · mesh · plot3 · scatter3 · colormap · view</div></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OpenMatGrapher3D;
