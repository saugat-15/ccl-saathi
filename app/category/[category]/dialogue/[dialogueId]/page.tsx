"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { generateClient } from "aws-amplify/data";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, Loader2 } from "lucide-react";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

type AttemptRow = {
  id: string;
  createdAt: string | null;
  status: string | null;
  overallScore: number | null;
};

function toLabel(s: string) {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function decodeDialogueId(encoded: string): string {
  return atob(decodeURIComponent(encoded));
}

function fmtDate(value: string | null): string {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function DialogueAttemptsPage({
  params,
}: {
  params: { category: string; dialogueId: string };
}) {
  const router = useRouter();
  const category = params.category;
  const dialogueBasePath = useMemo(() => decodeDialogueId(params.dialogueId), [params.dialogueId]);

  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const recordingsResult = await client.models.Recording.list({
          filter: { dialogueId: { eq: dialogueBasePath } },
          limit: 100,
        });
        console.log("recordingsResult", recordingsResult);
        if (recordingsResult.errors) {
          throw new Error("Failed to load attempts.");
        }

        const feedbackResult = await client.models.Feedback.list({
          filter: { dialogueId: { eq: dialogueBasePath } },
          limit: 100,
        });
        console.log({ feedbackResult });
        if (feedbackResult.errors) {
          throw new Error("Failed to load feedback.");
        }

        const feedbackByRecording = new Map<string, number>();
        for (const fb of feedbackResult.data) {
          if (typeof fb.recordingId !== "string") continue;
          if (typeof fb.overallScore === "number") {
            feedbackByRecording.set(fb.recordingId, fb.overallScore);
          }
        }

        const next: AttemptRow[] = recordingsResult.data
          .map((recording) => ({
            id: recording.id,
            createdAt: recording.createdAt ?? null,
            status: recording.status ?? null,
            overallScore: feedbackByRecording.get(recording.id) ?? null,
          }))
          .sort((a, b) => {
            const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bt - at;
          });

        console.log("next", next);

        if (!cancelled) setAttempts(next);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load attempts.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [dialogueBasePath]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-5 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/category/${category}`)}
          className="gap-1.5 -ml-2 mb-5 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {toLabel(category)} dialogues
        </Button>

        <div className="mb-6">
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: "var(--amber-700)",
              background: "var(--amber-50)",
              padding: "4px 8px",
              borderRadius: 4,
            }}
          >
            Attempt History
          </span>
          <h1 className="font-serif text-2xl font-semibold text-foreground mt-3 mb-1">
            {toLabel(category)} dialogue attempts
          </h1>
          <p className="text-sm text-muted-foreground">Track attempts and open detailed feedback reports.</p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <Button onClick={() => router.push(`/practice/${encodeURIComponent(btoa(dialogueBasePath))}`)}>
            Start New Attempt
          </Button>
        </div>

        <Separator className="mb-6" />

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading attempts…
          </div>
        ) : loadError ? (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
            {loadError}
          </p>
        ) : attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No attempts yet. Start your first attempt.</p>
        ) : (
          <ul className="grid gap-3">
            {attempts.map((attempt, idx) => (
              <li key={attempt.id}>
                <div
                  onClick={() =>
                    router.push(
                      `/category/${category}/dialogue/${encodeURIComponent(btoa(dialogueBasePath))}/attempt/${attempt.id}`,
                    )
                  }
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 12,
                    padding: "14px 16px",
                    cursor: "pointer",
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, color: "var(--fg-strong)", fontSize: 14 }}>
                      Attempt #{attempts.length - idx}
                    </p>
                    <p style={{ margin: "4px 0 0", color: "var(--fg-muted)", fontSize: 12 }}>
                      {fmtDate(attempt.createdAt)}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, color: "var(--fg-muted)", fontSize: 12 }}>
                      {attempt.status ?? "Unknown"}
                    </p>
                    <p style={{ margin: "4px 0 0", color: "var(--brand)", fontWeight: 600, fontSize: 13 }}>
                      {typeof attempt.overallScore === "number"
                        ? `Score ${Math.round(attempt.overallScore)}`
                        : "No score yet"}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
