import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Check,
  Headphones,
  ListChecks,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import WaitlistForm from "./WaitlistForm";

export default function MarketingSections({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-secondary/40 to-background">
        <div className="max-w-6xl mx-auto px-5 pt-14 pb-16 md:pt-20 md:pb-24">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
                NAATI CCL practice
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-[1.1]">
                Ace your CCL exam with realistic bilingual practice
              </h1>
              <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
                CCLSaathi gives NAATI CCL candidates structured audio translation exercises
                across eight real-life topic areas. Practise on your schedule, at your pace.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Button size="lg" className="text-base px-6" asChild>
                  {isAuthenticated ? (
                    <a href="#practice">Go to categories</a>
                  ) : (
                    <Link href="/login?tab=signup">Start practising free</Link>
                  )}
                </Button>
                <Button size="lg" variant="outline" className="text-base px-6 bg-background/80" asChild>
                  <a href="#how-it-works">See how it works</a>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Used by candidates preparing for the NAATI Credentialed Community Language test.
              </p>
            </div>
            <div className="relative">
              <div
                className="rounded-xl border border-border bg-card shadow-lg overflow-hidden aspect-[4/3] flex flex-col"
                aria-hidden
              >
                <div className="h-9 border-b border-border bg-muted/50 flex items-center gap-2 px-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/90" />
                  <span className="ml-2 text-[10px] text-muted-foreground font-medium">
                    Practice · Health
                  </span>
                </div>
                <div className="flex-1 p-4 flex flex-col gap-3 bg-gradient-to-br from-secondary/30 to-background">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Headphones className="h-4 w-4 text-primary" />
                    <span>Segment 3 of 12</span>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3 text-sm shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="font-bold text-foreground text-sm leading-tight">
                          AI Score Report
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                          Medical Appointment · Full dialogue
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-400">
                        <span className="h-1 w-1 rounded-full bg-green-600 dark:bg-green-400" />
                        AI scored
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="relative h-11 w-11 shrink-0">
                        <svg
                          className="h-11 w-11 -rotate-90"
                          viewBox="0 0 64 64"
                          aria-hidden
                        >
                          <circle
                            cx="32"
                            cy="32"
                            r="26"
                            fill="none"
                            className="stroke-muted"
                            strokeWidth="6"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r="26"
                            fill="none"
                            className="stroke-green-600"
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray="130 34"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">
                          80
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-green-600 text-sm leading-tight dark:text-green-500">
                          Good
                        </p>
                        <p className="text-[11px] text-foreground/90 mt-0.5">Overall performance</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Above pass threshold (70)
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { label: "Accuracy", score: 85, bar: "bg-green-600" },
                        { label: "Fluency", score: 78, bar: "bg-green-600" },
                        { label: "Terminology", score: 58, bar: "bg-red-600" },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center gap-2">
                          <span className="w-[4.5rem] shrink-0 text-[10px] text-foreground/80">
                            {row.label}
                          </span>
                          <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${row.bar}`}
                              style={{ width: `${row.score}%` }}
                            />
                          </div>
                          <span className="w-5 shrink-0 text-right text-[10px] tabular-nums text-foreground/80">
                            {row.score}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-medium bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-400">
                        Strong opening
                      </span>
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-medium bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400">
                        Medical terms weak
                      </span>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <div className="h-2 flex-1 rounded-full bg-border overflow-hidden">
                      <div className="h-full w-[28%] rounded-full bg-primary" />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">0:42</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border/60 bg-muted/30">
        <div className="max-w-6xl mx-auto px-5 py-10">
          <div className="grid sm:grid-cols-3 gap-8 text-center sm:text-left">
            <div>
              <p className="text-2xl md:text-3xl font-bold text-foreground tabular-nums">500+</p>
              <p className="text-sm text-muted-foreground mt-1">Candidates building confidence</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-bold text-foreground tabular-nums">8</p>
              <p className="text-sm text-muted-foreground mt-1">NAATI topic areas covered</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-bold text-foreground">Real audio</p>
              <p className="text-sm text-muted-foreground mt-1">Dialogue-style segments you can replay</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 border-b border-border/60">
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-20">
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Everything you need to practise seriously
            </h2>
            <p className="mt-2 text-muted-foreground">
              Focus on listening, interpreting, and self-review: the core skills the exam tests.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: Headphones,
                title: "Authentic audio dialogues",
                body: "Listen to realistic bilingual conversations aligned with CCL exam topics.",
              },
              {
                icon: BookOpen,
                title: "Eight exam-relevant categories",
                body: "Health, legal, housing, employment, and more, organised for targeted practice.",
              },
              {
                icon: RefreshCw,
                title: "Replay & self-assess",
                body: "Replay segments, compare with reference material, and improve at your own pace.",
              },
              {
                icon: BarChart3,
                title: "Track your progress",
                body: "See completion at a glance on your dashboard cards.",
                badge: "Growing",
              },
            ].map((item) => (
              <Card key={item.title} className="border-border/80 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    {item.badge ? (
                      <Badge variant="secondary" className="text-[10px] font-semibold">
                        {item.badge}
                      </Badge>
                    ) : null}
                  </div>
                  <h3 className="font-semibold text-foreground mb-1.5">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="scroll-mt-20 bg-secondary/25 border-b border-border/60"
      >
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-20">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-10">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 md:gap-6">
            {[
              {
                step: "1",
                title: "Choose a topic",
                body: "Pick from eight CCL exam categories that match the real test domains.",
                icon: ListChecks,
              },
              {
                step: "2",
                title: "Listen & translate",
                body: "Hear each dialogue segment and record your interpretation.",
                icon: Headphones,
              },
              {
                step: "3",
                title: "Review & improve",
                body: "Compare with references, replay tricky parts, and build consistency.",
                icon: Check,
              },
            ].map((row) => (
              <div key={row.step} className="relative flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {row.step}
                  </span>
                  <div className="hidden md:block flex-1 w-px bg-border mt-3 md:absolute md:left-5 md:top-12 md:h-[calc(100%-2rem)] md:w-px" />
                </div>
                <div>
                  <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center mb-2">
                    <row.icon className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{row.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{row.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-b border-border/60">
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Early access feedback
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-10">
            What candidates are saying
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote:
                  "I was struggling with health and legal dialogues. Being able to practise on my own schedule made a real difference.",
                who: "NAATI CCL candidate",
                where: "Melbourne",
              },
              {
                quote:
                  "The segment-by-segment flow matches how I actually interpret. Replay alone is worth it.",
                who: "NAATI CCL candidate",
                where: "Sydney",
              },
              {
                quote:
                  "Clear categories and real audio. It feels closer to exam pressure than reading scripts.",
                who: "NAATI CCL candidate",
                where: "Brisbane",
              },
            ].map((t) => (
              <Card key={t.where + t.who} className="bg-muted/20 border-border/80">
                <CardContent className="pt-6">
                  <p className="text-sm text-foreground leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                  <p className="mt-4 text-xs text-muted-foreground">
                    {t.who}, {t.where}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 bg-secondary/25 border-b border-border/60">
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-20">
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Simple pricing
            </h2>
            <p className="mt-2 text-muted-foreground">
              Start free, upgrade when you want full access across every dialogue.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
            <Card className="border-border/80">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold">Free</h3>
                <p className="mt-1 text-3xl font-bold text-foreground">$0</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Get started with core practice content. Ideal to try the flow and categories.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-foreground">
                  <li className="flex gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    One practice dialogue per topic
                  </li>
                  <li className="flex gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    Audio replay & segment mode
                  </li>
                  <li className="flex gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    No credit card required
                  </li>
                </ul>
                <Button className="w-full mt-6" variant="outline" asChild>
                  <Link href="/login?tab=signup">Start free</Link>
                </Button>
              </CardContent>
            </Card>
            <Card className="border-primary shadow-md ring-2 ring-primary/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 rounded-bl-lg bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                Most popular
              </div>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold">Pro</h3>
                <p className="mt-1 text-3xl font-bold text-foreground">
                  $19<span className="text-base font-normal text-muted-foreground">/mo</span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Full library access for serious exam preparation.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-foreground">
                  <li className="flex gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    All dialogues in every category
                  </li>
                  <li className="flex gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    Unlimited replay & recordings
                  </li>
                  <li className="flex gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    Progress tracking on your dashboard
                  </li>
                </ul>
                <Button className="w-full mt-6" asChild>
                  <Link href="/login?tab=signup">Get Pro</Link>
                </Button>
                <p className="mt-2 text-xs text-center text-muted-foreground">
                  Billing coming soon. Join waitlist for launch pricing.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Resources / blog anchor */}
      <section id="resources" className="scroll-mt-20 border-b border-border/60">
        <div className="max-w-6xl mx-auto px-5 py-14 md:py-16">
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
            <h2 className="text-lg font-semibold text-foreground">Resources & blog</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-lg mx-auto">
              Exam tips, dialogue updates, and NAATI CCL guidance will live here. Follow the waitlist
              below to hear when we publish.
            </p>
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section id="waitlist" className="bg-primary/5 border-b border-border/60 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-20 text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Be first to get new dialogues and exam tips
          </h2>
          <p className="mt-2 text-muted-foreground max-w-xl mx-auto">
            Leave your email and we&apos;ll only send useful updates about CCLSaathi and the exam.
          </p>
          <div className="mt-8">
            <WaitlistForm />
          </div>
        </div>
      </section>
    </>
  );
}
