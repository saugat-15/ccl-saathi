"use client";

import { useEffect, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

export type StreakData = {
  currentStreak: number;
  longestStreak: number;
  isSuperUser: boolean;
  loginDates: string[];  // YYYY-MM-DD strings
};

type UseStreakResult = {
  data: StreakData | null;
  isLoading: boolean;
};

export function useStreak(userId: string | null): UseStreakResult {
  const [data, setData] = useState<StreakData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setData(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    client.models.LoginStreak.list({
      filter: { userId: { eq: userId } },
    })
      .then((result) => {
        if (cancelled) return;
        const record = result.data?.[0];
        if (!record) {
          setData(null);
          return;
        }
        setData({
          currentStreak: record.currentStreak ?? 0,
          longestStreak: record.longestStreak ?? 0,
          isSuperUser: record.isSuperUser ?? false,
          loginDates: (record.loginDates ?? []).filter((d): d is string => d !== null),
        });
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { data, isLoading };
}
