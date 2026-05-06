import type { Metadata } from "next";
import { Mail, MessageCircle, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the CCLSaathi team.",
};

const CONTACT_EMAIL = "saugatgiri15@gmail.com";
const SUPPORT_EMAIL = "saugatgiri15@gmail.com";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-5 py-14">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Get in touch
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Contact Us</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Have a question, found a bug, or want to share feedback? We&rsquo;d love to hear from you.
          We&rsquo;re a small team and aim to respond within one business day.
        </p>

        <div className="mt-10 grid gap-5">

          <div className="rounded-xl border border-border bg-card px-6 py-5 flex gap-4 items-start">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <MessageCircle className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">General enquiries</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Questions about CCLSaathi, partnerships, or anything else.
              </p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="mt-2 inline-block text-sm text-primary hover:underline font-medium"
              >
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card px-6 py-5 flex gap-4 items-start">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Mail className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Support</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Technical issues, account problems, or billing questions.
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-2 inline-block text-sm text-primary hover:underline font-medium"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card px-6 py-5 flex gap-4 items-start">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Response time</p>
              <p className="mt-1 text-sm text-muted-foreground">
                We typically respond within <strong className="text-foreground">1 business day</strong>{" "}
                (Monday–Friday, AEST). For urgent issues please include &ldquo;URGENT&rdquo; in your
                subject line.
              </p>
            </div>
          </div>

        </div>

        <div className="mt-10 rounded-xl bg-muted/40 border border-border px-6 py-5">
          <p className="text-sm font-semibold text-foreground mb-1">Tips for faster support</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-outside ml-4">
            <li>Include your account email address.</li>
            <li>Describe what you were doing when the issue occurred.</li>
            <li>Attach a screenshot if relevant.</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
