"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthenticator } from "@aws-amplify/ui-react";
import AuthPage from "@/app/components/auth/AuthPage";

type Tab = "signin" | "signup";

export default function LoginView({ defaultTab }: { defaultTab: Tab }) {
  const router = useRouter();
  const { authStatus } = useAuthenticator();

  useEffect(() => {
    if (authStatus === "authenticated") {
      router.replace("/");
    }
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
