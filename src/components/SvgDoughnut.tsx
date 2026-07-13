import { useState } from "react";

export interface DoughnutItem {
  label: string;
  value: number;
}

interface SvgDoughnutProps {
  items: DoughnutItem[];
  title: string;
}

export default function SvgDoughnut({ items, title }: SvgDoughnutProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = items.reduce((acc, item) => acc + item.value, 0);

  // If there's no data, render an empty/placeholder state
  if (total === 0 || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <svg width="120" height="120" viewBox="0 0 100 100" className="opacity-30">
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" />
        </svg>
        <span className="text-xs mt-3">Нет данных</span>
      </div>
    );
  }

  // Predefined beautiful palette
  const colors = [
    "#3b82f6", // blue
    "#22c55e", // green
    "#a855f7", // purple
    "#f59e0b", // amber
    "#ef4444", // red
    "#14b8a6", // teal
    "#eab308", // yellow
    "#ec4899", // pink
    "#6366f1", // indigo
    "#06b6d4", // cyan
  ];

  // Calculate coordinates for arcs
  let accumulatedAngle = -90; // start at top

  const segments = items.map((item, idx) => {
    const percentage = item.value / total;
    const angle = percentage * 360;
    const startAngle = accumulatedAngle;
    const endAngle = accumulatedAngle + angle;
    accumulatedAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const r = 38; // radius
    const cx = 50;
    const cy = 50;

    // Start point
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);

    // End point
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    // Path command
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`;

    return {
      d,
      color: colors[idx % colors.length],
      label: item.label,
      value: item.value,
      percentage: percentage * 100,
    };
  });

  const activeSegment = hoveredIdx !== null ? segments[hoveredIdx] : null;

  return (
    <div className="flex flex-col md:flex-row items-center gap-6 h-full justify-around">
      {/* SVG canvas */}
      <div className="relative w-44 h-44 flex-shrink-0">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full transform transition-transform duration-300"
        >
          {/* Base circle background */}
          <circle cx="50" cy="50" r="38" fill="none" stroke="#1e293b" strokeWidth="8" />

          {/* Arcs */}
          {segments.map((seg, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <path
                key={idx}
                d={seg.d}
                fill="none"
                stroke={seg.color}
                strokeWidth={isHovered ? 11 : 8}
                strokeLinecap={segments.length > 1 ? "butt" : "round"}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  filter: isHovered ? "drop-shadow(0 0 4px rgba(255,255,255,0.15))" : "none",
                }}
              />
            );
          })}
        </svg>

        {/* Center reading details */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            {activeSegment ? activeSegment.label : "Всего"}
          </span>
          <span className="text-sm font-bold text-white leading-tight mt-0.5">
            {activeSegment
              ? `${activeSegment.percentage.toFixed(1)}%`
              : `${Math.round(total).toLocaleString("ru-RU")} ₽`}
          </span>
          {activeSegment && (
            <span className="text-[10px] text-slate-300 mt-0.5">
              {Math.round(activeSegment.value).toLocaleString("ru-RU")} ₽
            </span>
          )}
        </div>
      </div>

      {/* Elegant scrollable Legend */}
      <div className="flex-grow flex flex-col gap-1.5 max-h-[190px] overflow-y-auto pr-1 w-full text-xs">
        {segments.map((seg, idx) => {
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={idx}
              className={`flex items-center justify-between p-1.5 rounded-lg transition-colors cursor-pointer ${
                isHovered ? "bg-slate-700/55 text-white" : "hover:bg-slate-800/40 text-slate-300"
              }`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="font-medium truncate">{seg.label}</span>
              </div>
              <div className="text-right flex-shrink-0 font-semibold pl-2">
                <span>{seg.percentage.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
