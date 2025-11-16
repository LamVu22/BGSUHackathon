import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const DEFAULT_NODES = [
  { id: "n1", label: "Admissions", level: 1, x: 50, y: 120 },
  { id: "n2", label: "Financial Aid", level: 2, x: 150, y: 60 },
  { id: "n3", label: "Scholarships", level: 3, x: 250, y: 120 },
  { id: "n4", label: "Housing", level: 2, x: 150, y: 170 },
  { id: "n5", label: "Student Life", level: 2, x: 80, y: 40 },
];

const DEFAULT_EDGES = [
  ["n1", "n2"],
  ["n2", "n3"],
  ["n1", "n4"],
  ["n2", "n4"],
  ["n5", "n1"],
];

const levelStyles = {
  1: { base: "#f26522", light: "#ffe0cd" },
  2: { base: "#fbbf24", light: "#fff5d1" },
  3: { base: "#3aafa9", light: "#d7f7f5" },
};

const COLOR_PALETTE = ["#f26522", "#3aafa9", "#fbbf24", "#60a5fa", "#a78bfa", "#f472b6", "#4ade80", "#f97316", "#2dd4bf", "#facc15"];

const VARIANT_CONFIG = {
  inline: { width: 300, height: 220, scale: 0.85, camera: 320 },
  modal: { width: 560, height: 340, scale: 1.15, camera: 460 },
};

export default function GraphPreview({ theme = "falcon", nodes = DEFAULT_NODES, edges = DEFAULT_EDGES, graphContext }) {
  const [expanded, setExpanded] = useState(false);
  const { rotation, pointerHandlers } = useOrbitRotation();

  const derived = useMemo(() => deriveGraphFromContext(graphContext), [graphContext]);
  const finalNodes = (derived?.nodes?.length ? derived.nodes : nodes) ?? DEFAULT_NODES;
  const finalEdges = (derived?.edges?.length ? derived.edges : edges) ?? DEFAULT_EDGES;
  const safeNodes = finalNodes.length > 0 ? finalNodes : DEFAULT_NODES;
  const safeEdges = finalEdges.length > 0 ? finalEdges : DEFAULT_EDGES;
  const colorMap = useMemo(() => assignNodeColors(safeNodes), [safeNodes]);

  return (
    <div className="bg-base-100 border border-base-200 rounded-2xl p-5 h-full shadow-inner transition-all duration-200 hover:shadow-2xl hover:border-primary/40">
      <dialog
        className={`modal ${expanded ? "modal-open" : ""} transition-opacity duration-200`}
        open={expanded}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setExpanded(false);
          }
        }}
      >
        <div className="modal-box w-11/12 max-w-4xl bg-base-100 text-base-content">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-secondary">Graph context</p>
              <p className="text-lg font-semibold">Link neighborhood</p>
            </div>
            <button className="btn btn-sm" onClick={() => setExpanded(false)}>
              Close
            </button>
          </div>
          {expanded && (
            <div className="border border-base-300 rounded-2xl p-5 bg-base-200/40">
              <GraphScene
                nodes={safeNodes}
                edges={safeEdges}
                rotation={rotation}
                theme={theme}
                variant="modal"
                pointerHandlers={pointerHandlers}
                colorMap={colorMap}
              />
            </div>
          )}
        </div>
      </dialog>

      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-secondary">Graph context</p>
          <p className="text-lg font-semibold">Link neighborhood</p>
        </div>
        <button className="btn btn-xs btn-outline hover:btn-primary transition-colors duration-200" onClick={() => setExpanded(true)}>
          Expand
        </button>
      </div>

      <GraphScene
        nodes={safeNodes}
        edges={safeEdges}
        rotation={rotation}
        theme={theme}
        variant="inline"
        pointerHandlers={pointerHandlers}
        colorMap={colorMap}
      />

      <p className="mt-3 text-xs text-base-content/60">
        Drag to tilt or spin the scene. {safeEdges.length} link signals plotted from the latest crawl snapshot.
      </p>
    </div>
  );
}

