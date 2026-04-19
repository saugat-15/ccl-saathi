"use client";

import { useState } from "react";
import SignInForm from "./SignInForm";
import SignUpForm from "./SignUpForm";
import PreviewPanel from "./PreviewPanel";

type Tab = "signin" | "signup";

export default function AuthPage({ defaultTab = "signin" }: { defaultTab?: Tab }) {
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#fff" }}>
      {/* Left panel */}
      <div
        style={{
          flex: "0 0 460px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "3rem 3.5rem",
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: "2.5rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0 }}>
            <span style={{ color: "#111827" }}>CCL</span>
            <span style={{ color: "#16a34a" }}>Saathi</span>
          </h1>
          <p style={{ margin: "0.4rem 0 0", color: "#6b7280", fontSize: "0.9rem" }}>
            NAATI CCL exam practice · AI-powered scoring
          </p>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            marginBottom: "2rem",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          {(["signin", "signup"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: "none",
                border: "none",
                borderBottom:
                  activeTab === tab ? "2px solid #16a34a" : "2px solid transparent",
                padding: "0.5rem 0",
                marginBottom: "-1px",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: 500,
                color: activeTab === tab ? "#111827" : "#6b7280",
              }}
            >
              {tab === "signin" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        {activeTab === "signin" ? (
          <SignInForm onSwitchToSignUp={() => setActiveTab("signup")} />
        ) : (
          <SignUpForm onSwitchToSignIn={() => setActiveTab("signin")} />
        )}
      </div>

      {/* Right panel */}
      <PreviewPanel />
    </div>
  );
}
