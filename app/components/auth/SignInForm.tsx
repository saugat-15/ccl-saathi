"use client";

import { useState } from "react";
import { signIn } from "aws-amplify/auth";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.75rem 1rem",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  fontSize: "0.95rem",
  color: "#111827",
  outline: "none",
  backgroundColor: "#fff",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.85rem",
  backgroundColor: "#15803d",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "1rem",
  fontWeight: 600,
  cursor: "pointer",
};

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
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <label
          style={{
            display: "block",
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "#374151",
            marginBottom: "0.5rem",
          }}
        >
          Email address
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          style={inputStyle}
        />
      </div>

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.5rem",
          }}
        >
          <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "#374151" }}>
            Password
          </label>
          <a href="#" style={{ fontSize: "0.8rem", color: "#16a34a" }}>
            Forgot password?
          </a>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          required
          style={inputStyle}
        />
      </div>

      {error && (
        <p style={{ color: "#dc2626", fontSize: "0.85rem", margin: 0 }}>{error}</p>
      )}

      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <p style={{ textAlign: "center", fontSize: "0.875rem", color: "#6b7280", margin: 0 }}>
        No account?{" "}
        <button
          type="button"
          onClick={onSwitchToSignUp}
          style={{
            background: "none",
            border: "none",
            color: "#16a34a",
            cursor: "pointer",
            padding: 0,
            fontSize: "0.875rem",
          }}
        >
          Create one free
        </button>
      </p>
    </form>
  );
}
