"use client";

import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
Amplify.configure(outputs, { ssr: true });

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { generateClient } from "aws-amplify/data";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, Loader2, FileText } from "lucide-react";
import type { Schema } from "@/amplify/data/resource";
import { cn } from "@/lib/utils";
import ScoreReport, { type FeedbackDetails } from "@/app/components/attempt/ScoreReport";

const client = generateClient<Schema>();

type RecordingItem = {
  id: string;
  createdAt: string | null | undefined;
  status: string | null | undefined;
};

type FeedbackItem = {
  recordingId: string;
  overallScore: number | null | undefined;
  accuracyScore: number | null | undefined;
  completenessScore: number | null | undefined;
  terminologyScore: number | null | undefined;
  fluencyScore: number | null | undefined;
  strengths: (string | null)[] | null | undefined;
  suggestions: (string | null)[] | null | undefined;
  missedTerms: (string | null)[] | null | undefined;
  criticalErrors: unknown;
  gradedSegments: unknown;
  examReadinessLevel: string | null | undefined;
  examReadinessReason: string | null | undefined;
};

function toLabel(s: string) {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function decodeDialogueId(encoded: string): string {
  return atob(decodeURIComponent(encoded));
}

function fmtDate(value: string | null | undefined): string {
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

function feedbackToDetails(fb: FeedbackItem): FeedbackDetails {
  return {
    overallScore: fb.overallScore ?? null,
    accuracyScore: fb.accuracyScore ?? null,
    completenessScore: fb.completenessScore ?? null,
    terminologyScore: fb.terminologyScore ?? null,
    fluencyScore: fb.fluencyScore ?? null,
    strengths: (fb.strengths ?? []).filter((s): s is string => typeof s === "string"),
    suggestions: (fb.suggestions ?? []).filter((s): s is string => typeof s === "string"),
    missedTerms: (fb.missedTerms ?? []).filter((s): s is string => typeof s === "string"),
    criticalErrors: parseJsonArray<{ segmentIndex?: number; type?: string; impact?: string }>(
      fb.criticalErrors,
    ),
    gradedSegments: parseJsonArray<{ segmentIndex?: number; segmentAccuracy?: number; comment?: string }>(
      fb.gradedSegments,
    ),
    examReadinessLevel: fb.examReadinessLevel ?? null,
    examReadinessReason: fb.examReadinessReason ?? null,
  };
}

export default function DialogueAttemptsPage({
  params,
}: {
  params: { category: string; dialogueId: string };
}) {
  const router = useRouter();
  const category = params.category;
  const dialogueBasePath = useMemo(() => decodeDialogueId(params.dialogueId), [params.dialogueId]);

  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Subscribe to recordings for this dialogue
  useEffect(() => {
    const sub = client.models.Recording.observeQuery({
      filter: { dialogueId: { eq: dialogueBasePath } },
    }).subscribe({
      next: ({ items, isSynced }) => {
        setRecordings(
          [...items].sort((a, b) => {
            const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bt - at;
          }),
        );
        if (isSynced) setIsLoading(false);
      },
      error: () => {
        setLoadError("Failed to load attempts.");
        setIsLoading(false);
      },
    });
    return () => sub.unsubscribe();
  }, [dialogueBasePath]);

  // Subscribe to feedback for this dialogue
  useEffect(() => {
    const sub = client.models.Feedback.observeQuery({
      filter: { dialogueId: { eq: dialogueBasePath } },
    }).subscribe({
      next: ({ items }) => {
        setFeedbacks(
          items
            .filter((fb): fb is typeof fb & { recordingId: string } =>
              typeof fb.recordingId === "string",
            )
            .map((fb) => ({
              recordingId: fb.recordingId,
              overallScore: fb.overallScore,
              accuracyScore: fb.accuracyScore,
              completenessScore: fb.completenessScore,
              terminologyScore: fb.terminologyScore,
              fluencyScore: fb.fluencyScore,
              strengths: fb.strengths,
              suggestions: fb.suggestions,
              missedTerms: fb.missedTerms,
              criticalErrors: fb.criticalErrors,
              gradedSegments: fb.gradedSegments,
              examReadinessLevel: fb.examReadinessLevel,
              examReadinessReason: fb.examReadinessReason,
            })),
        );
      },
    });
    return () => sub.unsubscribe();
  }, [dialogueBasePath]);

  // Derive attempt rows from live recordings + feedbacks
  const attempts = useMemo(() => {
    const scoreByRecording = new Map(
      feedbacks
        .filter((fb): fb is FeedbackItem & { overallScore: number } =>
          typeof fb.overallScore === "number",
        )
        .map((fb) => [fb.recordingId, fb.overallScore]),
    );
    return recordings.map((r) => ({
      id: r.id,
      createdAt: r.createdAt ?? null,
      status: r.status ?? null,
      overallScore: scoreByRecording.get(r.id) ?? null,
    }));
  }, [recordings, feedbacks]);

  // Derive selected attempt's status and details from live data
  const selectedRecording = useMemo(
    () => recordings.find((r) => r.id === selectedId) ?? null,
    [recordings, selectedId],
  );
  const selectedFeedback = useMemo(
    () => feedbacks.find((fb) => fb.recordingId === selectedId) ?? null,
    [feedbacks, selectedId],
  );
  const selectedDetails = useMemo(
    () => (selectedFeedback ? feedbackToDetails(selectedFeedback) : null),
    [selectedFeedback],
  );

  const processingStatuses = new Set(["UPLOADED", "PROCESSING", "SCORING"]);
  const selectedStatus = selectedRecording?.status ?? null;
  const isProcessing = selectedStatus !== null && processingStatuses.has(selectedStatus);

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
                const isPending = attempt.overallScore === null &&
                  attempt.status !== null &&
                  processingStatuses.has(attempt.status);

                return (
                  <li key={attempt.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(attempt.id)}
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
                          ) : isPending ? (
                            <Loader2
                              className="h-3.5 w-3.5 animate-spin"
                              style={{ color: "var(--fg-subtle)" }}
                            />
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
              ) : selectedDetails !== null ? (
                <ScoreReport details={selectedDetails} />
              ) : isProcessing ? (
                <div
                  className="rounded-xl border px-6 py-10 flex flex-col items-center justify-center gap-3 text-center"
                  style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
                >
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                    {selectedStatus === "SCORING" ? "Scoring your interpretation…" : "Processing your recording…"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                    This page will update automatically.
                  </p>
                </div>
              ) : (
                <div
                  className="rounded-xl border px-6 py-10 text-center"
                  style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
                >
                  <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                    {selectedStatus === "FAILED"
                      ? "Processing failed. Please try a new attempt."
                      : "Feedback not ready yet."}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
