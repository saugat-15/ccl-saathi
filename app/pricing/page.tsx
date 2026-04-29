"use client";

import { useRouter } from "next/navigation";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Check, ChevronLeft, Zap } from "lucide-react";

// Hardcoded until billing backend is ready
const IS_PRO = false;

const FREE_FEATURES = [
  "One practice dialogue per topic",
  "Full audio playback & replay",
  "Segment-by-segment practice mode",
  "In-browser recording",
  "Progress tracked on this device",
];

const PRO_FEATURES = [
  "Everything in Free",
  "All dialogues in every category",
  "Unlimited recordings & submissions",
  "AI scoring & feedback (coming soon)",
  "Priority access to new dialogues",
  "Progress synced across devices",
];

export default function PricingPage() {
  const router = useRouter();
  const { authStatus } = useAuthenticator();
  const authenticated = authStatus === "authenticated";

  const currentPlan = IS_PRO ? "pro" : "free";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-5 py-10">

        {/* Back button */}
        <Button
          variant="ghost" size="sm"
          onClick={() => router.back()}
          className="gap-1.5 -ml-2 mb-8 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        {/* Header */}
        <div style={{ marginBottom: 36, textAlign: "center" }}>
          <span style={{
            fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
            fontWeight: 700, color: "var(--amber-700)", background: "var(--amber-50)",
            padding: "4px 10px", borderRadius: 4,
          }}>
            Plans &amp; Pricing
          </span>
          <h1 style={{
            fontFamily: "var(--font-serif)", fontSize: 30, fontWeight: 600,
            color: "var(--fg-strong)", margin: "14px 0 8px", lineHeight: 1.15,
          }}>
            Simple, honest pricing
          </h1>
          <p style={{ fontSize: 15, color: "var(--fg-muted)", margin: "0 auto", maxWidth: 460 }}>
            Start free and practise at your own pace. Upgrade when you want full library access and AI scoring.
          </p>
        </div>

        <Separator style={{ marginBottom: 36 }} />

        {/* Plan cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
          marginBottom: 48,
        }}>
          {/* Free plan */}
          <div style={{
            background: "var(--bg-surface)",
            border: currentPlan === "free" ? "2px solid var(--border-default)" : "1px solid var(--border-subtle)",
            borderRadius: 18, padding: "28px 28px 24px",
            display: "flex", flexDirection: "column",
            position: "relative",
          }}>
            {currentPlan === "free" && (
              <span style={{
                position: "absolute", top: 18, right: 18,
                fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
                fontWeight: 700, color: "var(--fg-muted)",
                background: "var(--bg-sunken)", border: "1px solid var(--border-subtle)",
                padding: "3px 9px", borderRadius: 20,
              }}>
                Current plan
              </span>
            )}

            <div style={{ marginBottom: 20 }}>
              <p style={{
                fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600,
                color: "var(--fg-strong)", margin: "0 0 6px",
              }}>
                Free
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 36, fontWeight: 700,
                  color: "var(--fg-strong)", lineHeight: 1,
                }}>$0</span>
                <span style={{ fontSize: 14, color: "var(--fg-muted)" }}>/month</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: 0, lineHeight: 1.5 }}>
                Everything you need to start practising for the CCL exam.
              </p>
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 10 }}>
              {FREE_FEATURES.map((f) => (
                <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "var(--fg-default)" }}>
                  <Check style={{ width: 16, height: 16, color: "var(--success)", flexShrink: 0, marginTop: 1 }} />
                  {f}
                </li>
              ))}
            </ul>

            <div style={{ marginTop: "auto" }}>
              {currentPlan === "free" ? (
                <button
                  disabled
                  style={{
                    width: "100%", padding: "11px 20px", borderRadius: 10,
                    background: "var(--bg-sunken)", border: "1px solid var(--border-subtle)",
                    color: "var(--fg-muted)", fontFamily: "var(--font-sans)",
                    fontSize: 14, fontWeight: 600, cursor: "not-allowed",
                  }}
                >
                  Your current plan
                </button>
              ) : (
                <button
                  onClick={() => router.push("/")}
                  style={{
                    width: "100%", padding: "11px 20px", borderRadius: 10,
                    background: "transparent", border: "1px solid var(--border-default)",
                    color: "var(--fg-strong)", fontFamily: "var(--font-sans)",
                    fontSize: 14, fontWeight: 600, cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
                >
                  Continue with Free
                </button>
              )}
            </div>
          </div>

          {/* Pro plan */}
          <div style={{
            background: currentPlan === "pro" ? "var(--forest-50)" : "var(--bg-surface)",
            border: currentPlan === "pro" ? "2px solid var(--forest-400)" : "2px solid var(--forest-300)",
            borderRadius: 18, padding: "28px 28px 24px",
            display: "flex", flexDirection: "column",
            position: "relative",
            boxShadow: "var(--shadow-md)",
          }}>
            {/* Badge */}
            <span style={{
              position: "absolute", top: 18, right: 18,
              fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
              fontWeight: 700,
              color: currentPlan === "pro" ? "var(--forest-700)" : "var(--amber-700)",
              background: currentPlan === "pro" ? "var(--forest-100)" : "var(--amber-50)",
              border: `1px solid ${currentPlan === "pro" ? "var(--forest-200)" : "var(--amber-100)"}`,
              padding: "3px 9px", borderRadius: 20,
            }}>
              {currentPlan === "pro" ? "Current plan" : "Most popular"}
            </span>

            <div style={{ marginBottom: 20 }}>
              <p style={{
                fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600,
                color: "var(--fg-strong)", margin: "0 0 6px",
              }}>
                Pro
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 36, fontWeight: 700,
                  color: "var(--fg-strong)", lineHeight: 1,
                }}>$19</span>
                <span style={{ fontSize: 14, color: "var(--fg-muted)" }}>/month</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: 0, lineHeight: 1.5 }}>
                Full library access for serious exam preparation.
              </p>
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 10 }}>
              {PRO_FEATURES.map((f) => (
                <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "var(--fg-default)" }}>
                  <Check style={{ width: 16, height: 16, color: "var(--success)", flexShrink: 0, marginTop: 1 }} />
                  {f}
                </li>
              ))}
            </ul>

            <div style={{ marginTop: "auto" }}>
              {currentPlan === "pro" ? (
                <button
                  disabled
                  style={{
                    width: "100%", padding: "11px 20px", borderRadius: 10,
                    background: "var(--forest-100)", border: "1px solid var(--forest-200)",
                    color: "var(--forest-700)", fontFamily: "var(--font-sans)",
                    fontSize: 14, fontWeight: 600, cursor: "not-allowed",
                  }}
                >
                  Your current plan
                </button>
              ) : authenticated ? (
                <button
                  onClick={() => {/* billing flow goes here */}}
                  style={{
                    width: "100%", padding: "11px 20px", borderRadius: 10,
                    background: "var(--brand)", border: "none",
                    color: "#fff", fontFamily: "var(--font-sans)",
                    fontSize: 14, fontWeight: 600, cursor: "pointer",
                    boxShadow: "var(--shadow-brand)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--forest-600)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--brand)")}
                >
                  <Zap style={{ width: 15, height: 15, fill: "rgba(255,255,255,0.8)" }} />
                  Upgrade to Pro
                </button>
              ) : (
                <button
                  onClick={() => router.push("/login?tab=signup")}
                  style={{
                    width: "100%", padding: "11px 20px", borderRadius: 10,
                    background: "var(--brand)", border: "none",
                    color: "#fff", fontFamily: "var(--font-sans)",
                    fontSize: 14, fontWeight: 600, cursor: "pointer",
                    boxShadow: "var(--shadow-brand)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--forest-600)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--brand)")}
                >
                  <Zap style={{ width: 15, height: 15, fill: "rgba(255,255,255,0.8)" }} />
                  Get started with Pro
                </button>
              )}
              <p style={{ fontSize: 12, color: "var(--fg-muted)", textAlign: "center", margin: "10px 0 0" }}>
                Billing coming soon — join the waitlist for launch pricing.
              </p>
            </div>
          </div>
        </div>

        {/* Feature comparison table */}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
          borderRadius: 16, overflow: "hidden", marginBottom: 48,
        }}>
          <div style={{
            padding: "16px 24px", borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-sunken)",
          }}>
            <p style={{
              fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
              fontWeight: 700, color: "var(--fg-muted)", margin: 0,
            }}>
              Feature comparison
            </p>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 13,
                  fontWeight: 600, color: "var(--fg-muted)", width: "55%" }}>
                  Feature
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 13,
                  fontWeight: 600, color: "var(--fg-muted)" }}>
                  Free
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 13,
                  fontWeight: 600, color: "var(--brand)" }}>
                  Pro
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Practice dialogues", free: "1 per category", pro: "All dialogues" },
                { label: "Segment-by-segment mode", free: true, pro: true },
                { label: "Full dialogue mode", free: true, pro: true },
                { label: "In-browser recording", free: true, pro: true },
                { label: "Unlimited recordings", free: false, pro: true },
                { label: "AI scoring & feedback", free: false, pro: "Coming soon" },
                { label: "Progress sync across devices", free: false, pro: true },
                { label: "Priority new dialogue access", free: false, pro: true },
              ].map((row, i) => (
                <tr key={row.label} style={{
                  borderBottom: i < 7 ? "1px solid var(--border-subtle)" : "none",
                  background: i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-sunken)",
                }}>
                  <td style={{ padding: "12px 24px", fontSize: 14, color: "var(--fg-default)" }}>
                    {row.label}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    {row.free === true ? (
                      <Check style={{ width: 16, height: 16, color: "var(--success)", margin: "0 auto" }} />
                    ) : row.free === false ? (
                      <span style={{ fontSize: 16, color: "var(--fg-subtle)", lineHeight: 1 }}>—</span>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>{row.free}</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    {row.pro === true ? (
                      <Check style={{ width: 16, height: 16, color: "var(--success)", margin: "0 auto" }} />
                    ) : row.pro === false ? (
                      <span style={{ fontSize: 16, color: "var(--fg-subtle)", lineHeight: 1 }}>—</span>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--brand)", fontWeight: 600 }}>{row.pro}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FAQ */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{
            fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600,
            color: "var(--fg-strong)", margin: "0 0 20px",
          }}>
            Frequently asked questions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              {
                q: "When will billing be available?",
                a: "We're finalising the payment integration. Join the waitlist below to be notified first and lock in an early-bird rate.",
              },
              {
                q: "Can I try Pro before paying?",
                a: "Yes — we'll offer a trial period at launch. The Free plan will always remain available with no time limit.",
              },
              {
                q: "What payment methods will you accept?",
                a: "We plan to support all major credit/debit cards via Stripe. More options may follow based on demand.",
              },
              {
                q: "Is my progress saved if I upgrade?",
                a: "Your existing locally-tracked progress carries over. Pro adds cross-device sync on top of that.",
              },
            ].map((item) => (
              <div key={item.q} style={{
                background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
                borderRadius: 12, padding: "16px 20px",
              }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-strong)", margin: "0 0 6px" }}>
                  {item.q}
                </p>
                <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: 0, lineHeight: 1.55 }}>
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Waitlist CTA */}
        <div style={{
          background: "var(--forest-50)", border: "1px solid var(--forest-200)",
          borderRadius: 16, padding: "28px 28px",
          textAlign: "center",
        }}>
          <h2 style={{
            fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600,
            color: "var(--fg-strong)", margin: "0 0 8px",
          }}>
            Get notified when Pro launches
          </h2>
          <p style={{ fontSize: 14, color: "var(--fg-muted)", margin: "0 0 20px" }}>
            Early subscribers get launch pricing locked in for life.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                window.localStorage.setItem(
                  "ccl-saathi-waitlist-email",
                  JSON.stringify({ email: fd.get("email"), at: Date.now() })
                );
              } catch { /* ignore */ }
              (e.target as HTMLFormElement).reset();
              alert("You're on the list!");
            }}
            style={{ display: "flex", gap: 10, maxWidth: 440, margin: "0 auto", flexWrap: "wrap" }}
          >
            <input
              type="email" name="email" required
              placeholder="you@example.com"
              style={{
                flex: 1, minWidth: 200, height: 42, borderRadius: 8,
                border: "1px solid var(--border-default)", padding: "0 12px",
                fontSize: 14, fontFamily: "var(--font-sans)",
                outline: "none", background: "var(--bg-surface)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--brand)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
            />
            <button
              type="submit"
              style={{
                height: 42, padding: "0 20px", borderRadius: 8,
                background: "var(--brand)", border: "none",
                color: "#fff", fontFamily: "var(--font-sans)",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
                boxShadow: "var(--shadow-brand)",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--forest-600)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--brand)")}
            >
              Join waitlist
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
