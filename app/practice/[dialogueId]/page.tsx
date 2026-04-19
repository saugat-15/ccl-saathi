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
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

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
    <div style={{ display: "flex", alignItems: "center", gap: 12,
      background: "var(--gg-50)", border: "1px solid var(--gg-200)",
      borderRadius: 10, padding: "10px 14px" }}>
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
        style={{ width: 34, height: 34, borderRadius: "50%",
          background: "var(--forest-500)", border: "none",
          cursor: "pointer", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "var(--shadow-brand)" }}
      >
        {isPlaying
          ? <Pause className="h-3 w-3 text-white fill-white" />
          : <Play className="h-3 w-3 text-white fill-white ml-0.5" />
        }
      </button>
      <input
        type="range" min={0} max={100} step={0.1} value={progress}
        onChange={handleSeek}
        className="audio-range flex-1 min-w-0"
      />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12,
        color: "var(--fg-muted)", flexShrink: 0 }}>
        {fmt(currentTime)} / {duration > 0 ? fmt(duration) : "--:--"}
      </span>
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
          const json = JSON.parse(await body.text()) as { segments?: TranscriptSegment[] };
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
        background: "#fff", border: "1px solid var(--gg-200)",
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
          <CheckCircle2 style={{ width: 28, height: 28, color: "var(--forest-500)" }} />
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
            background: "var(--forest-500)", border: "none", color: "#fff",
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
                background: "#fff", border: "1px solid var(--gg-200)",
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
                e.currentTarget.style.borderColor = "var(--gg-200)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "none";
              }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: "var(--forest-50)", border: "1px solid var(--forest-100)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Icon style={{ width: 20, height: 20, color: "var(--forest-500)" }} />
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
          <ChevronLeft className="h-4 w-4" /> Practice Mode
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
            Full Dialogue
          </h1>
          <p style={{ fontSize: 14, color: "var(--fg-muted)", margin: 0 }}>
            Listen to the full dialogue, then record your interpretation.
          </p>
        </div>

        <Separator className="mb-6" />

        {/* Player card */}
        <div style={{
          background: "#fff", border: "1px solid var(--gg-200)",
          borderRadius: 16, overflow: "hidden",
          boxShadow: "var(--shadow-sm)", marginBottom: 16,
        }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--gg-100)" }}>
            <p style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
              fontWeight: 700, color: "var(--fg-muted)", margin: 0 }}>Reference Audio</p>
          </div>
          <div style={{ padding: "16px 20px", background: "var(--gg-50)" }}>
            {fullAudioUrl
              ? <AudioPlayer audioUrl={fullAudioUrl} />
              : <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: 0 }}>Audio unavailable.</p>
            }
          </div>
        </div>

        {/* Recorder card */}
        <div style={{
          background: "#fff", border: "1px solid var(--gg-200)",
          borderRadius: 16, overflow: "hidden",
          boxShadow: "var(--shadow-sm)", marginBottom: 24,
        }}>
          <div style={{ padding: "16px 20px 20px" }}>
            <AudioRecorder
              onRecordingComplete={handleFullRecorded}
              onReRecordStart={handleFullReRecord}
              isDisabled={isSubmitting}
            />
          </div>
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
            background: fullRecording.recorded && !isSubmitting ? "var(--forest-500)" : "var(--gg-200)",
            border: "none",
            color: fullRecording.recorded && !isSubmitting ? "#fff" : "var(--fg-muted)",
            fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
            cursor: fullRecording.recorded && !isSubmitting ? "pointer" : "not-allowed",
            boxShadow: fullRecording.recorded && !isSubmitting ? "var(--shadow-brand)" : "none",
            transition: "all 0.15s",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</> : "Submit Recording"}
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
          <ChevronLeft className="h-4 w-4" /> Practice Mode
        </Button>

        <div className="mb-5">
          <span style={{
            fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
            fontWeight: 700, color: "var(--amber-700)", background: "var(--amber-50)",
            padding: "4px 8px", borderRadius: 4,
          }}>
            {toLabel(category).toUpperCase()}
          </span>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600,
            color: "var(--fg-strong)", margin: "12px 0 4px", lineHeight: 1.2 }}>
            By Segments
          </h1>
          <p style={{ fontSize: 14, color: "var(--fg-muted)", margin: 0 }}>
            Record your interpretation for each segment in order.
          </p>
        </div>

        {/* Segment progress dots */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          {segmentStates.map((seg, i) => (
            <div
              key={i}
              style={{
                height: 6, flex: "1 1 24px", minWidth: 20, maxWidth: 48,
                borderRadius: 3,
                background: seg.recorded
                  ? "var(--forest-500)"
                  : i <= currentIndex
                    ? "var(--forest-200)"
                    : "var(--gg-200)",
                transition: "background 0.2s",
              }}
            />
          ))}
          <span style={{ fontSize: 12, color: "var(--fg-muted)",
            fontFamily: "var(--font-mono)", marginLeft: 8, flexShrink: 0 }}>
            {completedCount}/{segmentStates.length}
          </span>
        </div>

        <Separator className="mb-5" />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {segmentStates.map((seg, i) => {
            const segAudioUrl = segmentAudioUrls[i];
            const isUnlocked = i <= currentIndex;
            const isDone = seg.recorded;

            return (
              <div
                key={i}
                style={{
                  background: "#fff",
                  border: `1px solid ${isDone ? "var(--forest-200)" : "var(--gg-200)"}`,
                  borderRadius: 14, overflow: "hidden",
                  opacity: isUnlocked ? 1 : 0.55,
                  boxShadow: isDone ? "0 0 0 1px var(--forest-100)" : "none",
                  transition: "opacity 0.2s, border-color 0.2s",
                }}
              >
                {/* Segment header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 18px",
                  background: isDone ? "var(--forest-50)" : "var(--gg-50)",
                  borderBottom: `1px solid ${isDone ? "var(--forest-100)" : "var(--gg-200)"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {isDone ? (
                      <CheckCircle2 style={{ width: 14, height: 14, color: "var(--forest-500)" }} />
                    ) : !isUnlocked ? (
                      <Lock style={{ width: 14, height: 14, color: "var(--fg-muted)" }} />
                    ) : null}
                    <span style={{
                      fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
                      fontWeight: 700,
                      color: isDone ? "var(--forest-600)" : isUnlocked ? "var(--fg-strong)" : "var(--fg-muted)",
                    }}>
                      Segment {i + 1}
                    </span>
                  </div>
                  {isDone && (
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: "var(--forest-600)",
                      background: "var(--forest-50)", border: "1px solid var(--forest-200)",
                      padding: "2px 8px", borderRadius: 20,
                    }}>
                      Recorded
                    </span>
                  )}
                  {!isUnlocked && !isDone && (
                    <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                      Complete segment {i} first
                    </span>
                  )}
                </div>

                {/* Segment body */}
                <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
                  {segAudioUrl ? (
                    <div>
                      <p style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                        fontWeight: 700, color: "var(--fg-muted)", margin: "0 0 8px" }}>Listen</p>
                      <AudioPlayer audioUrl={segAudioUrl} />
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: 0 }}>Audio unavailable.</p>
                  )}

                  <div style={{ pointerEvents: isUnlocked ? "auto" : "none" }}>
                    {!isUnlocked && (
                      <p style={{ fontSize: 12, color: "var(--fg-muted)", margin: "0 0 8px" }}>
                        Locked until previous segment is recorded.
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
              background: allRecorded && !isSubmitting ? "var(--forest-500)" : "var(--gg-200)",
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
