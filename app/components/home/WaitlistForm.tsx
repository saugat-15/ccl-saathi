"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const SCRIPT_URL = process.env.NEXT_PUBLIC_WAITLIST_SCRIPT_URL ?? "";

export default function WaitlistForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    if (!trimmedEmail || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (SCRIPT_URL) {
        // no-cors response is opaque (empty body) — don't try to read it
        await fetch(SCRIPT_URL, {
          method: "POST",
          body: JSON.stringify({ name: trimmedName, email: trimmedEmail }),
          mode: "no-cors",
          headers: { "Content-Type": "text/plain" },
        });
      }
    } catch (error) {
      // fire-and-forget — don't block the user on network errors
      console.error('Error submitting waitlist form', error);
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
      <label htmlFor="waitlist-name" className="sr-only">
        Name
      </label>
      <input
        id="waitlist-name"
        type="text"
        name="name"
        autoComplete="name"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 h-10 rounded-md border border-input bg-background p-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
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
