"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    try {
      window.localStorage.setItem(
        "ccl-saathi-waitlist-email",
        JSON.stringify({ email: trimmed, at: Date.now() })
      );
    } catch {
      /* ignore */
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
        className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button type="submit" size="lg" className="shrink-0">
        Join the waitlist
      </Button>
    </form>
  );
}
