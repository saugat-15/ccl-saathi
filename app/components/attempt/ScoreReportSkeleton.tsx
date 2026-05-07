"use client";

import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  caption?: string;
  subCaption?: string;
};

export function ScoreReportSkeleton({ caption, subCaption }: Props) {
  return (
    <div
      className="rounded-xl border p-6 space-y-6"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-7 w-24 rounded-full shrink-0" />
      </div>

      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-full shrink-0" />
        <div className="space-y-2 flex-1 min-w-0">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-52 max-w-full" />
        </div>
      </div>

      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-24 shrink-0" />
            <Skeleton className="flex-1 h-1.5 rounded-full" />
            <Skeleton className="h-4 w-8 shrink-0" />
          </div>
        ))}
      </div>

      {caption && (
        <p className="text-xs text-center pt-2" style={{ color: "var(--fg-muted)" }}>
          {caption}
        </p>
      )}
      {subCaption && (
        <p className="text-xs text-center" style={{ color: "var(--fg-subtle)" }}>
          {subCaption}
        </p>
      )}
    </div>
  );
}
