"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { list } from "aws-amplify/storage";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { fetchUserAttributes } from "aws-amplify/auth";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { DEFAULT_CATEGORY_ORDER, getCategoryPresentation } from "@/lib/categoryPresentation";
import { countCompletedInCategory, subscribeProgress } from "@/lib/progress";

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
  const [, setProgressTick] = useState(0);

  const refreshProgress = useCallback(() => setProgressTick((n) => n + 1), []);

  useEffect(() => {
    return subscribeProgress(refreshProgress);
  }, [refreshProgress]);

  useEffect(() => {
    if (!authenticated) return;
    fetchUserAttributes()
      .then((attrs) => setGivenName(attrs.given_name ?? ""))
      .catch(() => {});
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

  // ── Authenticated dashboard ───────────────────────────────────────────────
  if (authenticated) {
    const greeting = givenName ? `Welcome back, ${givenName}` : "Welcome back";
    const totalDone = categories.reduce((sum, c) => sum + countCompletedInCategory(c.name), 0);
    const totalCount = categories.reduce((sum, c) => sum + c.count, 0);

    return (
      <section className="scroll-mt-20" id="practice">
        <div className="max-w-5xl mx-auto px-5 py-10">
          {/* Page header */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{
              fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 600,
              color: "var(--fg-strong)", margin: "0 0 6px", lineHeight: 1.2,
            }}>
              {greeting}
            </h1>
            <p style={{ fontSize: 14, color: "var(--fg-muted)", margin: 0 }}>
              Pick a category below to start or continue your practice.
            </p>
          </div>

          {/* Overall progress bar */}
          {!isLoading && categories.length > 0 && (
            <div style={{
              background: "#fff", border: "1px solid var(--gg-200)",
              borderRadius: 12, padding: "14px 18px", marginBottom: 28,
              display: "flex", alignItems: "center", gap: 16,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between",
                  fontSize: 12, color: "var(--fg-muted)", marginBottom: 6 }}>
                  <span>Overall progress</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600,
                    color: "var(--forest-600)" }}>
                    {totalDone} / {totalCount} completed
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--gg-200)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 3,
                    background: "var(--forest-500)",
                    width: totalCount > 0 ? `${Math.min(100, (totalDone / totalCount) * 100)}%` : "0%",
                    transition: "width 0.4s ease",
                  }} />
                </div>
              </div>
            </div>
          )}

          <Separator style={{ marginBottom: 24 }} />

          {isLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8,
              color: "var(--fg-muted)", fontSize: 14, padding: "24px 0" }}>
              <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
              Loading categories…
            </div>
          ) : loadError ? (
            <p style={{ fontSize: 13, color: "var(--danger)", background: "var(--danger-soft)",
              border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8,
              padding: "10px 14px" }}>
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
                const done = countCompletedInCategory(cat.name);
                const pct = cat.count > 0 ? Math.min(100, (done / cat.count) * 100) : 0;

                return (
                  <li key={cat.name}>
                    <div
                      onClick={() => router.push(`/category/${cat.name}`)}
                      style={{
                        background: "#fff",
                        border: "1px solid var(--gg-200)",
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
                        e.currentTarget.style.borderColor = "var(--gg-200)";
                        e.currentTarget.style.boxShadow = "none";
                        e.currentTarget.style.transform = "none";
                      }}
                    >
                      {/* Icon */}
                      <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }} className={p.iconWrapClass}>
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
                          height: 4, background: "var(--gg-200)",
                          borderRadius: 2, overflow: "hidden", marginBottom: 5,
                        }}>
                          <div style={{
                            height: "100%", borderRadius: 2,
                            background: done > 0 ? "var(--forest-500)" : "var(--gg-300)",
                            width: `${pct}%`,
                            transition: "width 0.4s ease",
                          }} />
                        </div>
                        <p style={{
                          fontSize: 11, color: done > 0 ? "var(--forest-600)" : "var(--fg-muted)",
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
                      background: "#fff",
                      border: "1px solid var(--gg-200)",
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
                      e.currentTarget.style.borderColor = "var(--gg-200)";
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.opacity = "0.75";
                      e.currentTarget.style.transform = "none";
                    }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: 10,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }} className={p.iconWrapClass}>
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
                        height: 4, background: "var(--gg-200)",
                        borderRadius: 2, marginBottom: 5,
                      }} />
                      <p style={{ fontSize: 11, color: "var(--fg-muted)",
                        fontFamily: "var(--font-mono)", margin: 0 }}>
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
