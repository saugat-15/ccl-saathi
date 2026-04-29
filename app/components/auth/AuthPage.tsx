"use client";

import { useState } from "react";
import SignInForm from "./SignInForm";
import SignUpForm from "./SignUpForm";
import PreviewPanel from "./PreviewPanel";
import Logo from "../Logo";

type Tab = "signin" | "signup";

export default function AuthPage({ defaultTab = "signin" }: { defaultTab?: Tab }) {
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel — full width on mobile, fixed 460px on md+ */}
      <div className="flex flex-col justify-center w-full md:max-w-[460px] md:border-r border-border px-6 py-12 sm:px-10 md:px-14">
        {/* Logo */}
        <div className="mb-10">
          <Logo iconSize={36} />
          <p className="mt-3 text-sm text-muted-foreground">
            NAATI CCL exam practice · AI-powered scoring
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 mb-8 border-b border-border">
          {(["signin", "signup"] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                "pb-2.5 -mb-px text-sm font-medium border-b-2 transition-colors",
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              ].join(" ")}
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

      {/* Right panel — hidden on mobile */}
      <div className="hidden md:flex flex-1">
        <PreviewPanel />
      </div>
    </div>
  );
}
