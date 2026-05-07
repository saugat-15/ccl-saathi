"use client";

import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
Amplify.configure(outputs, { ssr: true });

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, FileText } from "lucide-react";
import type { Schema } from "@/amplify/data/resource";
import { cn } from "@/lib/utils";
import ScoreReport, { type FeedbackDetails } from "@/app/components/attempt/ScoreReport";
import { ScoreReportSkeleton } from "@/app/components/attempt/ScoreReportSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

const client = generateClient<Schema>();

type RecordingItem = {
  id: string;
  createdAt: string | null | undefined;
  status: string | null | undefined;
  errorMessage: string | null | undefined;
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
  if (score >= 70) return "var(--score-high)";
  if (score >= 50) return "var(--score-mid)";
  return "var(--score-low)";
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

  const [userId, setUserId] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser().then(({ userId: uid }) => setUserId(uid)).catch(() => setUserId(null));
  }, []);

  // Subscribe to recordings for this dialogue
  useEffect(() => {
    if (!userId) return;
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
  }, [dialogueBasePath, userId]);

  // Subscribe to feedback for this dialogue
  useEffect(() => {
    if (!userId) return;
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
  }, [dialogueBasePath, userId]);

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
      errorMessage: r.errorMessage ?? null,
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

  const STALE_MS = 10 * 60 * 1000;
  function isStale(createdAt: string | null | undefined) {
    if (!createdAt) return false;
    return Date.now() - new Date(createdAt).getTime() > STALE_MS;
  }

  const isProcessing =
    selectedStatus !== null &&
    processingStatuses.has(selectedStatus) &&
    !isStale(selectedRecording?.createdAt);

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
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
            <ul className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <li key={i}>
                  <Skeleton className="h-[76px] w-full rounded-xl" />
                </li>
              ))}
            </ul>
            <ScoreReportSkeleton />
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
                  processingStatuses.has(attempt.status) &&
                  !isStale(attempt.createdAt);

                return (
                  <li key={attempt.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(attempt.id)}
                      className={cn(
                        "w-full text-left rounded-xl px-4 py-3 border transition-all",
                        isSelected
                          ? "border-[color:var(--progress-fill)]"
                          : "border-[color:var(--border-subtle)] hover:border-[color:var(--border-default)]",
                      )}
                      style={{
                        background: isSelected
                          ? "color-mix(in srgb, var(--progress-fill) 12%, transparent)"
                          : "var(--bg-surface)",
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
                          {attempt.status === "FAILED" && attempt.errorMessage && (
                            <p className="text-xs mt-1 text-destructive">
                              {attempt.errorMessage}
                            </p>
                          )}
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
                            <Skeleton className="h-4 w-7 rounded-md ml-auto" />
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
                <ScoreReportSkeleton
                  caption={
                    selectedStatus === "SCORING"
                      ? "Scoring your interpretation…"
                      : "Processing your recording…"
                  }
                  subCaption="This page will update automatically."
                />
              ) : selectedStatus !== null && processingStatuses.has(selectedStatus) && isStale(selectedRecording?.createdAt) ? (
                <div
                  className="rounded-xl border px-6 py-10 text-center"
                  style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
                >
                  <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                    Processing timed out. Please start a new attempt.
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
