'use client';

interface MetricBarProps {
  value: number;
  max: number;
  color: string;
  height?: string;
}

export default function MetricBar({ value, max, color, height = 'h-1.5' }: MetricBarProps) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className={`w-full rounded-full bg-zinc-800 ${height}`}>
      <div
        className={`rounded-full ${color} ${height}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
