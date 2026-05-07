"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useScoreHistory } from "@/hooks/useScoreHistory";
import { Skeleton } from "@/components/ui/skeleton";

const chartConfig = {
  score: {
    label: "Overall Score",
    color: "var(--forest-500)",
  },
} satisfies ChartConfig;

type Props = {
  userId: string | null;
};

export default function ScoreChart({ userId }: Props) {
  const { data, isLoading } = useScoreHistory(userId);

  if (isLoading) {
    return (
      <div style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        padding: "18px 20px 14px",
        marginBottom: 28,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-5 w-10" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-5 w-10" />
            </div>
          </div>
        </div>
        <Skeleton className="h-[140px] w-full rounded-md" />
      </div>
    );
  }

  if (data.length === 0) return null;

  const avg = Math.round(data.reduce((s, d) => s + d.score, 0) / data.length);
  const latest = data[data.length - 1].score;
  const trend = data.length >= 2 ? latest - data[data.length - 2].score : 0;

  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 12,
      padding: "18px 20px 14px",
      marginBottom: 28,
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 14,
        gap: 12,
      }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-strong)", margin: "0 0 2px" }}>
            Score History
          </p>
          <p style={{ fontSize: 11, color: "var(--fg-muted)", margin: 0 }}>
            {data.length} scored attempt{data.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
          <Stat label="Latest" value={latest} trend={trend} />
          <Stat label="Average" value={avg} />
        </div>
      </div>

      {/* Chart */}
      <ChartContainer config={chartConfig} style={{ height: 140, width: "100%" }}>
        <AreaChart data={data} margin={{ top: 6, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--forest-500)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--forest-500)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            vertical={false}
            stroke="var(--border-subtle)"
            strokeDasharray="3 3"
          />

          {/* Pass threshold */}
          <ReferenceLine
            y={70}
            stroke="var(--fg-subtle)"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{
              value: "Pass 70",
              position: "insideTopRight",
              fontSize: 9,
              fill: "var(--fg-subtle)",
              dy: -4,
            }}
          />

          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "var(--fg-muted)" }}
            tickFormatter={(v: string) => {
              const d = new Date(v);
              return `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`;
            }}
          />

          <YAxis
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "var(--fg-muted)" }}
            tickCount={4}
          />

          <ChartTooltip
            cursor={{ stroke: "var(--border-default)", strokeWidth: 1 }}
            content={
              <ChartTooltipContent
                formatter={(value) => [
                  <span key="val" style={{ fontWeight: 600, color: "var(--fg-strong)" }}>
                    {value}
                  </span>,
                  "Score",
                ]}
              />
            }
          />

          <Area
            type="monotone"
            dataKey="score"
            stroke="var(--forest-500)"
            strokeWidth={2}
            fill="url(#scoreGradient)"
            dot={data.length <= 10}
            activeDot={{ r: 4, fill: "var(--forest-500)", stroke: "var(--bg-surface)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

function Stat({ label, value, trend }: { label: string; value: number; trend?: number }) {
  const color =
    value >= 70 ? "var(--score-high)" : value >= 50 ? "var(--score-mid)" : "var(--score-low)";

  return (
    <div style={{ textAlign: "right" }}>
      <p style={{ fontSize: 11, color: "var(--fg-muted)", margin: "0 0 1px" }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 700, color, margin: 0, fontFamily: "var(--font-mono)" }}>
        {value}
        {trend !== undefined && trend !== 0 && (
          <span style={{
            fontSize: 10,
            fontWeight: 500,
            color: trend > 0 ? "var(--score-high)" : "var(--score-low)",
            marginLeft: 3,
          }}>
            {trend > 0 ? `+${trend}` : trend}
          </span>
        )}
      </p>
    </div>
  );
}
