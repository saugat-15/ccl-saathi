"use client";

import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
Amplify.configure(outputs, { ssr: true });

import { useState } from "react";
import { signIn } from "aws-amplify/auth";
import { toUserFacingError } from "@/lib/userFacingError";

export default function SignInForm({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn({ username: email, password });
    } catch (err) {
      setError(toUserFacingError(err, "Sign in failed. Please check your email and password."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="signin-email" className="text-sm font-medium text-foreground">
          Email address
        </label>
        <input
          id="signin-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring transition"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="signin-password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <a href="#" className="text-xs text-primary hover:underline">
            Forgot password?
          </a>
        </div>
        <input
          id="signin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          required
          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring transition"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <button
          type="button"
          onClick={onSwitchToSignUp}
          className="text-primary font-medium hover:underline"
        >
          Create one free
        </button>
      </p>
    </form>
  );
}
