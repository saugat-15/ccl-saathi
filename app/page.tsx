"use client";

import { useAuthenticator } from "@aws-amplify/ui-react";
import MarketingSections from "@/app/components/home/MarketingSections";
import CategoryPracticeGrid from "@/app/components/home/CategoryPracticeGrid";

export default function HomePage() {
  const { authStatus } = useAuthenticator();
  const isAuthenticated = authStatus === "authenticated";

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <CategoryPracticeGrid />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketingSections isAuthenticated={false} />
      <CategoryPracticeGrid />
    </div>
  );
}
