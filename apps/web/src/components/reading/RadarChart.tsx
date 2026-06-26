"use client";

import { useId, useMemo, useState } from "react";

export type RadarAxisKey = "spirit" | "fire" | "water" | "earth" | "air" | "chaos";

interface RadarAxisValue extends Record<string, number> {
  count: number;
  total: number;
  score: number;
}

export interface RadarChartValues extends Record<RadarAxisKey, RadarAxisValue> {
  spirit: RadarAxisValue;
  fire: RadarAxisValue;
  water: RadarAxisValue;
  earth: RadarAxisValue;
  air: RadarAxisValue;
  chaos: RadarAxisValue;
}

interface RadarChartProps {
  values: RadarChartValues;
  size?: number;
  className?: string;
  layout?: "inline" | "stacked";
}

const AXES: Array<{
  key: RadarAxisKey;
  label: string;
  shorthand: string;
  description: string;
  color: string;
}> = [
  {
    key: "spirit",
    label: "精神",
    shorthand: "大阿卡纳",
    description: "主题与命运感",
    color: "#7C6BFF",
  },
  {
    key: "fire",
    label: "火",
    shorthand: "权杖",
    description: "行动与意志",
    color: "#D66B3D",
  },
  {
    key: "water",
    label: "水",
    shorthand: "圣杯",
    description: "情感与关系",
    color: "#3F84B8",
  },
  {
    key: "earth",
    label: "土",
    shorthand: "星币",
    description: "现实与资源",
    color: "#8B7A45",
  },
  {
    key: "air",
    label: "风",
    shorthand: "宝剑",
    description: "判断与冲突",
    color: "#5E6F86",
  },
  {
    key: "chaos",
    label: "张力",
    shorthand: "逆位",
    description: "阻滞与反转",
    color: "#B4546F",
  },
];

function getPoint(center: number, radius: number, angle: number, value: number) {
  return {
    x: center + radius * value * Math.cos(angle),
    y: center + radius * value * Math.sin(angle),
  };
}

function getPointsString(
  center: number,
  radius: number,
  angles: number[],
  values: number[],
) {
  return values
    .map((value, index) => {
      const point = getPoint(center, radius, angles[index] ?? 0, value);
      return `${point.x},${point.y}`;
    })
    .join(" ");
}

