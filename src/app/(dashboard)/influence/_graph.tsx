'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type Node = {
  id: string;
  label: string;
  type: string;
  weight: number;
  x: number;
  y: number;
  color: string;
};

type Edge = {
  id: string;
  from: string;
  to: string;
  weight: number;
  type: string;
};

// Simple radial layout — places the main brand at center, others on a circle
function layoutNodes(nodes: Node[]): Node[] {
  if (nodes.length === 0) return nodes;
  const center = nodes.find((n) => n.type === 'brand') ?? nodes[0];
  const others = nodes.filter((n) => n.id !== center.id);

  const W = 700;
  const H = 460;
  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.min(W, H) * 0.32;

  const out: Node[] = [
    { ...center, x: cx, y: cy },
  ];
  others.forEach((n, i) => {
    const angle = (i / Math.max(1, others.length)) * Math.PI * 2;
    out.push({
      ...n,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    });
  });
  return out;
}

export function InfluenceGraph({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 700, h: 460 });
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Responsive sizing
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = e.contentRect.width;
        setSize({ w: Math.max(300, w), h: 460 });
      }
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const laidOut = useMemo(() => layoutNodes(nodes), [nodes]);
  const nodeMap = useMemo(() => new Map(laidOut.map((n) => [n.id, n])), [laidOut]);

  // Radius scale: between 8 and 32, driven by weight
  const weights = laidOut.map((n) => n.weight);
  const maxW = Math.max(1, ...weights);
  const minW = Math.min(...weights, 1);
  const radiusFor = (n: Node) => {
    if (maxW === minW) return 16;
    const t = (n.weight - minW) / (maxW - minW);
    return 8 + t * 24;
  };

  const hoveredNode = hoverId ? nodeMap.get(hoverId) : null;
  const connectedIds = useMemo(() => {
    if (!hoverId) return new Set<string>();
    const s = new Set<string>([hoverId]);
    for (const e of edges) {
      if (e.from === hoverId) s.add(e.to);
      if (e.to === hoverId) s.add(e.from);
    }
    return s;
  }, [hoverId, edges]);

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg
        viewBox={`0 0 ${size.w} ${size.h}`}
        width="100%"
        height={size.h}
        className="overflow-visible"
      >
        <defs>
          <radialGradient id="graphBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1e293b" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width={size.w} height={size.h} fill="url(#graphBg)" />

        {/* Edges */}
        <g>
          {edges.map((e) => {
            const from = nodeMap.get(e.from);
            const to = nodeMap.get(e.to);
            if (!from || !to) return null;
            const isHighlighted =
              hoverId && (e.from === hoverId || e.to === hoverId);
            const isDim = hoverId && !isHighlighted;
            return (
              <line
                key={e.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={isHighlighted ? '#6366f1' : '#334155'}
                strokeOpacity={isDim ? 0.15 : isHighlighted ? 0.9 : 0.5}
                strokeWidth={Math.max(0.5, e.weight * 3)}
                className="transition-all"
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {laidOut.map((n) => {
            const r = radiusFor(n);
            const isHover = hoverId === n.id;
            const isDim = hoverId && !connectedIds.has(n.id);
            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onMouseEnter={() => setHoverId(n.id)}
                onMouseLeave={() => setHoverId(null)}
                className="cursor-pointer"
              >
                <circle
                  r={r + 4}
                  fill={n.color}
                  fillOpacity={isDim ? 0.04 : isHover ? 0.18 : 0.08}
                  className="transition-all"
                />
                <circle
                  r={r}
                  fill={n.color}
                  fillOpacity={isDim ? 0.4 : 1}
                  stroke={isHover ? '#fff' : 'transparent'}
                  strokeWidth={2}
                  className="transition-all"
                />
                <text
                  textAnchor="middle"
                  y={r + 14}
                  fontSize={10}
                  fill={isDim ? '#475569' : '#cbd5e1'}
                  className="pointer-events-none select-none"
                >
                  {n.label.length > 12 ? n.label.slice(0, 12) + '…' : n.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Hover tooltip */}
      {hoveredNode ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-2xl backdrop-blur"
          style={{
            left: `${(hoveredNode.x / size.w) * 100}%`,
            top: `${(hoveredNode.y / size.h) * 100}%`,
          }}
        >
          <p className="font-semibold text-slate-100">{hoveredNode.label}</p>
          <p className="mt-0.5 text-slate-400">
            类型: {hoveredNode.type} · 权重: {hoveredNode.weight.toFixed(2)}
          </p>
        </div>
      ) : null}

      {/* Legend overlay (bottom-right) */}
      <div className="pointer-events-none absolute bottom-2 right-2 rounded-md border border-slate-800/60 bg-slate-900/60 px-2 py-1 text-[10px] text-slate-500 backdrop-blur">
        悬停查看详情
      </div>
    </div>
  );
}
