"use client";

import { useMemo } from "react";
import { motion } from "motion/react";

interface RadarChartProps {
  values: {
    fire: number;
    water: number;
    air: number;
    earth: number;
    spirit: number;
    chaos: number;
  };
  size?: number;
  className?: string;
}

const AXIS_LABELS = ["精神 (Spirit)", "火 (Wands)", "水 (Cups)", "土 (Pentacles)", "风 (Swords)", "张力 (Chaos)"];

export default function RadarChart({ values, size = 300, className }: RadarChartProps) {
  const center = size / 2;
  const radius = size * 0.35; // 留出边缘显示 Label 的空间
  const dataValues = [
    values.spirit,
    values.fire,
    values.water,
    values.earth,
    values.air,
    values.chaos,
  ];

  // 六个顶点的角度，从正上方开始 (-90度)，顺时针各 60 度
  const angles = useMemo(() => {
    return Array.from({ length: 6 }).map((_, i) => -Math.PI / 2 + (i * Math.PI) / 3);
  }, []);

  const getPoint = (angle: number, val: number, r: number) => {
    return `${center + r * val * Math.cos(angle)},${center + r * val * Math.sin(angle)}`;
  };

  const getPointsString = (vals: number[]) => {
    return vals.map((val, i) => getPoint(angles[i]!, val, radius)).join(" ");
  };

  const maxPoints = getPointsString(Array(6).fill(1));
  const midPoints = getPointsString(Array(6).fill(0.5));
  const dataPoints = getPointsString(dataValues);

  return (
    <div className={className} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="neon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7170FF" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FF7070" stopOpacity="0.8" />
          </linearGradient>
          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background Grids */}
        <polygon
          points={maxPoints}
          fill="none"
          stroke="rgba(113, 112, 255, 0.15)"
          strokeWidth="1"
        />
        <polygon
          points={midPoints}
          fill="none"
          stroke="rgba(113, 112, 255, 0.1)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Axes */}
        {angles.map((angle, i) => (
          <line
            key={`axis-${i}`}
            x1={center}
            y1={center}
            x2={center + radius * Math.cos(angle)}
            y2={center + radius * Math.sin(angle)}
            stroke="rgba(113, 112, 255, 0.15)"
            strokeWidth="1"
          />
        ))}

        {/* Labels */}
        {angles.map((angle, i) => {
          const labelRadius = radius + 25;
          const x = center + labelRadius * Math.cos(angle);
          const y = center + labelRadius * Math.sin(angle);
          return (
            <text
              key={`label-${i}`}
              x={x}
              y={y}
              fill="rgba(255, 255, 255, 0.6)"
              fontSize="10"
              fontFamily="sans-serif"
              textAnchor="middle"
              dominantBaseline="middle"
              className="uppercase tracking-widest"
            >
              {AXIS_LABELS[i]}
            </text>
          );
        })}

        {/* Data Polygon with Framer Motion and Glow Filter */}
        <motion.polygon
          initial={{ points: getPointsString(Array(6).fill(0)) }}
          animate={{ points: dataPoints }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
          fill="url(#neon-gradient)"
          fillOpacity="0.3"
          stroke="url(#neon-gradient)"
          strokeWidth="2"
          filter="url(#glow)"
        />
        {/* Core solid line overlay */}
        <motion.polygon
          initial={{ points: getPointsString(Array(6).fill(0)) }}
          animate={{ points: dataPoints }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
          fill="none"
          stroke="#fff"
          strokeWidth="1"
          strokeOpacity="0.5"
        />
      </svg>
    </div>
  );
}
