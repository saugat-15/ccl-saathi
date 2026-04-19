"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: "#22c55e",
  MEDIUM: "#f59e0b",
  HARD: "#ef4444",
};

export default function HomePage() {
  const router = useRouter();
  const { signOut, user } = useAuthenticator();
  const [dialogues, setDialogues] = useState<Array<Schema["Dialogue"]["type"]>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const sub = client.models.Dialogue.observeQuery().subscribe({
      next: (data) => {
        const active = data.items
          .filter((d) => d.isActive !== false)
          .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
        setDialogues(active);
        setIsLoading(false);
      },
    });
    return () => sub.unsubscribe();
  }, []);

  function formatDuration(secs: number | null | undefined) {
    if (!secs) return null;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>CCLSaathi</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#6b7280", fontSize: "0.9rem" }}>
            NAATI CCL Practice Platform
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>{user?.signInDetails?.loginId}</span>
          <button
            onClick={signOut}
            style={{ padding: "0.4rem 0.9rem", borderRadius: 6, border: "1px solid #d1d5db", background: "white", cursor: "pointer", fontSize: "0.85rem" }}
          >
            Sign out
          </button>
        </div>
      </header>

      <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>Available Dialogues</h2>

      {isLoading ? (
        <p style={{ color: "#6b7280" }}>Loading dialogues...</p>
      ) : dialogues.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No dialogues available yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {dialogues.map((d) => (
            <li
              key={d.id}
              onClick={() => router.push(`/practice/${d.id}`)}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "1rem 1.25rem",
                cursor: "pointer",
                background: "white",
                transition: "box-shadow 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>{d.title}</h3>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "white",
                    background: DIFFICULTY_COLORS[d.difficulty ?? "EASY"] ?? "#6b7280",
                    borderRadius: 4,
                    padding: "0.2rem 0.5rem",
                    flexShrink: 0,
                    marginLeft: "0.5rem",
                  }}
                >
                  {d.difficulty}
                </span>
              </div>
              {d.description && (
                <p style={{ margin: "0.35rem 0 0", fontSize: "0.875rem", color: "#6b7280" }}>{d.description}</p>
              )}
              <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", fontSize: "0.8rem", color: "#9ca3af" }}>
                {d.category && <span>{d.category.replace(/_/g, " ")}</span>}
                {d.segmentCount && <span>{d.segmentCount} segments</span>}
                {formatDuration(d.durationSeconds) && <span>{formatDuration(d.durationSeconds)}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
