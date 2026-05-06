"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const SCRIPT_URL = process.env.NEXT_PUBLIC_WAITLIST_SCRIPT_URL ?? "";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (SCRIPT_URL) {
        const body = new URLSearchParams({ email: trimmed });
        // no-cors: Google Apps Script doesn't set CORS headers; response is opaque but request goes through
        await fetch(SCRIPT_URL, { method: "POST", body, mode: "no-cors" });
      }
    } catch {
      // fire-and-forget — don't block the user on network errors
    } finally {
      setIsSubmitting(false);
    }
    setDone(true);
  }

  if (done) {
    return (
      <p className="text-sm font-medium text-primary">
        You&apos;re on the list. We&apos;ll be in touch with new dialogues and tips.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto"
    >
      <label htmlFor="waitlist-email" className="sr-only">
        Email address
      </label>
      <input
        id="waitlist-email"
        type="email"
        name="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 h-10 rounded-md border border-input bg-background p-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button type="submit" size="lg" className="shrink-0 gap-2" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Join the waitlist
      </Button>
    </form>
  );
}