export default function RadarChart({
  values,
  size = 300,
  className,
  layout = "inline",
}: RadarChartProps) {
  const [hoveredAxis, setHoveredAxis] = useState<string | null>(null);
  const gradientId = useId();
  const glowId = useId();
  const chartKey = useMemo(
    () => AXES.map((axis) => values[axis.key].count).join("-"),
    [values],
  );

  const center = size / 2;
  const radius = size * 0.29;
  const angles = useMemo(
    () =>
      Array.from({ length: AXES.length }).map(
        (_, index) => -Math.PI / 2 + (index * Math.PI) / 3,
      ),
    [],
  );

  const dataValues = AXES.map((axis) => values[axis.key].score);
  const maxPoints = getPointsString(center, radius, angles, Array(AXES.length).fill(1));
  const midPoints = getPointsString(center, radius, angles, Array(AXES.length).fill(0.5));
  const dataPoints = getPointsString(center, radius, angles, dataValues);

  const orderedAxes = AXES.map((axis) => ({
    ...axis,
    value: values[axis.key],
  }));
  const leadingAxis = orderedAxes.reduce(
    (currentLeader, axis) =>
      axis.value.count > currentLeader.value.count ? axis : currentLeader,
    orderedAxes[0],
  );

  return (
    <div className={className}>
      <div
        className={
          layout === "stacked"
            ? "mx-auto flex flex-col items-center gap-4"
            : "mx-auto flex flex-col items-center gap-5 md:flex-row md:items-center md:justify-center"
        }
      >
        <div style={{ width: size, height: size }}>
          <svg
            key={chartKey}
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="radar-chart-svg"
          >
            <defs>
              <linearGradient
                id={gradientId}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#7C6BFF" stopOpacity="0.9" />
                <stop offset="48%" stopColor="#D66B3D" stopOpacity="0.78" />
                <stop offset="100%" stopColor="#B4546F" stopOpacity="0.85" />
              </linearGradient>
              <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <polygon
              points={maxPoints}
              fill="rgba(124, 107, 255, 0.035)"
              stroke="rgba(124, 107, 255, 0.3)"
              strokeWidth="1"
            />
            <polygon
              points={midPoints}
              fill="none"
              stroke="rgba(180, 84, 111, 0.24)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />

            {angles.map((angle, index) => (
              <line
                key={`axis-${AXES[index]?.key ?? index}`}
                x1={center}
                y1={center}
                x2={center + radius * Math.cos(angle)}
                y2={center + radius * Math.sin(angle)}
                stroke="rgba(94, 111, 134, 0.22)"
                strokeWidth="1"
              />
            ))}

            {angles.map((angle, index) => {
              const axis = AXES[index] ?? AXES[0];
              const value = values[axis.key];
              const labelRadius = radius + 24;
              const x = center + labelRadius * Math.cos(angle);
              const y = center + labelRadius * Math.sin(angle);

              return (
                <g
                  key={`label-${axis.key}`}
                  className="radar-chart-label"
                  style={{ transformOrigin: `${x}px ${y}px` }}
                >
                  <circle cx={x} cy={y - 9} r="4" fill={axis.color} opacity="0.78" />
                  <text
                    x={x}
                    y={y + 3}
                    fill="#2A2520"
                    fontSize="12"
                    fontFamily="sans-serif"
                    fontWeight="600"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {axis.label}
                  </text>
                  <text
                    x={x}
                    y={y + 18}
                    fill="rgba(92, 70, 58, 0.72)"
                    fontSize="10"
                    fontFamily="sans-serif"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {value.count}/{value.total}
                  </text>
                </g>
              );
            })}

            <g
              className="radar-chart-data"
              style={{ transformOrigin: `${center}px ${center}px` }}
            >
              <polygon
                points={dataPoints}
                fill={`url(#${gradientId})`}
                className="radar-chart-data-fill"
                stroke={`url(#${gradientId})`}
                strokeWidth="3"
                filter={`url(#${glowId})`}
              />
              <polygon
                points={dataPoints}
                fill="none"
                stroke="#fff"
                strokeWidth="1"
                className="radar-chart-data-stroke"
              />
              {angles.map((angle, index) => {
                const axis = AXES[index] ?? AXES[0];
                const value = values[axis.key].score;
                const point = getPoint(center, radius, angle, value);

                return (
                  <circle
                    key={`point-${axis.key}`}
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill={axis.color}
                    stroke="#fff"
                    strokeWidth="1.5"
                  />
                );
              })}
            </g>
          </svg>
        </div>
        <div className="w-full max-w-[280px] space-y-3 text-left">
          <div className="rounded-2xl border border-terracotta/15 bg-paper/70 p-4 shadow-sm">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              主导倾向
            </p>
            <p className="mt-1 font-serif text-xl text-ink">
              {leadingAxis.label} · {leadingAxis.shorthand}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-text-body">
              {leadingAxis.description}在这组牌里最突出：{leadingAxis.value.count}/{leadingAxis.value.total} 张。
            </p>
          </div>
          <div className="grid gap-2">
            {orderedAxes.map((axis) => (
              <div
                key={axis.key}
                className="group relative grid grid-cols-[52px_1fr_42px] items-center gap-2 cursor-help"
                onMouseEnter={() => setHoveredAxis(axis.key)}
                onMouseLeave={() => setHoveredAxis(null)}
              >
                <span className="font-sans text-xs font-medium text-text-muted">
                  {axis.label}
                </span>
                <div className="h-2 overflow-hidden rounded-full bg-paper-border/70">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(axis.value.score * 100, axis.value.count > 0 ? 12 : 0)}%`,
                      backgroundColor: axis.color,
                    }}
                  />
                </div>
                <span className="text-right font-sans text-xs text-text-muted">
                  {axis.value.count}/{axis.value.total}
                </span>
                {hoveredAxis === axis.key && (
                  <div className="absolute left-0 top-full z-10 mt-1 whitespace-nowrap rounded-lg border border-paper-border bg-paper-raised px-3 py-1.5 font-sans text-xs text-text-body shadow-md">
                    {axis.shorthand} · {axis.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
