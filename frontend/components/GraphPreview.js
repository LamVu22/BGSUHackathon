import { useState } from "react";

const nodes = [
  { id: 1, label: "Admissions", level: 1, x: 50, y: 120 },
  { id: 2, label: "Financial Aid", level: 2, x: 150, y: 60 },
  { id: 3, label: "Scholarships", level: 3, x: 250, y: 120 },
  { id: 4, label: "Housing", level: 2, x: 150, y: 170 },
  { id: 5, label: "Student Life", level: 2, x: 80, y: 40 },
];

const edges = [
  [1, 2],
  [2, 3],
  [1, 4],
  [2, 4],
  [5, 1],
];

export default function GraphPreview({ theme = "falcon" }) {
  const [expanded, setExpanded] = useState(false);
  const isDark = theme === "falconDark";
  const beamStroke = isDark ? "rgba(255,255,255,0.45)" : "rgba(31,41,55,0.45)";
  const pulseColor = isDark ? "#ffffff" : "#f26522";
  const nodeGlowOpacity = isDark ? 0.12 : 0.08;

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
        <div className="modal-box w-11/12 max-w-3xl bg-base-100 text-base-content">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-secondary">Graph context</p>
              <p className="text-lg font-semibold">Link neighborhood</p>
            </div>
            <button className="btn btn-sm" onClick={() => setExpanded(false)}>
              Close
            </button>
          </div>
          <div className="border border-base-300 rounded-2xl p-5 bg-base-200/40">
            <svg viewBox="0 0 600 360" className="w-full h-80 text-base-content/50">
              <defs>
                <linearGradient id="edgeGradientExpanded" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={isDark ? "#fbbf24" : "#f97316"} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={isDark ? "#38bdf8" : "#0ea5e9"} stopOpacity="0.6" />
                </linearGradient>
                <radialGradient id="nodeGlowExpanded" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(242,101,34,0.7)" />
                  <stop offset="100%" stopColor="rgba(242,101,34,0)" />
                </radialGradient>
              </defs>
              <rect x="0" y="0" width="600" height="360" rx="24" fill="url(#nodeGlowExpanded)" opacity={nodeGlowOpacity} />
              {edges.map(([from, to], index) => {
                const source = nodes.find((n) => n.id === from);
                const target = nodes.find((n) => n.id === to);
                if (!source || !target) return null;
                const scaledSource = { x: source.x * 2, y: source.y * 1.5 };
                const scaledTarget = { x: target.x * 2, y: target.y * 1.5 };
                const path = `M ${scaledSource.x} ${scaledSource.y} L ${scaledTarget.x} ${scaledTarget.y}`;
                return (
                  <g key={`modal-${from}-${to}`}>
                    <path d={path} stroke="url(#edgeGradientExpanded)" strokeWidth="4" strokeLinecap="round" fill="none" />
                    <path d={path} stroke={beamStroke} strokeWidth="1.5" strokeDasharray="6 12" strokeLinecap="round">
                      <animate attributeName="stroke-dashoffset" from="0" to="-60" dur="2s" repeatCount="indefinite" begin={`${index * 0.2}s`} />
                    </path>
                    <circle r="5" fill={pulseColor} opacity="0.8">
                      <animateMotion dur="3s" repeatCount="indefinite" path={path} begin={`${index * 0.4}s`} />
                      <animate attributeName="opacity" values="0;0.8;0" dur="3s" repeatCount="indefinite" begin={`${index * 0.4}s`} />
                    </circle>
                  </g>
                );
              })}
              {nodes.map((node) => (
                <g key={`modal-${node.id}`}>
                  <circle
                    cx={node.x * 2}
                    cy={node.y * 1.5}
                    r="20"
                    fill={node.level === 1 ? "#f26522" : node.level === 3 ? "#3aafa9" : "#fbbf24"}
                    className="drop-shadow-lg"
                  />
                  <text x={node.x * 2} y={node.y * 1.5 + 32} textAnchor="middle" className="text-sm fill-current">
                    {node.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
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

      <svg viewBox="0 0 300 220" className="w-full h-48 text-base-content/50">
        <defs>
          <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={isDark ? "#fbbf24" : "#f97316"} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isDark ? "#38bdf8" : "#0ea5e9"} stopOpacity="0.6" />
          </linearGradient>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(242,101,34,0.7)" />
            <stop offset="100%" stopColor="rgba(242,101,34,0)" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="300" height="220" rx="16" fill="url(#nodeGlow)" opacity={nodeGlowOpacity} />
        {edges.map(([from, to], index) => {
          const source = nodes.find((n) => n.id === from);
          const target = nodes.find((n) => n.id === to);
          const path = `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
          return (
            <g key={`${from}-${to}`}>
              <path
                d={path}
                stroke="url(#edgeGradient)"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-300"
              />
              <path
                d={path}
                stroke={beamStroke}
                strokeWidth="1.5"
                strokeDasharray="6 12"
                strokeLinecap="round"
              >
                <animate attributeName="stroke-dashoffset" from="0" to="-60" dur="2s" repeatCount="indefinite" begin={`${index * 0.2}s`} />
              </path>
              <circle r="4" fill={pulseColor} opacity="0.8">
                <animateMotion
                  dur="3s"
                  repeatCount="indefinite"
                  path={path}
                  begin={`${index * 0.4}s`}
                />
                <animate attributeName="opacity" values="0;0.8;0" dur="3s" repeatCount="indefinite" begin={`${index * 0.4}s`} />
              </circle>
            </g>
          );
        })}
        {nodes.map((node) => (
          <g key={node.id}>
            <circle
              cx={node.x}
              cy={node.y}
              r="14"
              fill={node.level === 1 ? "#f26522" : node.level === 3 ? "#3aafa9" : "#fbbf24"}
              className="drop-shadow-md"
            />
            <text x={node.x} y={node.y + 30} textAnchor="middle" className="text-[10px] fill-current">
              {node.label}
            </text>
          </g>
        ))}
      </svg>

      <p className="mt-3 text-xs text-base-content/60">
        {edges.length} link signals plotted from the latest crawl snapshot.
      </p>
    </div>
  );
}
