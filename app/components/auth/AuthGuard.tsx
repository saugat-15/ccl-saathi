"use client";

import { usePathname } from "next/navigation";
import { useAuthenticator } from "@aws-amplify/ui-react";
import AuthPage from "./AuthPage";

const PUBLIC_PREFIXES = [
  "/",
  "/login",
  "/privacy",
  "/terms",
  "/contact",
] as const;

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => p !== "/" && pathname === p);
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { authStatus } = useAuthenticator();

  if (authStatus === "configuring") {
    return (
      <div
        className="min-h-screen bg-background"
        aria-busy="true"
        aria-label="Loading session"
      />
    );
  }

  if (authStatus !== "authenticated" && !isPublicPath(pathname)) {
    return <AuthPage />;
  }

  return <>{children}</>;
}
