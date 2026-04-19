"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { list, downloadData } from "aws-amplify/storage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type DialogueEntry = {
  basePath: string;
  audioPath: string;
  transcriptPath: string | null;
  label: string;
  scenario: string | null;
  segmentCount: number | null;
};

function toLabel(s: string) {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CategoryPage({ params }: { params: { category: string } }) {
  const router = useRouter();
  const { category } = params;
  const categoryLabel = toLabel(category);

  const [dialogues, setDialogues] = useState<DialogueEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { items } = await list({ path: `dialogues/${category}/`, options: { listAll: true } });

        const map = new Map<string, { audioPath?: string; transcriptPath?: string }>();
        for (const item of items) {
          const parts = item.path.split("/");
          if (parts.length !== 3) continue;
          const filename = parts[2];
          if (!filename) continue;
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
          .map(([basePath, e]) => ({ basePath, audioPath: e.audioPath!, transcriptPath: e.transcriptPath ?? null }));

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
      } catch {
        setLoadError("Failed to load dialogues.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [category]);

  function navigate(d: DialogueEntry) {
    router.push(`/practice/${encodeURIComponent(btoa(d.basePath))}`);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-5 py-8">

        <Button
          variant="ghost" size="sm"
          onClick={() => router.push("/")}
          className="gap-1.5 -ml-2 mb-6 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Categories
        </Button>

        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{categoryLabel}</h1>
          <p className="text-sm text-muted-foreground mt-1">Select a dialogue to begin practising</p>
        </div>

        <Separator className="mb-5" />

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : loadError ? (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
            {loadError}
          </p>
        ) : dialogues.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No dialogues found in this category.</p>
        ) : (
          <ul className="space-y-2">
            {dialogues.map((d, i) => (
              <li key={d.basePath}>
                <Card
                  onClick={() => navigate(d)}
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:border-primary/40 hover:bg-accent/40 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{d.label}</p>
                    {d.scenario && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                        {d.scenario}
                      </p>
                    )}
                  </div>
                  {d.segmentCount && (
                    <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">
                      {d.segmentCount} segments
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
