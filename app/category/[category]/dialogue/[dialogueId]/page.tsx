"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { generateClient } from "aws-amplify/data";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, Loader2, FileText } from "lucide-react";
import type { Schema } from "@/amplify/data/resource";
import { cn } from "@/lib/utils";
import ScoreReport, { type FeedbackDetails } from "@/app/components/attempt/ScoreReport";

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

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getScoreColor(score: number): string {
  if (score >= 70) return "var(--success)";
  if (score >= 50) return "var(--warning)";
  return "var(--danger)";
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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<FeedbackDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsStatus, setDetailsStatus] = useState<string | null>(null);

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
        if (recordingsResult.errors) throw new Error("Failed to load attempts.");

        const feedbackResult = await client.models.Feedback.list({
          filter: { dialogueId: { eq: dialogueBasePath } },
          limit: 100,
        });
        if (feedbackResult.errors) throw new Error("Failed to load feedback.");

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

        if (!cancelled) setAttempts(next);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load attempts.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [dialogueBasePath]);

  const selectAttempt = useCallback(async (id: string) => {
    if (id === selectedId) return;
    setSelectedId(id);
    setSelectedDetails(null);
    setDetailsError(null);
    setDetailsStatus(null);
    setIsLoadingDetails(true);
    try {
      const recordingResult = await client.models.Recording.get({ id });
      if (!recordingResult.errors && recordingResult.data) {
        setDetailsStatus(recordingResult.data.status ?? null);
      }

      const feedbackResult = await client.models.Feedback.list({
        filter: { recordingId: { eq: id } },
      });
      if (feedbackResult.errors) throw new Error("Could not load feedback.");
      const feedback = feedbackResult.data[0];
      if (!feedback) return;

      setSelectedDetails({
        overallScore: feedback.overallScore ?? null,
        accuracyScore: feedback.accuracyScore ?? null,
        completenessScore: feedback.completenessScore ?? null,
        terminologyScore: feedback.terminologyScore ?? null,
        fluencyScore: feedback.fluencyScore ?? null,
        strengths: (feedback.strengths ?? []).filter((s): s is string => typeof s === "string"),
        suggestions: (feedback.suggestions ?? []).filter((s): s is string => typeof s === "string"),
        missedTerms: (feedback.missedTerms ?? []).filter((s): s is string => typeof s === "string"),
        criticalErrors: parseJsonArray<{ segmentIndex?: number; type?: string; impact?: string }>(
          feedback.criticalErrors,
        ),
        gradedSegments: parseJsonArray<{ segmentIndex?: number; segmentAccuracy?: number; comment?: string }>(
          feedback.gradedSegments,
        ),
        examReadinessLevel: feedback.examReadinessLevel ?? null,
        examReadinessReason: feedback.examReadinessReason ?? null,
      });
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "Failed to load feedback.");
    } finally {
      setIsLoadingDetails(false);
    }
  }, [selectedId]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-5 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/category/${category}`)}
          className="gap-1.5 -ml-2 mb-5 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {toLabel(category)} dialogues
        </Button>

        <div className="mb-5">
          <span
            className="inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
            style={{ color: "var(--amber-700)", background: "var(--amber-50)" }}
          >
            Attempt History
          </span>
          <h1 className="font-serif text-2xl font-semibold text-foreground mt-3 mb-1">
            {toLabel(category)} dialogue attempts
          </h1>
          <p className="text-sm text-muted-foreground">
            Select an attempt to view the AI score report.
          </p>
        </div>

        <div className="mb-5">
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
          <p className="text-sm text-muted-foreground py-4">
            No attempts yet. Start your first attempt.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
            {/* ── Attempts list ── */}
            <ul className="flex flex-col gap-2">
              {attempts.map((attempt, idx) => {
                const isSelected = selectedId === attempt.id;
                const scoreColor = typeof attempt.overallScore === "number"
                  ? getScoreColor(attempt.overallScore)
                  : "var(--fg-muted)";

                return (
                  <li key={attempt.id}>
                    <button
                      type="button"
                      onClick={() => void selectAttempt(attempt.id)}
                      className={cn(
                        "w-full text-left rounded-xl px-4 py-3 border transition-all",
                        isSelected
                          ? "border-[color:var(--brand)]"
                          : "border-[color:var(--border-subtle)] hover:border-[color:var(--border-default)]",
                      )}
                      style={{
                        background: isSelected ? "var(--brand-soft)" : "var(--bg-surface)",
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            className="text-sm font-semibold leading-tight"
                            style={{ color: "var(--fg-strong)" }}
                          >
                            Attempt #{attempts.length - idx}
                          </p>
                          <p
                            className="text-xs mt-0.5 truncate"
                            style={{ color: "var(--fg-muted)" }}
                          >
                            {fmtDate(attempt.createdAt)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {typeof attempt.overallScore === "number" ? (
                            <span
                              className="text-sm font-bold font-mono"
                              style={{ color: scoreColor }}
                            >
                              {Math.round(attempt.overallScore)}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                              {attempt.status ?? "—"}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* ── Report panel ── */}
            <div className="lg:sticky lg:top-6">
              {selectedId === null ? (
                <div
                  className="rounded-xl border flex flex-col items-center justify-center gap-3 py-16 text-center"
                  style={{
                    borderColor: "var(--border-subtle)",
                    background: "var(--bg-surface)",
                    borderStyle: "dashed",
                  }}
                >
                  <FileText
                    className="h-8 w-8 opacity-30"
                    style={{ color: "var(--fg-muted)" }}
                  />
                  <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                    Select an attempt to view its report
                  </p>
                </div>
              ) : isLoadingDetails ? (
                <div
                  className="rounded-xl border px-6 py-10 flex items-center justify-center gap-2"
                  style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
                >
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading report…</span>
                </div>
              ) : detailsError ? (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
                  {detailsError}
                </p>
              ) : selectedDetails === null ? (
                <div
                  className="rounded-xl border px-6 py-10 text-center"
                  style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
                >
                  <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                    Feedback not ready yet.
                    {detailsStatus ? ` Status: ${detailsStatus}.` : ""}
                  </p>
                </div>
              ) : (
                <ScoreReport details={selectedDetails} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
