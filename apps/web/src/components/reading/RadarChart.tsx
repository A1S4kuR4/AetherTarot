"use client";

import { Player } from "@remotion/player";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

type RadarAxisKey = "spirit" | "fire" | "water" | "earth" | "air" | "chaos";

interface RadarAxisValue extends Record<string, number> {
  count: number;
  total: number;
  score: number;
}

interface RadarChartValues extends Record<RadarAxisKey, RadarAxisValue> {
  spirit: RadarAxisValue;
  fire: RadarAxisValue;
  water: RadarAxisValue;
  earth: RadarAxisValue;
  air: RadarAxisValue;
  chaos: RadarAxisValue;
}

interface RadarChartCompositionProps extends Record<string, unknown> {
  values: RadarChartValues;
  size: number;
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
const FPS = 30;
const DURATION_IN_FRAMES = 90;

function getPoint(center: number, radius: number, angle: number, value: number) {
  return `${center + radius * value * Math.cos(angle)},${center + radius * value * Math.sin(angle)}`;
}

function getPointsString(center: number, radius: number, angles: number[], values: number[]) {
  return values.map((value, index) => getPoint(center, radius, angles[index] ?? 0, value)).join(" ");
}

function RadarChartComposition({ values, size }: RadarChartCompositionProps) {
  const frame = useCurrentFrame();
  const center = size / 2;
  const radius = size * 0.29;
  const drawProgress = interpolate(frame, [6, 56], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const labelOpacity = interpolate(frame, [18, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pulseOpacity = interpolate(frame, [42, DURATION_IN_FRAMES], [0.45, 0.1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dataValues = AXES.map((axis) => values[axis.key].score);
  const angles = Array.from({ length: AXES.length }).map((_, index) => -Math.PI / 2 + (index * Math.PI) / 3);
  const maxPoints = getPointsString(center, radius, angles, Array(AXES.length).fill(1));
  const midPoints = getPointsString(center, radius, angles, Array(AXES.length).fill(0.5));
  const dataPoints = getPointsString(
    center,
    radius,
    angles,
    dataValues.map((value) => value * drawProgress),
  );

  return (
    <AbsoluteFill style={{ background: "transparent" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="settlement-neon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7C6BFF" stopOpacity="0.9" />
            <stop offset="48%" stopColor="#D66B3D" stopOpacity="0.78" />
            <stop offset="100%" stopColor="#B4546F" stopOpacity="0.85" />
          </linearGradient>
          <filter id="settlement-glow" x="-30%" y="-30%" width="160%" height="160%">
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
            <g key={`label-${axis.key}`} opacity={labelOpacity}>
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

        <polygon
          points={dataPoints}
          fill="url(#settlement-neon-gradient)"
          fillOpacity={0.42 + pulseOpacity * 0.24}
          stroke="url(#settlement-neon-gradient)"
          strokeWidth="3"
          filter="url(#settlement-glow)"
        />
        <polygon
          points={dataPoints}
          fill="none"
          stroke="#fff"
          strokeWidth="1"
          strokeOpacity={0.38 + pulseOpacity}
        />
        {angles.map((angle, index) => {
          const axis = AXES[index] ?? AXES[0];
          const value = values[axis.key].score * drawProgress;
          const x = center + radius * value * Math.cos(angle);
          const y = center + radius * value * Math.sin(angle);

          return (
            <circle
              key={`point-${axis.key}`}
              cx={x}
              cy={y}
              r="4"
              fill={axis.color}
              stroke="#fff"
              strokeWidth="1.5"
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}

export default function RadarChart({
  values,
  size = 300,
  className,
  layout = "inline",
}: RadarChartProps) {
  const orderedAxes = AXES.map((axis) => ({
    ...axis,
    value: values[axis.key],
  }));
  const leadingAxis = orderedAxes.reduce((currentLeader, axis) => {
    return axis.value.count > currentLeader.value.count ? axis : currentLeader;
  }, orderedAxes[0]);

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
          <Player
            component={RadarChartComposition}
            inputProps={{ values, size }}
            compositionWidth={size}
            compositionHeight={size}
            durationInFrames={DURATION_IN_FRAMES}
            fps={FPS}
            autoPlay
            loop={false}
            moveToBeginningWhenEnded={false}
            controls={false}
            clickToPlay={false}
            style={{ width: size, height: size }}
          />
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
              <div key={axis.key} className="grid grid-cols-[52px_1fr_42px] items-center gap-2">
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
