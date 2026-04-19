"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { list } from "aws-amplify/storage";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { Card } from "@/components/ui/card";
import { ChevronRight, Loader2 } from "lucide-react";
import { DEFAULT_CATEGORY_ORDER, getCategoryPresentation } from "@/lib/categoryPresentation";
import {
  countCompletedInCategory,
  subscribeProgress,
} from "@/lib/progress";

type CategoryEntry = { name: string; label: string; count: number };

function toLabel(s: string) {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CategoryPracticeGrid() {
  const router = useRouter();
  const { authStatus } = useAuthenticator();
  const authenticated = authStatus === "authenticated";

  const [categories, setCategories] = useState<CategoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(authenticated);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, setProgressTick] = useState(0);

  const refreshProgress = useCallback(() => setProgressTick((n) => n + 1), []);

  useEffect(() => {
    return subscribeProgress(refreshProgress);
  }, [refreshProgress]);

  useEffect(() => {
    if (!authenticated) {
      setIsLoading(false);
      setCategories([]);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const { items } = await list({ path: "dialogues/", options: { listAll: true } });
        if (cancelled) return;
        const counts = new Map<string, number>();
        for (const item of items) {
          const parts = item.path.split("/");
          if (parts.length !== 3) continue;
          const category = parts[1];
          const filename = parts[2];
          if (!filename) continue;
          const ext = filename.split(".").pop()?.toLowerCase() ?? "";
          if (["mp3", "wav", "m4a", "webm"].includes(ext)) {
            counts.set(category, (counts.get(category) ?? 0) + 1);
          }
        }
        setCategories(
          Array.from(counts.entries())
            .map(([name, count]) => ({ name, label: toLabel(name), count }))
            .sort((a, b) => a.label.localeCompare(b.label))
        );
      } catch {
        setLoadError("Failed to load categories.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  const guestCategories = DEFAULT_CATEGORY_ORDER.map((name) => {
    const p = getCategoryPresentation(name);
    return { name, label: p.label };
  });

  const showGuestGrid = !authenticated;

  return (
    <section id="practice" className="scroll-mt-20 bg-muted/20 border-t border-border/60">
      <div className="max-w-6xl mx-auto px-5 py-14 md:py-16">
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Choose a category
          </h2>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            {showGuestGrid
              ? "Create a free account to load your dialogues from the library and track completion."
              : "Pick a topic to start segment or full-dialogue practice. Your progress is saved on this device."}
          </p>
        </div>

        {showGuestGrid ? (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {guestCategories.map((cat) => {
              const p = getCategoryPresentation(cat.name);
              const Icon = p.icon;
              return (
                <li key={cat.name}>
                  <Link href="/login?tab=signup">
                    <Card className="h-full flex flex-col px-4 py-4 cursor-pointer hover:border-primary/40 hover:bg-accent/40 transition-colors border-border/80">
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${p.iconWrapClass}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                      </div>
                      <p className="font-semibold text-sm text-foreground mt-3">{cat.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">Sign up to view dialogues</p>
                      <div className="mt-3 h-1.5 rounded-full bg-border overflow-hidden">
                        <div className="h-full w-0 rounded-full bg-primary" />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">0 / —</p>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading categories…
          </div>
        ) : loadError ? (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
            {loadError}
          </p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No dialogues available yet.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {categories.map((cat) => {
              const p = getCategoryPresentation(cat.name);
              const Icon = p.icon;
              const done = countCompletedInCategory(cat.name);
              const pct = cat.count > 0 ? Math.min(100, (done / cat.count) * 100) : 0;
              return (
                <li key={cat.name}>
                  <Card
                    onClick={() => router.push(`/category/${cat.name}`)}
                    className="h-full flex flex-col px-4 py-4 cursor-pointer hover:border-primary/40 hover:bg-accent/40 transition-colors border-border/80"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${p.iconWrapClass}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                    <p className="font-semibold text-sm text-foreground mt-3">{cat.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {cat.count} {cat.count === 1 ? "dialogue" : "dialogues"}
                    </p>
                    <div className="mt-3 h-1.5 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                      {done} / {cat.count} completed
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
