"use client";

export type FeedbackDetails = {
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

const PASS_THRESHOLD = 70;
const CIRCLE_R = 40;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;

function getPerformanceLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Excellent", color: "var(--score-high)" };
  if (score >= 80) return { label: "Good", color: "var(--score-high)" };
  if (score >= 70) return { label: "Pass", color: "var(--score-high)" };
  if (score >= 60) return { label: "Near Pass", color: "var(--score-mid)" };
  return { label: "Needs Work", color: "var(--score-low)" };
}

function getScoreColor(score: number): string {
  if (score >= 70) return "var(--score-high)";
  if (score >= 50) return "var(--score-mid)";
  return "var(--score-low)";
}

function formatReadinessLevel(level: string): string {
  return level
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getReadinessColor(level: string): string {
  // normalise to space-separated lowercase so word boundaries work on snake_case values
  const l = level.toLowerCase().replace(/[_-]/g, " ");
  if (/\bnot\b|fail|below|unready|poor/.test(l)) return "var(--score-low)";
  if (/partial|developing|near|almost|borderline/.test(l)) return "var(--score-mid)";
  return "var(--score-high)";
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ScoreCircle({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const offset = CIRCLE_CIRCUMFERENCE - (pct / 100) * CIRCLE_CIRCUMFERENCE;
  const color = getScoreColor(score);

  return (
    <div className="relative shrink-0" style={{ width: 80, height: 80 }}>
      <svg width={80} height={80} viewBox="0 0 100 100" className="-rotate-90">
        <circle
          cx={50} cy={50} r={CIRCLE_R}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={9}
        />
        <circle
          cx={50} cy={50} r={CIRCLE_R}
          fill="none"
          stroke={color}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={CIRCLE_CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-xl font-bold font-mono"
        style={{ color: "var(--fg-strong)" }}
      >
        {Math.round(score)}
      </span>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = getScoreColor(score);

  return (
    <div className="flex items-center gap-3">
      <span
        className="w-24 shrink-0 text-sm"
        style={{ color: "var(--fg-muted)" }}
      >
        {label}
      </span>
      <div
        className="flex-1 h-1.5 rounded-full"
        style={{ background: "var(--border-subtle)" }}
      >
        <div
          className="h-1.5 rounded-full"
          style={{
            width: `${pct}%`,
            background: color,
            transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </div>
      <span
        className="w-7 shrink-0 text-right text-sm font-mono font-semibold"
        style={{ color }}
      >
        {Math.round(score)}
      </span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function ScoreReport({ details }: { details: FeedbackDetails }) {
  const overall = details.overallScore ?? 0;
  const perf = getPerformanceLabel(overall);
  const abovePass = overall >= PASS_THRESHOLD;

  const scoreBars: Array<{ label: string; score: number | null }> = [
    { label: "Accuracy", score: details.accuracyScore },
    { label: "Fluency", score: details.fluencyScore },
    { label: "Terminology", score: details.terminologyScore },
    { label: "Completeness", score: details.completenessScore },
  ];
  const visibleBars = scoreBars.filter((b): b is { label: string; score: number } => b.score !== null);

  const positiveTags = details.strengths.slice(0, 4);
  const negativeTags = details.suggestions.slice(0, 3);

  return (
    <div
      className="rounded-xl border p-6 space-y-6"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-base" style={{ color: "var(--fg-strong)" }}>
            AI Score Report
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
            Full dialogue
          </p>
        </div>
        <span
          className="flex items-center gap-1.5 shrink-0 text-xs font-bold px-3 py-1 rounded-full border"
          style={{ color: "var(--score-high)", borderColor: "var(--score-high)" }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--score-high)" }}
          />
          AI SCORED
        </span>
      </div>

      {/* Score overview */}
      <div className="flex items-center gap-4">
        {details.overallScore !== null && <ScoreCircle score={overall} />}
        <div className="space-y-0.5">
          <p className="font-semibold text-lg leading-tight" style={{ color: perf.color }}>
            {perf.label}
          </p>
          <p className="text-sm" style={{ color: "var(--fg-default)" }}>
            Overall performance
          </p>
          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
            {abovePass ? "Above" : "Below"} pass threshold ({PASS_THRESHOLD})
          </p>
        </div>
      </div>

      {/* Score bars */}
      {visibleBars.length > 0 && (
        <div className="space-y-3">
          {visibleBars.map((b) => (
            <ScoreBar key={b.label} label={b.label} score={b.score} />
          ))}
        </div>
      )}

      {/* Strength / suggestion tags */}
      {(positiveTags.length > 0 || negativeTags.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {positiveTags.map((t) => (
            <span
              key={t}
              className="text-xs font-medium px-2.5 py-1 rounded-md"
              style={{ color: "var(--score-high)" }}
            >
              {t}
            </span>
          ))}
          {negativeTags.map((t) => (
            <span
              key={t}
              className="text-xs font-medium px-2.5 py-1 rounded-md"
              style={{
                background: "color-mix(in srgb, var(--score-low) 14%, transparent)",
                color: "var(--score-low)",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Missed terms */}
      {details.missedTerms.length > 0 && (
        <div
          className="border-t pt-5 space-y-3"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--fg-muted)" }}
          >
            Missed Terms
          </p>
          <div className="flex flex-wrap gap-1.5">
            {details.missedTerms.map((term) => (
              <span
                key={term}
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  background: "color-mix(in srgb, var(--score-low) 14%, transparent)",
                  color: "var(--score-low)",
                }}
              >
                {term}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Critical errors */}
      {details.criticalErrors.length > 0 && (
        <div
          className="border-t pt-5 space-y-3"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--fg-muted)" }}
          >
            Critical Errors
          </p>
          <ul className="space-y-2">
            {details.criticalErrors.slice(0, 6).map((err, i) => (
              <li
                key={`${err.segmentIndex ?? "e"}-${i}`}
                className="flex gap-2 text-xs"
                style={{ color: "var(--fg-muted)" }}
              >
                <span className="font-medium shrink-0" style={{ color: "var(--score-low)" }}>
                  Seg {err.segmentIndex ?? "?"}
                </span>
                <span>
                  {err.type ?? ""}
                  {err.impact ? ` — ${err.impact}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Graded segments */}
      {details.gradedSegments.length > 0 && (
        <div
          className="border-t pt-5 space-y-3"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--fg-muted)" }}
          >
            Segment Scores
          </p>
          <div className="space-y-2.5">
            {details.gradedSegments.slice(0, 12).map((seg, i) => {
              const acc = seg.segmentAccuracy ?? null;
              const segColor = acc !== null ? getScoreColor(acc) : "var(--fg-muted)";
              return (
                <div
                  key={`${seg.segmentIndex ?? "g"}-${i}`}
                  className="flex items-start gap-2.5 text-xs"
                  style={{ color: "var(--fg-muted)" }}
                >
                  <span
                    className="font-mono font-medium shrink-0 w-5 text-right"
                    style={{ color: "var(--fg-subtle)" }}
                  >
                    {seg.segmentIndex ?? i + 1}
                  </span>
                  {acc !== null && (
                    <span className="font-semibold shrink-0 w-7" style={{ color: segColor }}>
                      {Math.round(acc)}
                    </span>
                  )}
                  {seg.comment && <span className="flex-1 leading-relaxed">{seg.comment}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Exam readiness */}
      {details.examReadinessLevel && (
        <div
          className="border-t pt-5 space-y-2"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--fg-muted)" }}
          >
            Exam Readiness
          </p>
          <p
            className="text-sm font-semibold"
            style={{ color: getReadinessColor(details.examReadinessLevel) }}
          >
            {formatReadinessLevel(details.examReadinessLevel)}
          </p>
          {details.examReadinessReason && (
            <p className="text-xs leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              {details.examReadinessReason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
