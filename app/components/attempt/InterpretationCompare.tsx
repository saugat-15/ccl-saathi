"use client";

import { diffWords } from "diff";

type Props = {
  userPortion: string;
  expectedInterpretation: string;
};

function HighlightedText({
  text,
  compareTo,
  mode,
}: {
  text: string;
  compareTo: string;
  /** omission: highlight tokens in `text` missing from compareTo; addition: highlight tokens in text not in compareTo */
  mode: "omission" | "addition";
}) {
  const parts =
    mode === "omission"
      ? diffWords(text, compareTo)
      : diffWords(compareTo, text);

  return (
    <span className="leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        const highlight =
          mode === "omission"
            ? Boolean(part.removed)
            : Boolean(part.added);
        if (!part.value) return null;
        if (!highlight) {
          return <span key={i}>{part.value}</span>;
        }
        return (
          <mark
            key={i}
            className="rounded-sm"
            style={
              mode === "omission"
                ? {
                    background: "color-mix(in srgb, var(--score-low) 28%, transparent)",
                    color: "var(--score-low)",
                    padding: "1px 4px",
                    marginInline: 1,
                  }
                : {
                    /* amber-400 pops on dark; amber-500 reads muddy */
                    background: "color-mix(in srgb, var(--amber-400) 38%, transparent)",
                    color: "var(--amber-400)",
                    boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--amber-400) 45%, transparent)",
                    padding: "1px 4px",
                    marginInline: 1,
                  }
            }
          >
            {part.value}
          </mark>
        );
      })}
    </span>
  );
}

export default function InterpretationCompare({
  userPortion,
  expectedInterpretation,
}: Props) {
  const yours = userPortion.trim();
  const expected = expectedInterpretation.trim();

  if (!expected && !yours) return null;

  return (
    <div className="mt-2 space-y-2.5">
      <div className="space-y-1">
        <p
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--fg-muted)" }}
        >
          Your interpretation
        </p>
        {yours ? (
          <p className="text-xs" style={{ color: "var(--fg-default)" }}>
            <HighlightedText text={yours} compareTo={expected} mode="addition" />
          </p>
        ) : (
          <p className="text-xs italic" style={{ color: "var(--fg-muted)" }}>
            No interpretation detected for this segment
          </p>
        )}
      </div>

      <div className="space-y-1">
        <p
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--fg-muted)" }}
        >
          Expected interpretation
        </p>
        {expected ? (
          <p className="text-xs" style={{ color: "var(--fg-default)" }}>
            <HighlightedText text={expected} compareTo={yours} mode="omission" />
          </p>
        ) : (
          <p className="text-xs italic" style={{ color: "var(--fg-muted)" }}>
            Expected text unavailable
          </p>
        )}
      </div>

      {(yours || expected) && (
        <p className="text-[10px]" style={{ color: "var(--fg-subtle)" }}>
          <span style={{ color: "var(--score-low)" }}>Red</span> = missing from yours
          {" · "}
          <span style={{ color: "var(--amber-400)" }}>Amber</span> = extra / different in yours
        </p>
      )}
    </div>
  );
}
