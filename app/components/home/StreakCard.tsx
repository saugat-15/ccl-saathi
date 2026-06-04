"use client";

import { useStreak } from "@/hooks/useStreak";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  userId: string | null;
};

/** Returns the last `days` dates as YYYY-MM-DD strings (UTC), oldest first. */
function lastNDays(days: number): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

export default function StreakCard({ userId }: Props) {
  const { data, isLoading } = useStreak(userId);

  if (!userId) return null;

  const cardStyle = {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-subtle)",
    borderRadius: 10,
    padding: "10px 16px",
  } as const;

  if (isLoading) {
    return (
      <div className="w-full flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3.5" style={cardStyle}>
        <div className="flex items-center justify-between gap-3 sm:justify-start">
          <Skeleton className="h-4 w-28 shrink-0" />
          <Skeleton className="h-4 w-14 shrink-0 sm:hidden" />
        </div>
        <div className="flex items-center justify-between gap-3 sm:flex-1 sm:min-w-0">
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="h-2 w-2 rounded-full shrink-0" />
            ))}
          </div>
          <Skeleton className="h-4 w-14 shrink-0 hidden sm:block" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { currentStreak, longestStreak, isSuperUser, loginDates } = data;
  const loginSet = new Set(loginDates);
  const week = lastNDays(7);

  const bestLabel = (
    <>
      Best:{" "}
      <span style={{ fontWeight: 600, color: "var(--fg-default)", fontFamily: "var(--font-mono)" }}>
        {longestStreak}
      </span>
    </>
  );

  const bestStyle = {
    fontSize: 12,
    color: "var(--fg-muted)",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  };

  return (
    <div className="w-full flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3.5 sm:gap-y-2" style={cardStyle}>
      <div className="flex items-center justify-between gap-3 sm:contents">
        <span style={{
          fontSize: 13, fontWeight: 600, color: "var(--fg-strong)",
          whiteSpace: "nowrap", flexShrink: 0,
        }}>
          🔥 {currentStreak} day streak
        </span>
        <span className="sm:hidden" style={bestStyle}>
          {bestLabel}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 sm:flex-1 sm:min-w-0">
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {week.map((date) => (
            <div
              key={date}
              title={date}
              style={{
                width: 8, height: 8, borderRadius: "50%",
                background: loginSet.has(date) ? "var(--progress-fill)" : "var(--border-default)",
                opacity: loginSet.has(date) ? 1 : 0.5,
              }}
            />
          ))}
        </div>
        <span className="hidden sm:block sm:ml-auto" style={bestStyle}>
          {bestLabel}
        </span>
      </div>

      {isSuperUser && (
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
          color: "var(--brand)",
          background: "color-mix(in srgb, var(--brand) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--brand) 30%, transparent)",
          borderRadius: 6, padding: "2px 8px", flexShrink: 0,
        }}>
          ⭐ Super User
        </span>
      )}
    </div>
  );
}
