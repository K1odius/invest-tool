import React, { useState, useRef } from "react";

interface SvgLineChartProps {
  dates: string[];
  portfolioData: number[];
  indexData: number[];
  loading?: boolean;
}

export default function SvgLineChart({
  dates,
  portfolioData,
  indexData,
  loading = false,
}: SvgLineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-slate-400">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs mt-3">Загрузка котировок с Мосбиржи...</span>
      </div>
    );
  }

  const n = dates.length;
  if (n === 0 || portfolioData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52 border border-dashed border-slate-700 rounded-xl bg-slate-900/20 text-slate-400">
        <span className="text-xs">Нажмите «Построить график» для загрузки исторических данных</span>
      </div>
    );
  }

  // Dimensions
  const width = 600;
  const height = 240;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  // Find min/max values to fit everything perfectly on screen
  const allValues = [...portfolioData, ...indexData];
  const minVal = Math.min(...allValues, 0) - 2; // leave room below, anchor at >= 0 space if possible
  const maxVal = Math.max(...allValues, 2) + 2; // leave room above
  const valRange = maxVal - minVal;

  const getX = (index: number) => {
    return paddingLeft + (index / (n - 1)) * (width - paddingLeft - paddingRight);
  };

  const getY = (val: number) => {
    return (
      height -
      paddingBottom -
      ((val - minVal) / valRange) * (height - paddingTop - paddingBottom)
    );
  };

  // Build the SVG lines
  let portfolioPoints = "";
  let indexPoints = "";

  for (let i = 0; i < n; i++) {
    const x = getX(i);
    const yP = getY(portfolioData[i]);
    const yI = getY(indexData[i]);

    if (i === 0) {
      portfolioPoints += `M ${x} ${yP}`;
      indexPoints += `M ${x} ${yI}`;
    } else {
      portfolioPoints += ` L ${x} ${yP}`;
      indexPoints += ` L ${x} ${yI}`;
    }
  }

  // Y-axis grid markers
  const gridSteps = 5;
  const gridLines: { val: number; y: number }[] = [];
  for (let i = 0; i <= gridSteps; i++) {
    const val = minVal + (i / gridSteps) * valRange;
    gridLines.push({ val, y: getY(val) });
  }

  // X-axis dates sample (show ~5 labels max)
  const xLabelsCount = Math.min(5, n);
  const xLabelsIndices = Array.from({ length: xLabelsCount }, (_, i) =>
    Math.round((i / (xLabelsCount - 1)) * (n - 1))
  );

  // Handle Mouse Hover tracking
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPos = e.clientX - rect.left;

    // Scale client mouse X to SVG coordinates
    const scaleX = width / rect.width;
    const svgX = xPos * scaleX;

    const chartWidth = width - paddingLeft - paddingRight;
    const relativeX = svgX - paddingLeft;
    const exactIndex = (relativeX / chartWidth) * (n - 1);
    const nearestIndex = Math.max(0, Math.min(n - 1, Math.round(exactIndex)));

    setHoverIndex(nearestIndex);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Horizontal grid lines */}
        {gridLines.map((line, idx) => (
          <g key={idx}>
            <line
              x1={paddingLeft}
              y1={line.y}
              x2={width - paddingRight}
              y2={line.y}
              stroke="#334155"
              strokeWidth="0.5"
              strokeDasharray={line.val === 0 ? "none" : "3,3"}
            />
            <text
              x={paddingLeft - 8}
              y={line.y + 4}
              fill="#94a3b8"
              fontSize="10"
              textAnchor="end"
              fontFamily="monospace"
            >
              {line.val >= 0 ? "+" : ""}
              {line.val.toFixed(1)}%
            </text>
          </g>
        ))}

        {/* X-axis date labels */}
        {xLabelsIndices.map((dataIdx, i) => {
          if (dataIdx >= n) return null;
          const x = getX(dataIdx);
          // Format date from YYYY-MM-DD to DD.MM
          const rawDate = dates[dataIdx];
          let formattedDate = rawDate;
          if (rawDate && rawDate.includes("-")) {
            const parts = rawDate.split("-");
            formattedDate = `${parts[2]}.${parts[1]}`;
          }
          return (
            <text
              key={i}
              x={x}
              y={height - 12}
              fill="#64748b"
              fontSize="10"
              textAnchor="middle"
            >
              {formattedDate}
            </text>
          );
        })}

        {/* IMOEX Index Path */}
        <path
          d={indexPoints}
          fill="none"
          stroke="#64748b"
          strokeWidth="1.5"
          strokeDasharray="4,3"
        />

        {/* Portfolio Path */}
        <path
          d={portfolioPoints}
          fill="none"
          stroke="#10b981"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover elements */}
        {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < n && (
          <g>
            {/* Vertical Tracker Line */}
            <line
              x1={getX(hoverIndex)}
              y1={paddingTop}
              x2={getX(hoverIndex)}
              y2={height - paddingBottom}
              stroke="#cbd5e1"
              strokeWidth="1"
              strokeDasharray="2,2"
            />

            {/* Index Data Dot */}
            <circle
              cx={getX(hoverIndex)}
              cy={getY(indexData[hoverIndex])}
              r="4"
              fill="#64748b"
              stroke="#0f172a"
              strokeWidth="1.5"
            />

            {/* Portfolio Data Dot */}
            <circle
              cx={getX(hoverIndex)}
              cy={getY(portfolioData[hoverIndex])}
              r="5"
              fill="#10b981"
              stroke="#0f172a"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>

      {/* Hover Floating Tooltip */}
      {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < n && (
        <div
          className="absolute z-40 bg-slate-900 border border-slate-700 rounded-lg p-2.5 shadow-xl text-xs flex flex-col gap-1 text-slate-200 pointer-events-none"
          style={{
            left: `${(getX(hoverIndex) / width) * 100 > 60 ? `calc(${(getX(hoverIndex) / width) * 100}% - 165px)` : `calc(${(getX(hoverIndex) / width) * 100}% + 15px)`}`,
            top: "10px",
          }}
        >
          <div className="font-bold border-b border-slate-800 pb-1 mb-1 text-slate-400">
            {dates[hoverIndex]}
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Портфель:
            </span>
            <span
              className={`font-semibold ${
                portfolioData[hoverIndex] >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {portfolioData[hoverIndex] >= 0 ? "+" : ""}
              {portfolioData[hoverIndex].toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              Индекс МосБиржи:
            </span>
            <span
              className={`font-semibold ${
                indexData[hoverIndex] >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {indexData[hoverIndex] >= 0 ? "+" : ""}
              {indexData[hoverIndex].toFixed(1)}%
            </span>
          </div>
          <div className="text-[10px] text-slate-500 text-right mt-1 border-t border-slate-800/60 pt-0.5">
            Опережение:{" "}
            <span
              className={
                portfolioData[hoverIndex] - indexData[hoverIndex] >= 0
                  ? "text-emerald-400 font-semibold"
                  : "text-rose-400 font-semibold"
              }
            >
              {(portfolioData[hoverIndex] - indexData[hoverIndex]).toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
