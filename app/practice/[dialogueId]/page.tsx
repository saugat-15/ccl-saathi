"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { generateClient } from "aws-amplify/data";
import { uploadData } from "aws-amplify/storage";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import type { Schema } from "@/amplify/data/resource";
import AudioRecorder from "@/app/components/AudioRecorder";

const client = generateClient<Schema>();

type SegmentRecording = {
  blob: Blob | null;
  mimeType: string | null;
  status: "idle" | "recorded";
};

export default function PracticePage({ params }: { params: { dialogueId: string } }) {
  const router = useRouter();
  const { dialogueId } = params;

  const [dialogue, setDialogue] = useState<Schema["Dialogue"]["type"] | null>(null);
  const [segments, setSegments] = useState<SegmentRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitDone, setSubmitDone] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await client.models.Dialogue.get({ id: dialogueId });
        if (!data) {
          setLoadError("Dialogue not found.");
          return;
        }
        setDialogue(data);
        const count = data.segmentCount ?? 0;
        setSegments(Array.from({ length: count }, () => ({ blob: null, mimeType: null, status: "idle" as const })));
      } catch {
        setLoadError("Failed to load dialogue. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [dialogueId]);

  const handleSegmentRecorded = useCallback((index: number, blob: Blob, mimeType: string) => {
    setSegments((prev) => {
      const next = [...prev];
      next[index] = { blob, mimeType, status: "recorded" };
      return next;
    });
  }, []);

  async function handleSubmit() {
    if (!dialogue) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { userId } = await getCurrentUser();
      const session = await fetchAuthSession();
      const identityId = session.identityId;

      if (!identityId) {
        throw new Error("Could not determine identity. Please sign out and sign in again.");
      }

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (!seg.blob || !seg.mimeType) continue;

        // Step 1: Create DynamoDB record to get the auto-generated ID
        const { data: recording, errors } = await client.models.Recording.create({
          userId,
          dialogueId: dialogue.id,
          s3Key: "pending",
          status: "UPLOADED",
          attemptNumber: 1,
        });

        if (errors || !recording) {
          throw new Error(`Failed to create recording record for segment ${i + 1}.`);
        }

        // Step 2: Build S3 key using the DynamoDB record ID
        const ext = seg.mimeType.includes("webm") ? "webm" : "mp4";
        const s3Key = `recordings/${identityId}/${recording.id}.${ext}`;

        // Step 3: Upload to S3 — this triggers the Lambda
        await uploadData({
          path: s3Key,
          data: seg.blob,
          options: { contentType: seg.mimeType },
        }).result;

        // Step 4: Update DynamoDB record with final s3Key
        await client.models.Recording.update({ id: recording.id, s3Key });
      }

      setSubmitDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const allRecorded = segments.length > 0 && segments.every((s) => s.status === "recorded");

  if (isLoading) {
    return <main style={pageStyle}><p style={{ color: "#6b7280" }}>Loading dialogue...</p></main>;
  }

  if (loadError) {
    return (
      <main style={pageStyle}>
        <p style={{ color: "#ef4444" }}>{loadError}</p>
        <button onClick={() => router.push("/")} style={linkBtnStyle}>Back to dialogues</button>
      </main>
    );
  }

  if (!dialogue) return null;

  if (!dialogue.segmentCount || dialogue.segmentCount < 1) {
    return (
      <main style={pageStyle}>
        <p style={{ color: "#6b7280" }}>This dialogue has no segments configured.</p>
        <button onClick={() => router.push("/")} style={linkBtnStyle}>Back to dialogues</button>
      </main>
    );
  }

  if (submitDone) {
    return (
      <main style={pageStyle}>
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "1.5rem", textAlign: "center" }}>
          <h2 style={{ margin: "0 0 0.5rem", color: "#16a34a" }}>Submitted!</h2>
          <p style={{ margin: "0 0 1rem", color: "#4b5563" }}>
            Your recordings have been submitted. We'll process them and you'll see feedback soon.
          </p>
          <button onClick={() => router.push("/")} style={btnStyle("#2563eb", false)}>
            Back to dialogues
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={{ marginBottom: "1.5rem" }}>
        <button onClick={() => router.push("/")} style={linkBtnStyle}>
          ← Back
        </button>
        <h1 style={{ margin: "0.5rem 0 0.25rem", fontSize: "1.5rem", fontWeight: 700 }}>{dialogue.title}</h1>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "0.875rem" }}>
          {dialogue.segmentCount} segment{dialogue.segmentCount !== 1 ? "s" : ""} — record your interpretation for each one
        </p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        {segments.map((seg, i) => (
          <div
            key={i}
            style={{
              border: `1px solid ${seg.status === "recorded" ? "#86efac" : "#e5e7eb"}`,
              borderRadius: 10,
              padding: "1rem 1.25rem",
              background: seg.status === "recorded" ? "#f0fdf4" : "white",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Segment {i + 1}</span>
              {seg.status === "recorded" && (
                <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 600 }}>Recorded</span>
              )}
            </div>
            <AudioRecorder
              onRecordingComplete={(blob, mimeType) => handleSegmentRecorded(i, blob, mimeType)}
              isDisabled={isSubmitting}
            />
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}>
        {submitError && (
          <p style={{ color: "#ef4444", fontSize: "0.875rem", marginBottom: "0.75rem" }}>{submitError}</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={!allRecorded || isSubmitting}
          style={btnStyle("#2563eb", !allRecorded || isSubmitting)}
        >
          {isSubmitting ? "Submitting..." : `Submit All ${segments.length} Recordings`}
        </button>
        {!allRecorded && !isSubmitting && (
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "#9ca3af" }}>
            Record all segments before submitting.
          </p>
        )}
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" };

function btnStyle(bg: string, disabled: boolean): React.CSSProperties {
  return {
    padding: "0.6rem 1.25rem",
    borderRadius: 8,
    border: "none",
    background: disabled ? "#d1d5db" : bg,
    color: "white",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: "0.9rem",
    fontWeight: 600,
  };
}

const linkBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#2563eb",
  cursor: "pointer",
  fontSize: "0.875rem",
  padding: 0,
};
