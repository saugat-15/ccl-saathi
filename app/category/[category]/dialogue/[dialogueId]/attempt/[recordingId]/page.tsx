"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { generateClient } from "aws-amplify/data";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, Loader2 } from "lucide-react";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

type FeedbackDetails = {
  overallScore: number | null;
  accuracyScore: number | null;
  completenessScore: number | null;
  terminologyScore: number | null;
  fluencyScore: number | null;
  strengths: string[];
  suggestions: string[];
  missedTerms: string[];
  criticalErrors: Array<{ segmentIndex?: number; type?: string; impact?: string }>;
  gradedSegments: Array<{ segmentIndex?: number; segmentAccuracy?: number; comment?: string }>;
  examReadinessLevel: string | null;
  examReadinessReason: string | null;
};

function decodeDialogueId(encoded: string): string {
  return atob(decodeURIComponent(encoded));
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

export default function AttemptDetailPage({
  params,
}: {
  params: { category: string; dialogueId: string; recordingId: string };
}) {
  const router = useRouter();
  const category = params.category;
  const dialogueBasePath = useMemo(() => decodeDialogueId(params.dialogueId), [params.dialogueId]);
  const recordingId = params.recordingId;

  const [status, setStatus] = useState<string | null>(null);
  const [details, setDetails] = useState<FeedbackDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const recordingResult = await client.models.Recording.get({ id: recordingId });
        if (recordingResult.errors || !recordingResult.data) {
          throw new Error("Could not load attempt record.");
        }
        if (!cancelled) setStatus(recordingResult.data.status ?? null);

        const feedbackResult = await client.models.Feedback.list({
          filter: { recordingId: { eq: recordingId } },
        });
        if (feedbackResult.errors) {
          throw new Error("Could not load feedback details.");
        }
        const feedback = feedbackResult.data[0];
        if (!feedback) {
          if (!cancelled) setDetails(null);
          return;
        }

        const parsed: FeedbackDetails = {
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
        };
        if (!cancelled) setDetails(parsed);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load feedback.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [recordingId]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-5 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            router.push(`/category/${category}/dialogue/${encodeURIComponent(btoa(dialogueBasePath))}`)
          }
          className="gap-1.5 -ml-2 mb-5 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Attempt history
        </Button>

        <div className="mb-6">
          <h1 className="font-serif text-2xl font-semibold text-foreground mt-1 mb-1">Detailed Feedback Report</h1>
          <p className="text-sm text-muted-foreground">Attempt ID: {recordingId}</p>
        </div>
        <Separator className="mb-6" />

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading report…
          </div>
        ) : loadError ? (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
            {loadError}
          </p>
        ) : !details ? (
          <p className="text-sm text-muted-foreground py-4">
            Feedback is not ready yet. Current status: {status ?? "Unknown"}.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 14 }}>
              <p style={{ margin: 0, fontWeight: 600, color: "var(--fg-strong)" }}>Overall Score</p>
              <p style={{ margin: "6px 0 0", color: "var(--brand)", fontSize: 28, fontWeight: 700 }}>
                {details.overallScore !== null ? Math.round(details.overallScore) : "--"}
              </p>
              <p style={{ margin: "8px 0 0", color: "var(--fg-muted)", fontSize: 12 }}>
                Accuracy {details.accuracyScore ?? "--"} · Completeness {details.completenessScore ?? "--"} ·
                Terminology {details.terminologyScore ?? "--"} · Fluency {details.fluencyScore ?? "--"}
              </p>
            </div>

            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 14 }}>
              <p style={{ margin: "0 0 8px", fontWeight: 600, color: "var(--fg-strong)" }}>Strengths</p>
              <p style={{ margin: 0, color: "var(--fg-muted)", fontSize: 13 }}>
                {details.strengths.length > 0 ? details.strengths.join(" • ") : "—"}
              </p>
            </div>

            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 14 }}>
              <p style={{ margin: "0 0 8px", fontWeight: 600, color: "var(--fg-strong)" }}>Priority Improvements</p>
              <p style={{ margin: 0, color: "var(--fg-muted)", fontSize: 13 }}>
                {details.suggestions.length > 0 ? details.suggestions.join(" • ") : "—"}
              </p>
            </div>

            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 14 }}>
              <p style={{ margin: "0 0 8px", fontWeight: 600, color: "var(--fg-strong)" }}>Missed Terms</p>
              <p style={{ margin: 0, color: "var(--fg-muted)", fontSize: 13 }}>
                {details.missedTerms.length > 0 ? details.missedTerms.join(", ") : "None"}
              </p>
            </div>

            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 14 }}>
              <p style={{ margin: "0 0 8px", fontWeight: 600, color: "var(--fg-strong)" }}>Critical Errors</p>
              {details.criticalErrors.length === 0 ? (
                <p style={{ margin: 0, color: "var(--fg-muted)", fontSize: 13 }}>None</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, color: "var(--fg-muted)", fontSize: 13 }}>
                  {details.criticalErrors.slice(0, 8).map((item, idx) => (
                    <li key={`${item.segmentIndex ?? "s"}-${idx}`}>
                      Segment {item.segmentIndex ?? "?"}: {item.type ?? "issue"} — {item.impact ?? ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 14 }}>
              <p style={{ margin: "0 0 8px", fontWeight: 600, color: "var(--fg-strong)" }}>Exam Readiness</p>
              <p style={{ margin: "0 0 6px", color: "var(--fg-default)", fontSize: 13 }}>
                {details.examReadinessLevel ?? "—"}
              </p>
              <p style={{ margin: 0, color: "var(--fg-muted)", fontSize: 13 }}>
                {details.examReadinessReason ?? "—"}
              </p>
            </div>

            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 14 }}>
              <p style={{ margin: "0 0 8px", fontWeight: 600, color: "var(--fg-strong)" }}>Segment Feedback</p>
              {details.gradedSegments.length === 0 ? (
                <p style={{ margin: 0, color: "var(--fg-muted)", fontSize: 13 }}>No segment details available.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, color: "var(--fg-muted)", fontSize: 13 }}>
                  {details.gradedSegments.slice(0, 12).map((seg, idx) => (
                    <li key={`${seg.segmentIndex ?? "g"}-${idx}`}>
                      Segment {seg.segmentIndex ?? "?"}: {seg.segmentAccuracy ?? "--"} — {seg.comment ?? ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
