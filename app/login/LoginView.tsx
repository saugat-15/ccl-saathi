"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { fetchAuthSession } from "aws-amplify/auth";
import AuthPage from "@/app/components/auth/AuthPage";

type Tab = "signin" | "signup";

export default function LoginView({ defaultTab }: { defaultTab: Tab }) {
  const router = useRouter();
  const { authStatus } = useAuthenticator();

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let cancelled = false;
    (async () => {
      // Wait for Cognito Identity credentials before landing on home Storage reads
      try {
        let session = await fetchAuthSession();
        if (!session.credentials) {
          session = await fetchAuthSession({ forceRefresh: true });
        }
      } catch {
        // Still navigate — home grid retries Storage with auth-ready gating
      }
      if (!cancelled) router.replace("/");
    })();
    return () => {
      cancelled = true;
    };
  }, [authStatus, router]);

  if (authStatus === "authenticated") {
    return (
      <div
        className="min-h-screen bg-background"
        aria-busy="true"
        aria-label="Redirecting"
      />
    );
  }

  return <AuthPage defaultTab={defaultTab} />;
}
