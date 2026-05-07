"use client";

import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
Amplify.configure(outputs, { ssr: true });

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { list, downloadData } from "aws-amplify/storage";
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft } from "lucide-react";
import type { Schema } from "@/amplify/data/resource";

type DialogueEntry = {
  basePath: string;
  audioPath: string;
  transcriptPath: string | null;
  label: string;
  scenario: string | null;
  segmentCount: number | null;
};

type DialogueProgress = {
  attempted: boolean;
  completedCount: number;
  latestOverallScore: number | null;
};

const client = generateClient<Schema>();

function toLabel(s: string) {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CategoryPage({ params }: { params: { category: string } }) {
  const router = useRouter();
  const { category } = params;
  const categoryLabel = toLabel(category);

  const [dialogues, setDialogues] = useState<DialogueEntry[]>([]);
  const [dialogueProgress, setDialogueProgress] = useState<Record<string, DialogueProgress>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { userId } = await getCurrentUser();
        console.log('userId', userId);
        const { items } = await list({ path: `dialogues/${category}/`, options: { listAll: true } });

        const topLevel = items.filter((item) => item.path.split("/").length === 3 && item.path.split("/")[2]);
        const jsonPaths = topLevel.filter((item) => item.path.endsWith(".json")).map((item) => item.path);

        const map = new Map<string, { audioPath?: string; transcriptPath?: string }>();
        for (const item of topLevel) {
          const filename = item.path.split("/")[2];
          const dotIdx = filename.lastIndexOf(".");
          const ext = dotIdx >= 0 ? filename.slice(dotIdx + 1).toLowerCase() : "";
          const stem = dotIdx >= 0 ? filename.slice(0, dotIdx) : filename;
          const basePath = `dialogues/${category}/${stem}`;
          if (!map.has(basePath)) map.set(basePath, {});
          const entry = map.get(basePath)!;
          if (["mp3", "wav", "m4a", "webm"].includes(ext)) entry.audioPath = item.path;
          else if (ext === "json") entry.transcriptPath = item.path;
        }

        const entries = Array.from(map.entries())
          .filter(([, e]) => e.audioPath)
          .map(([basePath, e]) => ({
            basePath,
            audioPath: e.audioPath!,
            // fall back to any JSON in the folder if no stem-matched JSON exists
            transcriptPath: e.transcriptPath ?? jsonPaths[0] ?? null,
          }));

        const enriched = await Promise.all(
          entries.map(async ({ basePath, audioPath, transcriptPath }) => {
            let scenario: string | null = null;
            let segmentCount: number | null = null;
            if (transcriptPath) {
              try {
                const { body } = await downloadData({ path: transcriptPath }).result;
                const json = JSON.parse(await body.text()) as { scenario?: string; segments?: unknown[] };
                if (json.scenario) scenario = json.scenario;
                if (Array.isArray(json.segments)) segmentCount = json.segments.length;
              } catch { /* skip */ }
            }
            return { basePath, audioPath, transcriptPath, label: "", scenario, segmentCount };
          })
        );

        enriched.sort((a, b) => a.basePath.localeCompare(b.basePath));
        enriched.forEach((d, i) => { d.label = `Dialogue ${i + 1}`; });
        setDialogues(enriched);

        const progressEntries = await Promise.all(
          enriched.map(async (dialogue) => {
            const recordingsResult = await client.models.Recording.list({
              filter: {
                dialogueId: { eq: dialogue.basePath },
                userId: { eq: userId },
              },
            });
            if (recordingsResult.errors) {
              throw new Error(`Failed to load attempts for ${dialogue.basePath}`);
            }

            const recordings = recordingsResult.data;
            const completedRecordings = recordings.filter((r) => r.status === "COMPLETED");
            let latestOverallScore: number | null = null;

            if (completedRecordings.length > 0) {
              const scored = await Promise.all(
                completedRecordings.map(async (recording) => {
                  const feedbackResult = await client.models.Feedback.list({
                    filter: { recordingId: { eq: recording.id } },
                  });
                  if (feedbackResult.errors) return null;
                  return feedbackResult.data[0] ?? null;
                }),
              );
              const validScores = scored
                .map((item) => item?.overallScore)
                .filter((score): score is number => typeof score === "number");
              if (validScores.length > 0) {
                latestOverallScore = validScores[validScores.sort((a, b) => a - b).length - 1];
              }
            }

            return [
              dialogue.basePath,
              {
                attempted: recordings.length > 0,
                completedCount: completedRecordings.length,
                latestOverallScore,
              },
            ] as const;
          }),
        );
        setDialogueProgress(Object.fromEntries(progressEntries));
      } catch {
        setLoadError("Failed to load dialogues.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [category]);

  function navigate(d: DialogueEntry) {
    router.push(`/category/${category}/dialogue/${encodeURIComponent(btoa(d.basePath))}`);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-5 py-8">
        <Button
          variant="ghost" size="sm"
          onClick={() => router.push("/")}
          className="gap-1.5 -ml-2 mb-5 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          All categories
        </Button>

        <div className="mb-6">
          <span style={{
            fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
            fontWeight: 700, color: "var(--amber-500)", background: "var(--amber-50)",
            padding: "4px 8px", borderRadius: 4,
          }}>
            {categoryLabel.toUpperCase()}
          </span>
          <h1 className="font-serif text-2xl font-semibold text-foreground mt-3 mb-1">
            {categoryLabel} dialogues
          </h1>
          <p className="text-sm text-muted-foreground">
            Select a dialogue to begin practising
          </p>
        </div>

        <Separator className="mb-6" />

        {isLoading ? (
          <ul className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <li key={i}>
                <div
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 14,
                    padding: "18px 20px",
                  }}
                >
                  <div className="flex justify-between items-center mb-3">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                  <Skeleton className="h-5 w-48 max-w-[90%] mb-2" />
                  <Skeleton className="h-4 w-full max-w-2xl mb-4" />
                  <div className="flex gap-4 mt-3 items-center">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-16 ml-auto" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : loadError ? (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
            {loadError}
          </p>
        ) : dialogues.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No dialogues found in this category.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {dialogues.map((d, i) => (
              <li key={d.basePath}>
                {/* DialogueCard — matches design spec */}
                <div
                  onClick={() => navigate(d)}
                  className="group"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 14, padding: "18px 20px",
                    cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.22,1,0.36,1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--forest-300)";
                    e.currentTarget.style.boxShadow = "var(--shadow-md)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-subtle)";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "none";
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{
                      fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                      fontWeight: 700, color: "var(--amber-700)",
                      background: "var(--amber-50)", padding: "4px 8px", borderRadius: 4,
                    }}>
                      {categoryLabel.toUpperCase()}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
                      color: "var(--fg-muted)",
                    }}>
                      #{i + 1}
                    </span>
                  </div>

                  {/* Serif title */}
                  <h3 style={{
                    fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 600,
                    color: "var(--fg-strong)", margin: "0 0 4px", lineHeight: 1.3,
                  }}>
                    {d.label}
                  </h3>

                  {/* Scenario description */}
                  {d.scenario && (
                    <p style={{
                      fontSize: 13, color: "var(--fg-muted)",
                      margin: "0 0 14px", lineHeight: 1.45,
                      display: "-webkit-box", WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                      {d.scenario}
                    </p>
                  )}

                  {/* Meta row */}
                  <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--fg-muted)", alignItems: "center", marginTop: d.scenario ? 0 : 12 }}>
                    {d.segmentCount && (
                      <span>{d.segmentCount} segments</span>
                    )}
                    <span style={{ marginLeft: "auto", fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 13, color: "var(--fg-muted)" }}>
                      {dialogueProgress[d.basePath]?.attempted
                        ? dialogueProgress[d.basePath]?.latestOverallScore !== null
                          ? `Score ${Math.round(dialogueProgress[d.basePath].latestOverallScore as number)}`
                          : "Attempted"
                        : "Not attempted"}
                    </span>
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
