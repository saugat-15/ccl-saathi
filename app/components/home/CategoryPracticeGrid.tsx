"use client";

import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
Amplify.configure(outputs, { ssr: true });

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { list } from "aws-amplify/storage";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { fetchUserAttributes, getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_CATEGORY_ORDER, getCategoryPresentation } from "@/lib/categoryPresentation";
import type { Schema } from "@/amplify/data/resource";
import ScoreChart from "@/app/components/home/ScoreChart";
import StreakCard from "@/app/components/home/StreakCard";
import GettingStartedBanner from "@/app/components/home/GettingStartedBanner";
import { useScoreHistory } from "@/hooks/useScoreHistory";

const client = generateClient<Schema>();

type CategoryEntry = { name: string; label: string; count: number };

function toLabel(s: string) {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CategoryPracticeGrid() {
  const router = useRouter();
  const { authStatus } = useAuthenticator();
  const authenticated = authStatus === "authenticated";

  const [givenName, setGivenName] = useState("");
  const [categories, setCategories] = useState<CategoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(authenticated);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [completionsByCategory, setCompletionsByCategory] = useState<Record<string, number>>({});
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) { setUserId(null); setCompletionsByCategory({}); return; }
    getCurrentUser().then(({ userId: id }) => setUserId(id)).catch(() => { });
  }, [authenticated]);

  useEffect(() => {
    if (!userId) return;
    const sub = client.models.Recording.observeQuery({
      filter: { userId: { eq: userId }, status: { eq: "COMPLETED" } },
    }).subscribe({
      next: ({ items }) => {
        const uniqueByCategory: Record<string, Set<string>> = {};
        for (const rec of items) {
          const cat = rec.dialogueId?.split("/")?.[1];
          if (cat && rec.dialogueId) {
            if (!uniqueByCategory[cat]) uniqueByCategory[cat] = new Set();
            uniqueByCategory[cat].add(rec.dialogueId);
          }
        }
        const counts: Record<string, number> = {};
        for (const [cat, dialogues] of Object.entries(uniqueByCategory)) {
          counts[cat] = dialogues.size;
        }
        setCompletionsByCategory(counts);
      },
      error: () => { /* ignore */ },
    });
    return () => sub.unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (!authenticated) return;
    fetchUserAttributes()
      .then((attrs) => setGivenName(attrs.given_name ?? ""))
      .catch(() => { });
  }, [authenticated]);

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
            .sort((a, b) => {
              const ai = DEFAULT_CATEGORY_ORDER.indexOf(a.name);
              const bi = DEFAULT_CATEGORY_ORDER.indexOf(b.name);
              if (ai !== -1 && bi !== -1) return ai - bi;
              if (ai !== -1) return -1;
              if (bi !== -1) return 1;
              return a.label.localeCompare(b.label);
            })
        );
      } catch {
        setLoadError("Failed to load categories.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [authenticated]);

  const { data: scoreData } = useScoreHistory(userId);

  // ── Authenticated dashboard ───────────────────────────────────────────────
  if (authenticated) {
    const totalDone = categories.reduce((sum, c) => sum + (completionsByCategory[c.name] ?? 0), 0);
    const totalCount = categories.reduce((sum, c) => sum + c.count, 0);
    const hasStarted = !isLoading && (totalDone > 0 || scoreData.length > 0);
    const greeting = givenName ? `Welcome back, ${givenName}` : "Welcome back";

    return (
      <section className="scroll-mt-20" id="practice">
        <div className="max-w-5xl mx-auto px-5 py-10">
          {/* Page header — only shown once user has started */}
          {hasStarted && (
            <div className="flex flex-col gap-4 mb-7 md:flex-row md:items-start md:justify-between md:gap-4">
              <div className="min-w-0">
                <h1 style={{
                  fontFamily: "var(--font-serif)", fontSize: "clamp(22px, 5vw, 26px)", fontWeight: 600,
                  color: "var(--fg-strong)", margin: "0 0 6px", lineHeight: 1.2,
                }}>
                  {greeting}
                </h1>
                <p style={{ fontSize: 14, color: "var(--fg-muted)", margin: 0 }}>
                  Pick a category below to continue your practice.
                </p>
              </div>
              <div className="w-full shrink-0 md:w-auto md:max-w-none md:mt-1">
                <StreakCard userId={userId} />
              </div>
            </div>
          )}

          {/* Getting started — shown until first completion */}
          {!isLoading && !hasStarted && categories.length > 0 && (
            <GettingStartedBanner
              givenName={givenName}
              firstCategorySlug={categories[0]?.name ?? null}
            />
          )}

          {/* Overall progress bar — only when user has made attempts */}
          {hasStarted && (
            <div style={{
              background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
              borderRadius: 12, padding: "14px 18px", marginBottom: 28,
              display: "flex", alignItems: "center", gap: 16,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 12, color: "var(--fg-muted)", marginBottom: 6
                }}>
                  <span>Overall Progress</span>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontWeight: 600,
                    color: "var(--progress-fill)"
                  }}>
                    {totalDone} / {totalCount} completed
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--border-default)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 3,
                    background: "var(--progress-fill)",
                    width: totalCount > 0 ? `${Math.min(100, (totalDone / totalCount) * 100)}%` : "0%",
                    transition: "width 0.4s ease",
                  }} />
                </div>
              </div>
            </div>
          )}

          <ScoreChart userId={userId} />

          <Separator style={{ marginBottom: 24 }} />

          {isLoading ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 14,
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 14,
                    padding: "18px 18px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <Skeleton className="h-4 w-[140px] max-w-[85%]" />
                  <Skeleton className="h-3 w-20" />
                  <div style={{ marginTop: "auto", paddingTop: 4 }}>
                    <Skeleton className="h-1 w-full rounded-sm mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : loadError ? (
            <p style={{
              fontSize: 13, color: "var(--danger)", background: "var(--danger-soft)",
              border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8,
              padding: "10px 14px"
            }}>
              {loadError}
            </p>
          ) : categories.length === 0 ? (
            <p style={{ fontSize: 14, color: "var(--fg-muted)", padding: "16px 0" }}>
              No dialogues available yet.
            </p>
          ) : (
            <ul style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 14, listStyle: "none", padding: 0, margin: 0,
            }}>
              {categories.map((cat) => {
                const p = getCategoryPresentation(cat.name);
                const Icon = p.icon;
                const done = completionsByCategory[cat.name] ?? 0;
                const pct = cat.count > 0 ? Math.min(100, (done / cat.count) * 100) : 0;

                return (
                  <li key={cat.name}>
                    <div
                      onClick={() => router.push(`/category/${cat.name}`)}
                      style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 14, padding: "18px 18px 16px",
                        cursor: "pointer",
                        transition: "all 0.2s cubic-bezier(0.22,1,0.36,1)",
                        display: "flex", flexDirection: "column", gap: 12,
                        height: "100%",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--forest-300)";
                        e.currentTarget.style.boxShadow = "var(--shadow-md)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-subtle)";
                        e.currentTarget.style.boxShadow = "none";
                        e.currentTarget.style.transform = "none";
                      }}
                    >
                      {/* Icon */}
                      <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        ...p.iconStyle
                      }}>
                        <Icon style={{ width: 20, height: 20 }} />
                      </div>

                      {/* Label + count */}
                      <div>
                        <p style={{
                          fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 600,
                          color: "var(--fg-strong)", margin: "0 0 3px", lineHeight: 1.25,
                        }}>
                          {cat.label}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--fg-muted)", margin: 0 }}>
                          {cat.count} {cat.count === 1 ? "dialogue" : "dialogues"}
                        </p>
                      </div>

                      {/* Progress bar */}
                      <div style={{ marginTop: "auto" }}>
                        <div style={{
                          height: 4, background: "var(--border-default)",
                          borderRadius: 2, overflow: "hidden", marginBottom: 5,
                        }}>
                          <div style={{
                            height: "100%", borderRadius: 2,
                            background: done > 0 ? "var(--progress-fill)" : "var(--border-default)",
                            width: `${pct}%`,
                            transition: "width 0.4s ease",
                          }} />
                        </div>
                        <p style={{
                          fontSize: 11, color: done > 0 ? "var(--progress-fill)" : "var(--fg-muted)",
                          fontFamily: "var(--font-mono)", fontWeight: done > 0 ? 600 : 400,
                          margin: 0,
                        }}>
                          {done > 0 ? `${done} / ${cat.count} done` : "Not started"}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    );
  }

  // ── Guest grid (shown below marketing sections on landing page) ───────────
  const guestCategories = DEFAULT_CATEGORY_ORDER.map((name) => {
    const p = getCategoryPresentation(name);
    return { name, label: p.label };
  });

  return (
    <section id="practice" className="scroll-mt-20 bg-muted/20 border-t border-border/60">
      <div className="max-w-6xl mx-auto px-5 py-14 md:py-16">
        <div className="mb-8">
          <h2 style={{ fontFamily: "var(--font-serif)" }}
            className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Choose a category
          </h2>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Create a free account to load your dialogues from the library and track completion.
          </p>
        </div>

        <ul style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 14, listStyle: "none", padding: 0, margin: 0,
        }}>
          {guestCategories.map((cat) => {
            const p = getCategoryPresentation(cat.name);
            const Icon = p.icon;
            return (
              <li key={cat.name}>
                <a href="/login?tab=signup" style={{ textDecoration: "none" }}>
                  <div
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 14, padding: "18px 18px 16px",
                      cursor: "pointer", opacity: 0.75,
                      display: "flex", flexDirection: "column", gap: 12,
                      transition: "all 0.2s cubic-bezier(0.22,1,0.36,1)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--forest-300)";
                      e.currentTarget.style.boxShadow = "var(--shadow-md)";
                      e.currentTarget.style.opacity = "1";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-subtle)";
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.opacity = "0.75";
                      e.currentTarget.style.transform = "none";
                    }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: 10,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      ...p.iconStyle
                    }}>
                      <Icon style={{ width: 20, height: 20 }} />
                    </div>
                    <div>
                      <p style={{
                        fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 600,
                        color: "var(--fg-strong)", margin: "0 0 3px",
                      }}>
                        {cat.label}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--fg-muted)", margin: 0 }}>
                        Sign up to view
                      </p>
                    </div>
                    <div style={{ marginTop: "auto" }}>
                      <div style={{
                        height: 4, background: "var(--border-default)",
                        borderRadius: 2, marginBottom: 5,
                      }} />
                      <p style={{
                        fontSize: 11, color: "var(--fg-muted)",
                        fontFamily: "var(--font-mono)", margin: 0
                      }}>
                        — / —
                      </p>
                    </div>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
