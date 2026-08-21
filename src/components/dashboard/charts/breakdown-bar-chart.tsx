"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPaise } from "@/lib/domain/money";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

interface BreakdownBarChartProps {
  data: Record<string, string | number>[];
  categoryKey: string;
  series: ChartSeries[];
}

function formatRupees(value: number): string {
  return formatPaise(BigInt(Math.round(value * 100)));
}

export function BreakdownBarChart({
  data,
  categoryKey,
  series,
}: BreakdownBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--hairline)"
          vertical={false}
        />
        <XAxis
          dataKey={categoryKey}
          tick={{ fontSize: 11, fill: "var(--ink-muted)" }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--ink-muted)" }}
          axisLine={false}
          tickLine={false}
          width={72}
          tickFormatter={(value: number) => formatRupees(value)}
        />
        <Tooltip
          formatter={(value, name) => [formatRupees(Number(value)), name]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 4,
            border: "1px solid var(--border)",
          }}
        />
        {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
        {series.map((item) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.label}
            fill={item.color}
            radius={[2, 2, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
