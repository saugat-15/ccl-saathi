"use client";

import { useStreak } from "@/hooks/useStreak";

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

  if (isLoading || !data) return null;

  const { currentStreak, longestStreak, isSuperUser, loginDates } = data;
  const loginSet = new Set(loginDates);
  const week = lastNDays(7);

  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 10,
      padding: "10px 16px",
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}>
      {/* Streak count */}
      <span style={{
        fontSize: 13, fontWeight: 600, color: "var(--fg-strong)",
        whiteSpace: "nowrap", flexShrink: 0,
      }}>
        🔥 {currentStreak} day streak
      </span>

      {/* 7-day dots */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {week.map((date) => (
          <div
            key={date}
            title={date}
            style={{
              width: 8, height: 8, borderRadius: "50%",
              background: loginSet.has(date) ? "var(--brand)" : "var(--border-default)",
              opacity: loginSet.has(date) ? 1 : 0.5,
            }}
          />
        ))}
      </div>

      {/* Best */}
      <span style={{
        fontSize: 12, color: "var(--fg-muted)",
        marginLeft: "auto", whiteSpace: "nowrap", flexShrink: 0,
      }}>
        Best:{" "}
        <span style={{ fontWeight: 600, color: "var(--fg-default)", fontFamily: "var(--font-mono)" }}>
          {longestStreak}
        </span>
      </span>

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
