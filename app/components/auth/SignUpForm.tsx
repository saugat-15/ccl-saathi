"use client";

import { useState } from "react";
import { signUp, confirmSignUp, signIn } from "aws-amplify/auth";

type Step = "form" | "confirm";

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

export default function SignUpForm({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signUp({ username: email, password, options: { userAttributes: { email } } });
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      await signIn({ username: email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "confirm") {
    return (
      <form
        onSubmit={handleConfirm}
        style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
      >
        <p style={{ color: "#6b7280", fontSize: "0.875rem", margin: 0 }}>
          We sent a verification code to <strong style={{ color: "#374151" }}>{email}</strong>.
        </p>

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
            Verification code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            required
            style={inputStyle}
          />
        </div>

        {error && <p style={{ color: "#dc2626", fontSize: "0.85rem", margin: 0 }}>{error}</p>}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Verifying…" : "Verify email"}
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSignUp}
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
    >
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
        <label
          style={{
            display: "block",
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "#374151",
            marginBottom: "0.5rem",
          }}
        >
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create a password"
          required
          style={inputStyle}
        />
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: "0.85rem", margin: 0 }}>{error}</p>}

      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? "Creating account…" : "Create account"}
      </button>

      <p style={{ textAlign: "center", fontSize: "0.875rem", color: "#6b7280", margin: 0 }}>
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToSignIn}
          style={{
            background: "none",
            border: "none",
            color: "#16a34a",
            cursor: "pointer",
            padding: 0,
            fontSize: "0.875rem",
          }}
        >
          Sign in
        </button>
      </p>
    </form>
  );
}
