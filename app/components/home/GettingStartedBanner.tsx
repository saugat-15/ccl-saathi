import { Headphones, Mic, BarChart3, ArrowRight } from "lucide-react";
import Link from "next/link";

const STEPS = [
  {
    icon: Headphones,
    title: "Pick a category",
    body: "Choose a NAATI CCL topic that matches what you want to practise, such as health, legal, housing, and more.",
  },
  {
    icon: Mic,
    title: "Listen & record",
    body: "Hear each dialogue segment, then record your interpretation. Replay as many times as you need.",
  },
  {
    icon: BarChart3,
    title: "Get your AI score",
    body: "Submit your recording for instant AI feedback: accuracy, fluency, terminology, and an overall score.",
  },
];

type Props = {
  firstCategorySlug: string | null;
  givenName: string;
};

export default function GettingStartedBanner({ firstCategorySlug, givenName }: Props) {
  const greeting = givenName ? `Welcome, ${givenName}` : "Welcome to CCLSaathi";

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Hero callout */}
      <div style={{
        background: "var(--brand-soft)",
        border: "1px solid var(--forest-200)",
        borderRadius: 14,
        padding: "20px 22px",
        marginBottom: 16,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}>
        <div style={{ minWidth: 0 }}>
          <p style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--forest-600)",
            margin: "0 0 4px",
          }}>
            Getting started
          </p>
          <h2 style={{
            fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600,
            color: "var(--fg-strong)", margin: "0 0 6px", lineHeight: 1.2,
          }}>
            {greeting}
          </h2>
          <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: 0, maxWidth: 460 }}>
            You have not attempted any dialogues yet. Choose a category below to begin.
            Your scores will appear here once you complete your first practice.
          </p>
        </div>
        {firstCategorySlug && (
          <Link
            href={`/category/${firstCategorySlug}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "var(--forest-500)", color: "#fff",
              fontSize: 13, fontWeight: 600, borderRadius: 8,
              padding: "8px 14px", textDecoration: "none", whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Start practising
            <ArrowRight style={{ width: 14, height: 14 }} />
          </Link>
        )}
      </div>

      {/* Steps */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 10,
      }}>
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 12,
                padding: "14px 16px",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: "var(--forest-50)", color: "var(--forest-600)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon style={{ width: 15, height: 15 }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontSize: 11, fontWeight: 700, color: "var(--fg-subtle)",
                  fontFamily: "var(--font-mono)", margin: "0 0 2px",
                }}>
                  {String(i + 1).padStart(2, "0")}
                </p>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-strong)", margin: "0 0 3px" }}>
                  {step.title}
                </p>
                <p style={{ fontSize: 12, color: "var(--fg-muted)", margin: 0, lineHeight: 1.45 }}>
                  {step.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
