"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { generateClient } from "aws-amplify/data";
import { uploadData, downloadData, getUrl, list } from "aws-amplify/storage";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import type { Schema } from "@/amplify/data/resource";
import AudioRecorder from "@/app/components/AudioRecorder";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { markDialogueCompleted, notifyProgressUpdated } from "@/lib/progress";
import { ChevronLeft, Headphones, LayoutList, Play, Pause, Loader2, CheckCircle2, Lock } from "lucide-react";

const client = generateClient<Schema>();

type Mode = "full" | "segments";

type TranscriptSegment = {
  segmentIndex: number;
  speaker: string;
  original: string;
  translation: string | null;
  expectedInterpretation: string;
  audioKey: string;
  startTime: number;
  endTime: number;
};

type SegmentState = {
  blob: Blob | null;
  mimeType: string | null;
  recordedUrl: string | null;
  recorded: boolean;
};

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function toLabel(s: string) {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Audio player ─────────────────────────────────────────────────────────────
function AudioPlayer({ audioUrl }: { audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  function handlePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (el.ended) el.currentTime = 0;
    el.play();
    setIsPlaying(true);
  }
  function handlePause() { audioRef.current?.pause(); setIsPlaying(false); }
  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const el = audioRef.current;
    if (!el) return;
    const t = (parseFloat(e.target.value) / 100) * duration;
    el.currentTime = t;
    setCurrentTime(t);
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: "var(--bg-sunken)", border: "1px solid var(--border-subtle)",
      borderRadius: 12, padding: "12px 16px",
    }}>
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
        onPause={() => setIsPlaying(false)}
      />
      <button
        type="button"
        onClick={isPlaying ? handlePause : handlePlay}
        style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "var(--brand)", border: "none",
          cursor: "pointer", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "var(--shadow-brand)",
        }}
      >
        {isPlaying
          ? <Pause className="h-3 w-3 text-white fill-white" />
          : <Play className="h-3 w-3 text-white fill-white ml-0.5" />
        }
      </button>
      {/* Progress track + timestamps */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
        <input
          type="range" min={0} max={100} step={0.1} value={pct}
          onChange={handleSeek}
          className="audio-range"
          style={{
            width: "100%",
            background: `linear-gradient(to right, var(--brand) 0%, var(--brand) ${pct}%, var(--border-subtle) ${pct}%, var(--border-subtle) 100%)`,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)" }}>
            {fmt(currentTime)}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>
            {duration > 0 ? fmt(duration) : "--:--"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PracticePage({ params }: { params: { dialogueId: string } }) {
  const router = useRouter();

  const basePath = atob(decodeURIComponent(params.dialogueId));
  const category = basePath.split("/")[1] ?? "";

  const [mode, setMode] = useState<Mode | null>(null);
  const [fullAudioUrl, setFullAudioUrl] = useState<string | null>(null);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [segmentAudioUrls, setSegmentAudioUrls] = useState<(string | null)[]>([]);
  const [scenario, setScenario] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fullRecording, setFullRecording] = useState<SegmentState>({ blob: null, mimeType: null, recordedUrl: null, recorded: false });
  const [segmentStates, setSegmentStates] = useState<SegmentState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitDone, setSubmitDone] = useState(false);

  useEffect(() => {
    if (!mode) return;
    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const folder = basePath.split("/").slice(0, -1).join("/") + "/";
        const audioResult = await getUrl({ path: `${basePath}.mp3` }).catch(() => null);
        if (audioResult) setFullAudioUrl(audioResult.url.toString());

        if (mode === "segments") {
          const { items } = await list({ path: folder });
          const jsonItem = items.find((item) => item.path.endsWith(".json"));
          if (!jsonItem) throw new Error("No transcript found for this dialogue.");

          const { body } = await downloadData({ path: jsonItem.path }).result;
          const json = JSON.parse(await body.text()) as { scenario?: string; segments?: TranscriptSegment[] };
          if (json.scenario) setScenario(json.scenario);
          const segs = (json.segments ?? []).sort((a, b) => a.segmentIndex - b.segmentIndex);
          if (segs.length === 0) throw new Error("Transcript has no segments.");

          setTranscriptSegments(segs);
          setSegmentStates(segs.map(() => ({ blob: null, mimeType: null, recordedUrl: null, recorded: false })));
          setCurrentIndex(0);

          const urlResults = await Promise.allSettled(segs.map((seg) => getUrl({ path: seg.audioKey })));
          setSegmentAudioUrls(urlResults.map((r) => r.status === "fulfilled" ? r.value.url.toString() : null));
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load dialogue.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    return () => {
      if (fullRecording.recordedUrl) URL.revokeObjectURL(fullRecording.recordedUrl);
      segmentStates.forEach((s) => { if (s.recordedUrl) URL.revokeObjectURL(s.recordedUrl); });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSegmentRecorded(index: number, blob: Blob, mimeType: string) {
    setSegmentStates((prev) => {
      const next = [...prev];
      const old = next[index];
      if (old.recordedUrl) URL.revokeObjectURL(old.recordedUrl);
      next[index] = { blob, mimeType, recordedUrl: URL.createObjectURL(blob), recorded: true };
      return next;
    });
    if (index === currentIndex) setCurrentIndex(index + 1);
  }

  function handleSegmentReRecord(index: number) {
    setSegmentStates((prev) => {
      const next = [...prev];
      const old = next[index];
      if (old?.recordedUrl) URL.revokeObjectURL(old.recordedUrl);
      next[index] = { blob: null, mimeType: null, recordedUrl: null, recorded: false };
      return next;
    });
  }

  function handleFullRecorded(blob: Blob, mimeType: string) {
    if (fullRecording.recordedUrl) URL.revokeObjectURL(fullRecording.recordedUrl);
    setFullRecording({ blob, mimeType, recordedUrl: URL.createObjectURL(blob), recorded: true });
  }

  function handleFullReRecord() {
    if (fullRecording.recordedUrl) URL.revokeObjectURL(fullRecording.recordedUrl);
    setFullRecording({ blob: null, mimeType: null, recordedUrl: null, recorded: false });
  }

  async function handleSubmit(recordings: SegmentState[]) {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const { userId } = await getCurrentUser();
      const { identityId } = await fetchAuthSession();
      if (!identityId) throw new Error("Could not determine identity. Please sign out and sign in again.");

      for (let i = 0; i < recordings.length; i++) {
        const seg = recordings[i];
        if (!seg.blob || !seg.mimeType) continue;

        const { data: recording, errors } = await client.models.Recording.create({
          userId, dialogueId: basePath, s3Key: "pending", status: "UPLOADED", attemptNumber: 1,
        });
        if (errors || !recording) throw new Error(`Failed to create record for segment ${i + 1}.`);

        const ext = seg.mimeType.includes("webm") ? "webm" : "mp4";
        const s3Key = `recordings/${identityId}/${recording.id}.${ext}`;
        await uploadData({ path: s3Key, data: seg.blob, options: { contentType: seg.mimeType } }).result;
        await client.models.Recording.update({ id: recording.id, s3Key });
      }
      markDialogueCompleted(basePath);
      notifyProgressUpdated();
      setSubmitDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitDone) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
        borderRadius: 18, padding: "40px 32px",
        width: "100%", maxWidth: 400, textAlign: "center",
        boxShadow: "var(--shadow-md)",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "var(--forest-50)", border: "2px solid var(--forest-200)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <CheckCircle2 style={{ width: 28, height: 28, color: "var(--success)" }} />
        </div>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600,
          color: "var(--fg-strong)", margin: "0 0 8px" }}>Submitted!</h2>
        <p style={{ fontSize: 14, color: "var(--fg-muted)", margin: "0 0 24px", lineHeight: 1.5 }}>
          We&apos;ll process your recordings shortly.
        </p>
        <button
          onClick={() => router.push(`/category/${category}`)}
          style={{
            width: "100%", padding: "11px 20px", borderRadius: 10,
            background: "var(--brand)", border: "none", color: "#fff",
            fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
            cursor: "pointer", boxShadow: "var(--shadow-brand)",
          }}
        >
          Back to {toLabel(category)}
        </button>
      </div>
    </div>
  );

  // ── Mode selection ────────────────────────────────────────────────────────
  if (!mode) return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <Button
          variant="ghost" size="sm"
          onClick={() => router.push(`/category/${category}`)}
          className="gap-1.5 -ml-2 mb-6 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {toLabel(category)}
        </Button>

        <div className="mb-6">
          <span style={{
            fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
            fontWeight: 700, color: "var(--amber-700)", background: "var(--amber-50)",
            padding: "4px 8px", borderRadius: 4,
          }}>
            {toLabel(category).toUpperCase()}
          </span>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600,
            color: "var(--fg-strong)", margin: "12px 0 4px", lineHeight: 1.2 }}>
            Choose practice mode
          </h1>
          <p style={{ fontSize: 14, color: "var(--fg-muted)", margin: 0 }}>
            How would you like to practise this dialogue?
          </p>
        </div>

        <Separator className="mb-6" />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { key: "full" as Mode, icon: Headphones, title: "Full Dialogue",
              desc: "Listen to the complete dialogue and record your interpretation in one go." },
            { key: "segments" as Mode, icon: LayoutList, title: "By Segments",
              desc: "Work through each segment one at a time, listening and recording in order." },
          ].map(({ key, icon: Icon, title, desc }) => (
            <div
              key={key}
              onClick={() => setMode(key)}
              style={{
                background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
                borderRadius: 14, padding: "18px 20px",
                cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 16,
                transition: "all 0.2s cubic-bezier(0.22,1,0.36,1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--forest-300)";
                e.currentTarget.style.boxShadow = "var(--shadow-md)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-subtle)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "none";
              }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: "var(--forest-50)", border: "1px solid var(--forest-100)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Icon style={{ width: 20, height: 20, color: "var(--brand)" }} />
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: 15, color: "var(--fg-strong)", margin: "0 0 4px" }}>
                  {title}
                </p>
                <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: 0, lineHeight: 1.45 }}>
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Loading / error ───────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <Button variant="ghost" size="sm" onClick={() => setMode(null)} className="gap-1.5 -ml-2 mb-6 text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </div>
    </div>
  );

  if (loadError) return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <Button variant="ghost" size="sm" onClick={() => setMode(null)} className="gap-1.5 -ml-2 mb-6 text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          {loadError}
        </p>
      </div>
    </div>
  );

  // ── Full mode ─────────────────────────────────────────────────────────────
  if (mode === "full") return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <Button variant="ghost" size="sm" onClick={() => setMode(null)} className="gap-1.5 -ml-2 mb-6 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Practice mode
        </Button>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <span style={{
            fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
            fontWeight: 700, color: "var(--amber-700)", background: "var(--amber-50)",
            padding: "3px 8px", borderRadius: 4,
          }}>
            {toLabel(category)}
          </span>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600,
            color: "var(--fg-strong)", margin: "10px 0 4px", lineHeight: 1.2 }}>
            Full Dialogue
          </h1>
          <p style={{ fontSize: 14, color: "var(--fg-muted)", margin: 0 }}>
            Listen to the full dialogue, then record your interpretation in one take.
          </p>
        </div>

        {/* Scenario card */}
        {scenario && (
          <div style={{
            background: "var(--bg-sunken)", border: "1px solid var(--border-subtle)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 20,
            display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>📋</span>
            <p style={{ fontSize: 13, color: "var(--fg-default)", margin: 0, lineHeight: 1.55 }}>
              {scenario}
            </p>
          </div>
        )}

        <Separator style={{ marginBottom: 20 }} />

        {/* Reference audio */}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
          borderRadius: 14, overflow: "hidden", marginBottom: 12,
        }}>
          <div style={{
            padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Headphones style={{ width: 14, height: 14, color: "var(--fg-muted)" }} />
            <p style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
              fontWeight: 700, color: "var(--fg-muted)", margin: 0 }}>Reference audio</p>
          </div>
          <div style={{ padding: "14px 16px" }}>
            {fullAudioUrl
              ? <AudioPlayer audioUrl={fullAudioUrl} />
              : <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: 0 }}>Audio unavailable.</p>
            }
          </div>
        </div>

        {/* Recorder */}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
          borderRadius: 14, padding: "16px", marginBottom: 20,
        }}>
          <p style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
            fontWeight: 700, color: "var(--fg-muted)", margin: "0 0 12px" }}>
            Your interpretation
          </p>
          <AudioRecorder
            onRecordingComplete={handleFullRecorded}
            onReRecordStart={handleFullReRecord}
            isDisabled={isSubmitting}
          />
        </div>

        {submitError && (
          <p style={{ fontSize: 13, color: "var(--danger)", background: "var(--danger-soft)",
            border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8,
            padding: "10px 14px", marginBottom: 16 }}>
            {submitError}
          </p>
        )}
        <button
          onClick={() => handleSubmit([fullRecording])}
          disabled={!fullRecording.recorded || isSubmitting}
          style={{
            padding: "11px 28px", borderRadius: 10,
            background: fullRecording.recorded && !isSubmitting ? "var(--brand)" : "var(--bg-sunken)",
            border: "none",
            color: fullRecording.recorded && !isSubmitting ? "#fff" : "var(--fg-muted)",
            fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
            cursor: fullRecording.recorded && !isSubmitting ? "pointer" : "not-allowed",
            boxShadow: fullRecording.recorded && !isSubmitting ? "var(--shadow-brand)" : "none",
            transition: "all 0.15s",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</> : "Submit recording"}
        </button>
      </div>
    </div>
  );

  // ── Segments mode ─────────────────────────────────────────────────────────
  const allRecorded = segmentStates.length > 0 && segmentStates.every((s) => s.recorded);
  const completedCount = segmentStates.filter((s) => s.recorded).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <Button variant="ghost" size="sm" onClick={() => setMode(null)} className="gap-1.5 -ml-2 mb-6 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Practice mode
        </Button>

        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <span style={{
            fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
            fontWeight: 700, color: "var(--amber-700)", background: "var(--amber-50)",
            padding: "3px 8px", borderRadius: 4,
          }}>
            {toLabel(category)}
          </span>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600,
            color: "var(--fg-strong)", margin: "10px 0 4px", lineHeight: 1.2 }}>
            Segment by segment
          </h1>
          <p style={{ fontSize: 14, color: "var(--fg-muted)", margin: 0 }}>
            Listen and record your interpretation for each segment in order.
          </p>
        </div>

        {/* Scenario card */}
        {scenario && (
          <div style={{
            background: "var(--bg-sunken)", border: "1px solid var(--border-subtle)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 16,
            display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>📋</span>
            <p style={{ fontSize: 13, color: "var(--fg-default)", margin: 0, lineHeight: 1.55 }}>
              {scenario}
            </p>
          </div>
        )}

        {/* Progress bar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
            {segmentStates.map((seg, i) => (
              <div
                key={i}
                style={{
                  height: 5, flex: 1, borderRadius: 3,
                  background: seg.recorded
                    ? "var(--success)"
                    : i <= currentIndex
                      ? "var(--forest-200)"
                      : "var(--border-subtle)",
                  transition: "background 0.2s",
                }}
              />
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--fg-muted)", fontFamily: "var(--font-mono)", margin: 0 }}>
            {completedCount} of {segmentStates.length} segments recorded
          </p>
        </div>

        <Separator style={{ marginBottom: 16 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {segmentStates.map((seg, i) => {
            const segAudioUrl = segmentAudioUrls[i];
            const transcript = transcriptSegments[i];
            const isUnlocked = i <= currentIndex;
            const isDone = seg.recorded;
            const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

            return (
              <div
                key={i}
                style={{
                  background: "var(--bg-surface)",
                  border: `1px solid ${isDone ? "var(--forest-200)" : "var(--border-subtle)"}`,
                  borderRadius: 14, overflow: "hidden",
                  opacity: isUnlocked ? 1 : 0.5,
                  transition: "opacity 0.2s, border-color 0.2s",
                }}
              >
                {/* Segment header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 16px",
                  background: isDone ? "var(--forest-50)" : "var(--bg-sunken)",
                  borderBottom: `1px solid ${isDone ? "var(--forest-100)" : "var(--border-subtle)"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    {isDone ? (
                      <CheckCircle2 style={{ width: 13, height: 13, color: "var(--success)" }} />
                    ) : !isUnlocked ? (
                      <Lock style={{ width: 13, height: 13, color: "var(--fg-muted)" }} />
                    ) : null}
                    <span style={{
                      fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", fontWeight: 700,
                      color: isDone ? "var(--brand)" : isUnlocked ? "var(--fg-strong)" : "var(--fg-muted)",
                    }}>
                      Segment {i + 1}
                      {transcript?.speaker && (
                        <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 6, color: "var(--fg-muted)" }}>
                          · {transcript.speaker}
                        </span>
                      )}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {transcript && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-subtle)" }}>
                        {fmtTime(transcript.startTime)}–{fmtTime(transcript.endTime)}
                      </span>
                    )}
                    {isDone && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: "var(--brand)",
                        background: "var(--forest-50)", border: "1px solid var(--forest-200)",
                        padding: "2px 7px", borderRadius: 20,
                      }}>
                        Recorded
                      </span>
                    )}
                    {!isUnlocked && !isDone && (
                      <span style={{ fontSize: 11, color: "var(--fg-subtle)" }}>
                        Locked
                      </span>
                    )}
                  </div>
                </div>

                {/* Segment body */}
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

                  {/* Transcript block — original only (no expected interpretation) */}
                  {transcript?.original && (
                    <div style={{
                      background: "var(--bg-sunken)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 10, padding: "12px 14px",
                    }}>
                      <p style={{
                        fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
                        fontWeight: 700, color: "var(--fg-subtle)", margin: "0 0 5px",
                      }}>
                        {transcript.speaker || "Speaker"}
                      </p>
                      <p style={{
                        fontSize: 15, color: "var(--fg-strong)", margin: 0,
                        lineHeight: 1.6,
                        fontFamily: /[\u0900-\u097F]/.test(transcript.original) ? "var(--font-deva)" : "inherit",
                      }}>
                        {transcript.original}
                      </p>
                    </div>
                  )}

                  {/* Audio player */}
                  {segAudioUrl ? (
                    <div>
                      <p style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
                        fontWeight: 700, color: "var(--fg-muted)", margin: "0 0 7px" }}>Listen</p>
                      <AudioPlayer audioUrl={segAudioUrl} />
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: 0 }}>Audio unavailable.</p>
                  )}

                  {/* Recorder */}
                  <div style={{ pointerEvents: isUnlocked ? "auto" : "none" }}>
                    {!isUnlocked && (
                      <p style={{ fontSize: 12, color: "var(--fg-muted)", margin: "0 0 8px" }}>
                        Complete segment {i} first to unlock this.
                      </p>
                    )}
                    <AudioRecorder
                      key={`recorder-${i}-${isUnlocked}`}
                      onRecordingComplete={(blob, mimeType) => handleSegmentRecorded(i, blob, mimeType)}
                      onReRecordStart={() => handleSegmentReRecord(i)}
                      isDisabled={!isUnlocked || isSubmitting}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Separator className="my-6" />

        {submitError && (
          <p style={{ fontSize: 13, color: "var(--danger)", background: "var(--danger-soft)",
            border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8,
            padding: "10px 14px", marginBottom: 16 }}>
            {submitError}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={() => handleSubmit(segmentStates)}
            disabled={!allRecorded || isSubmitting}
            style={{
              padding: "11px 28px", borderRadius: 10,
              background: allRecorded && !isSubmitting ? "var(--brand)" : "var(--bg-sunken)",
              border: "none",
              color: allRecorded && !isSubmitting ? "#fff" : "var(--fg-muted)",
              fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
              cursor: allRecorded && !isSubmitting ? "pointer" : "not-allowed",
              boxShadow: allRecorded && !isSubmitting ? "var(--shadow-brand)" : "none",
              transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</> : "Submit All Recordings"}
          </button>
          {!allRecorded && (
            <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>
              Complete all {segmentStates.length} segments to submit.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