function GraphScene({ nodes, edges, rotation, theme, variant, pointerHandlers, colorMap }) {
  const config = VARIANT_CONFIG[variant];
  const projectedNodes = useMemo(() => projectNodes(nodes, rotation, variant), [nodes, rotation, variant]);
  const nodeLookup = useMemo(() => {
    const map = new Map();
    projectedNodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [projectedNodes]);
  const sortedNodes = useMemo(() => [...projectedNodes].sort((a, b) => a.depth - b.depth), [projectedNodes]);

  const isDark = theme === "falconDark";
  const beamStroke = isDark ? "rgba(255,255,255,0.45)" : "rgba(31,41,55,0.45)";
  const pulseColor = isDark ? "#ffffff" : "#f26522";
  const nodeGlowOpacity = isDark ? 0.12 : 0.08;
  const platformColor = isDark ? "rgba(15,23,42,0.85)" : "rgba(148,163,184,0.3)";
  const prefix = `${variant}-${theme}`;

  return (
    <svg
      viewBox={`0 0 ${config.width} ${config.height}`}
      className={`w-full ${variant === "modal" ? "h-72" : "h-48"} text-base-content/50 select-none touch-none cursor-grab active:cursor-grabbing`}
      {...pointerHandlers}
    >
      <defs>
        <linearGradient id={`${prefix}-edgeGradient`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={isDark ? "#fbbf24" : "#f97316"} stopOpacity="0.3" />
          <stop offset="100%" stopColor={isDark ? "#38bdf8" : "#0ea5e9"} stopOpacity="0.6" />
        </linearGradient>
        <radialGradient id={`${prefix}-nodeGlow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(242,101,34,0.7)" />
          <stop offset="100%" stopColor="rgba(242,101,34,0)" />
        </radialGradient>
        {sortedNodes.map((node) => {
          const style = colorMap.get(node.id) || levelStyles[node.level] || levelStyles[1];
          return (
            <radialGradient id={`${prefix}-nodeSphere-${node.id}`} key={`${prefix}-grad-${node.id}`} cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor={style.light} />
              <stop offset="45%" stopColor={style.base} />
              <stop offset="100%" stopColor={isDark ? "#0f172a" : "#1f2937"} stopOpacity="0.2" />
            </radialGradient>
          );
        })}
      </defs>

      <rect x="0" y="0" width={config.width} height={config.height} rx="24" fill={`url(#${prefix}-nodeGlow)`} opacity={nodeGlowOpacity} />
      <ellipse cx={config.width / 2} cy={config.height * 0.68} rx={config.width * 0.33} ry={config.height * 0.2} fill={platformColor} />

      {edges.map(([from, to], index) => {
        const source = nodeLookup.get(from);
        const target = nodeLookup.get(to);
        if (!source || !target) return null;
        const path = `M ${source.screenX} ${source.screenY} L ${target.screenX} ${target.screenY}`;
        return (
          <g key={`${prefix}-${from}-${to}`}>
            <path d={path} stroke={`url(#${prefix}-edgeGradient)`} strokeWidth={variant === "modal" ? 4 : 3} strokeLinecap="round" fill="none" />
            <path d={path} stroke={beamStroke} strokeWidth="1.5" strokeDasharray="6 12" strokeLinecap="round">
              <animate attributeName="stroke-dashoffset" from="0" to="-60" dur="2s" repeatCount="indefinite" begin={`${index * 0.2}s`} />
            </path>
            <circle r={variant === "modal" ? 5 : 4} fill={pulseColor} opacity="0.8">
              <animateMotion dur="3s" repeatCount="indefinite" path={path} begin={`${index * 0.4}s`} />
              <animate attributeName="opacity" values="0;0.8;0" dur="3s" repeatCount="indefinite" begin={`${index * 0.4}s`} />
            </circle>
          </g>
        );
      })}

      {sortedNodes.map((node) => (
        <g key={`${prefix}-node-${node.id}`}>
          <ellipse
            cx={node.screenX}
            cy={node.screenY + (variant === "modal" ? 24 : 15)}
            rx={variant === "modal" ? 24 : 16}
            ry={variant === "modal" ? 9 : 6}
            fill={isDark ? "rgba(0,0,0,0.4)" : "rgba(31,41,55,0.18)"}
          />
          <circle
            cx={node.screenX}
            cy={node.screenY}
            r={variant === "modal" ? 20 : 14}
            fill={`url(#${prefix}-nodeSphere-${node.id})`}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1"
          />
          <circle cx={node.screenX - 5} cy={node.screenY - 5} r={variant === "modal" ? 4 : 3.2} fill="rgba(255,255,255,0.45)" />
          <text x={node.screenX} y={node.screenY + (variant === "modal" ? 34 : 28)} textAnchor="middle" className="text-[10px] fill-current">
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function projectNodes(nodes, rotation, variant) {
  const config = VARIANT_CONFIG[variant];
  const cameraDistance = config.camera;
  const euler = new THREE.Euler(rotation.x, rotation.y, 0, "XYZ");

  return nodes.map((node) => {
    const vector = new THREE.Vector3(node.x - config.width / 2, (config.height / 2 - node.y) || 0, (node.level || 2) * 18 - 36);
    vector.applyEuler(euler);
    const perspective = cameraDistance / (cameraDistance - vector.z);
    const screenX = config.width / 2 + vector.x * config.scale * perspective;
    const screenY = config.height / 2 - vector.y * config.scale * perspective;
    return {
      ...node,
      screenX,
      screenY,
      depth: vector.z,
    };
  });
}

function useOrbitRotation() {
  const [rotation, setRotation] = useState({ x: -0.35, y: -0.8 });
  const dragRef = useRef({ active: false, pointerId: null, startX: 0, startY: 0, baseX: 0, baseY: 0, target: null });

  useEffect(() => {
    let frameId;
    const animate = () => {
      if (!dragRef.current.active) {
        setRotation((prev) => ({ x: prev.x, y: wrapAngle(prev.y + 0.003) }));
      }
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const handlePointerDown = (event) => {
    event.preventDefault();
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: rotation.x,
      baseY: rotation.y,
      target: event.currentTarget,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current.active) return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    setRotation({
      x: clamp(dragRef.current.baseX + dy * 0.005, -Math.PI / 3, Math.PI / 3),
      y: dragRef.current.baseY + dx * 0.005,
    });
  };

  const endDrag = () => {
    if (dragRef.current.target && dragRef.current.pointerId !== null) {
      try {
        dragRef.current.target.releasePointerCapture(dragRef.current.pointerId);
      } catch {
        // ignore release errors
      }
    }
    dragRef.current = { active: false, pointerId: null, startX: 0, startY: 0, baseX: 0, baseY: 0, target: null };
  };

  const pointerHandlers = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: endDrag,
    onPointerLeave: endDrag,
  };

  return { rotation, pointerHandlers };
}

function wrapAngle(angle) {
  const twoPi = Math.PI * 2;
  if (angle > twoPi) return angle - twoPi;
  if (angle < -twoPi) return angle + twoPi;
  return angle;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function deriveGraphFromContext(graphContext) {
  if (!graphContext) return null;
  const rawNodes = graphContext.nodes || [];
  const rawEdges = graphContext.edges || [];
  if (!rawNodes.length) return null;
  const laidOutNodes = layoutNodes(rawNodes);
  const normalizedEdges = normalizeEdges(rawEdges, laidOutNodes);
  return { nodes: laidOutNodes, edges: normalizedEdges };
}

function layoutNodes(rawNodes) {
  const baseWidth = 300;
  const baseHeight = 220;
  const centerX = baseWidth / 2;
  const centerY = baseHeight / 2;
  const radiusX = Math.min(centerX, 140);
  const radiusY = Math.min(centerY, 110);

  return rawNodes.map((node, index) => {
    const id = String(node.id ?? node.key ?? `node-${index}`);
    const label = node.label ?? node.title ?? node.name ?? `Node ${index + 1}`;
    const level = Number(node.level ?? node.depth ?? 2);
    let x = typeof node.x === "number" ? node.x : null;
    let y = typeof node.y === "number" ? node.y : null;
    if (x == null || y == null) {
      const angle = (index / Math.max(rawNodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
      x = centerX + Math.cos(angle) * radiusX * 0.75;
      y = centerY + Math.sin(angle) * radiusY * 0.75;
    }
    return { id, label, level, x, y };
  });
}

function normalizeEdges(rawEdges, nodes) {
  if (!nodes.length) return [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const fallback = nodes.slice(1).map((node) => [nodes[0].id, node.id]);
  if (!rawEdges?.length) return fallback;

  const edges = rawEdges
    .map((edge, index) => {
      if (Array.isArray(edge) && edge.length >= 2) {
        return [String(edge[0]), String(edge[1])];
      }
      if (edge.source !== undefined && edge.target !== undefined) {
        return [String(edge.source), String(edge.target)];
      }
      if (edge.from && edge.to) {
        return [String(edge.from), String(edge.to)];
      }
      const fallbackEdge = fallback[index] || fallback[0];
      return fallbackEdge || null;
    })
    .filter(Boolean)
    .filter(([from, to]) => from !== to && nodeIds.has(from) && nodeIds.has(to));

  return edges.length ? edges : fallback;
}

function assignNodeColors(nodes) {
  const sourceMap = new Map();
  const colorAssignments = new Map();
  let paletteIndex = 0;
  nodes.forEach((node, index) => {
    const sourceKey = (node.source ?? node.domain ?? node.group ?? node.type ?? null) || null;
    let baseColor;
    if (sourceKey) {
      if (!sourceMap.has(sourceKey)) {
        sourceMap.set(sourceKey, COLOR_PALETTE[paletteIndex % COLOR_PALETTE.length]);
        paletteIndex += 1;
      }
      baseColor = sourceMap.get(sourceKey);
    } else {
      baseColor = COLOR_PALETTE[paletteIndex % COLOR_PALETTE.length];
      paletteIndex += 1;
    }
    const light = lightenHex(baseColor, 0.45);
    colorAssignments.set(node.id, { base: baseColor, light });
  });
  return colorAssignments;
}

function lightenHex(hex, amount = 0.3) {
  const normalized = hex.replace("#", "");
  const num = parseInt(normalized, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const mix = (channel) => Math.round(channel + (255 - channel) * amount);
  const nr = mix(r);
  const ng = mix(g);
  const nb = mix(b);
  return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
}
