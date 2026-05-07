"use client";

import { useEffect, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

export type ScoreDataPoint = {
  date: string;       // ISO date string "YYYY-MM-DD"
  score: number;      // overallScore 0–100
  dialogueId: string;
};

type UseScoreHistoryResult = {
  data: ScoreDataPoint[];
  isLoading: boolean;
};

export function useScoreHistory(userId: string | null): UseScoreHistoryResult {
  const [data, setData] = useState<ScoreDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setData([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    client.models.Feedback.list({
      filter: { userId: { eq: userId } },
    })
      .then((result) => {
        if (cancelled) return;
        const points = result.data
          .filter(
            (item): item is typeof item & { overallScore: number; createdAt: string } =>
              typeof item.overallScore === "number" && typeof item.createdAt === "string",
          )
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((item) => ({
            date: item.createdAt.slice(0, 10),
            score: Math.round(item.overallScore),
            dialogueId: item.dialogueId,
          }));
        setData(points);
      })
      .catch(() => {
        if (!cancelled) setData([]);
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
