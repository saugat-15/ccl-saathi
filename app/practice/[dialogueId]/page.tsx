"use client";

import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
Amplify.configure(outputs, { ssr: true });

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { generateClient } from "aws-amplify/data";
import { uploadData, downloadData, getUrl, list } from "aws-amplify/storage";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import type { Schema } from "@/amplify/data/resource";
import AudioRecorder from "@/app/components/AudioRecorder";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, Play, Pause, Loader2, CheckCircle2, Lock, Zap, X } from "lucide-react";

const client = generateClient<Schema>();

async function resolveUserRecord(userId: string) {
  // Use list instead of get: with allow.owner(), get returns Unauthorized when
  // the record doesn't exist (AppSync can't verify ownership on a null item).
  // list returns an empty array instead, which we can handle cleanly.
  const { data, errors } = await client.models.User.list({
    filter: { id: { eq: userId } },
  });

  if (errors?.length) {
    throw new Error(errors[0].message ?? "Failed to load your account. Please try again.");
  }

  const record = data?.[0];
  if (!record) {
    throw new Error("Account not found. Please sign out and sign in again.");
  }

  return record;
}

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

async function combineSegmentsToWav(blobs: Blob[]): Promise<Blob> {
  const audioCtx = new AudioContext();
  try {
    const buffers = await Promise.all(
      blobs.map(async (blob) => {
        const arrayBuffer = await blob.arrayBuffer();
        return audioCtx.decodeAudioData(arrayBuffer);
      }),
    );
    const sampleRate = buffers[0].sampleRate;
    const totalFrames = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const combined = audioCtx.createBuffer(1, totalFrames, sampleRate);
    let offset = 0;
    for (const buf of buffers) {
      const srcData =
        buf.numberOfChannels > 1 ? downmixToMono(buf) : buf.getChannelData(0);
      combined.copyToChannel(srcData as Float32Array<ArrayBuffer>, 0, offset);
      offset += buf.length;
    }
    return encodeWav(combined);
  } finally {
    await audioCtx.close();
  }
}

function downmixToMono(buf: AudioBuffer): Float32Array {
  const mono = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < ch.length; i++) mono[i] += ch[i];
  }
  for (let i = 0; i < mono.length; i++) mono[i] /= buf.numberOfChannels;
  return mono;
}

function encodeWav(buffer: AudioBuffer): Blob {
  const sampleRate = buffer.sampleRate;
  const samples = buffer.getChannelData(0);
  const dataLength = samples.length * 2;
  const ab = new ArrayBuffer(44 + dataLength);
  const view = new DataView(ab);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);  // PCM
  view.setUint16(22, 1, true);  // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataLength, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    off += 2;
  }
  return new Blob([ab], { type: "audio/wav" });
}

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function toLabel(s: string) {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Audio player ─────────────────────────────────────────────────────────────
function AudioPlayer({ audioUrl, isUnlocked }: { audioUrl: string, isUnlocked: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  function handlePlay() {
    const el = audioRef.current;
    if (!el || !isAudioReady) return;
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
        onLoadedMetadata={() => {
          setDuration(audioRef.current?.duration ?? 0);
          setIsAudioReady(true);
        }}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
        onPause={() => setIsPlaying(false)}
        onError={() => {
          setIsAudioReady(false);
          setIsPlaying(false);
        }}
      />
      <button
        type="button"
        disabled={!isAudioReady || !isUnlocked}
        onClick={isPlaying ? handlePause : handlePlay}
        style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "var(--brand)", border: "none",
          cursor: isAudioReady ? "pointer" : "not-allowed", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "var(--shadow-brand)",
          opacity: isAudioReady ? 1 : 0.5,
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
          disabled={!isAudioReady}
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

  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [segmentAudioUrls, setSegmentAudioUrls] = useState<(string | null)[]>([]);
  const [scenario, setScenario] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [segmentStates, setSegmentStates] = useState<SegmentState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitDone, setSubmitDone] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const { userId } = await getCurrentUser();

        // ── Subscription / free-attempt gate ────────────────────────────────
        const userRecord = await resolveUserRecord(userId);
        const hasValidSubscription =
          userRecord.hasSubscription === true &&
          (userRecord.subscriptionExpiresAt == null ||
            new Date(userRecord.subscriptionExpiresAt) > new Date());

        if (!hasValidSubscription && (userRecord.freeAttempts ?? 0) >= 2) {
          setShowUpgradeModal(true);
          return;
        }
        // ────────────────────────────────────────────────────────────────────

        const folder = basePath.split("/").slice(0, -1).join("/") + "/";
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
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load dialogue.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
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

  async function handleSubmit(recordings: SegmentState[]) {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // if (!allRecorded) throw new Error("Please record all segments before submitting.");
      const { userId } = await getCurrentUser();

      // ── Subscription / free-attempt gate ────────────────────────────────
      const userRecord = await resolveUserRecord(userId);
      const hasValidSubscription =
        userRecord.hasSubscription === true &&
        (userRecord.subscriptionExpiresAt == null ||
          new Date(userRecord.subscriptionExpiresAt) > new Date());

      if (!hasValidSubscription) {
        if ((userRecord.freeAttempts ?? 0) >= 2) {
          setShowUpgradeModal(true);
          return;
        }
      }
      // ────────────────────────────────────────────────────────────────────

      const { identityId } = await fetchAuthSession();
      if (!identityId) throw new Error("Could not determine identity. Please sign out and sign in again.");

      const recordedBlobs = recordings
        .filter((s): s is SegmentState & { blob: Blob; mimeType: string } =>
          s.blob !== null && s.mimeType !== null,
        )
        .map((s) => s.blob);

      if (recordedBlobs.length === 0) throw new Error("No recordings to submit.");

      // Combine all segment audio into a single WAV file (1 attempt = 1 recording)
      const combinedWav = await combineSegmentsToWav(recordedBlobs);

      const { data: recording, errors } = await client.models.Recording.create({
        userId, dialogueId: basePath, s3Key: "pending", status: "UPLOADED", attemptNumber: 1,
      });
      if (errors || !recording) throw new Error("Failed to create attempt record.");

      const s3Key = `protected/${identityId}/recordings/${recording.id}.wav`;
      await uploadData({ path: s3Key, data: combinedWav, options: { contentType: "audio/wav" } }).result;
      await client.models.Recording.update({ id: recording.id, s3Key });

      // Increment free attempt count if not subscribed
      if (!hasValidSubscription && userRecord) {
        await client.models.User.update({
          id: userId,
          freeAttempts: (userRecord.freeAttempts ?? 0) + 1,
        });
      }

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
        <h2 style={{
          fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600,
          color: "var(--fg-strong)", margin: "0 0 8px"
        }}>Submitted!</h2>
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

  // ── Loading / error ───────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/category/${category}`)} className="gap-1.5 -ml-2 mb-6 text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> {toLabel(category)}
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
        <Button variant="ghost" size="sm" onClick={() => router.push(`/category/${category}`)} className="gap-1.5 -ml-2 mb-6 text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> {toLabel(category)}
        </Button>
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          {loadError}
        </p>
      </div>
    </div>
  );

  // ── Segments only ─────────────────────────────────────────────────────────
  const allRecorded = segmentStates.length > 0 && segmentStates.every((s) => s.recorded);
  const completedCount = segmentStates.filter((s) => s.recorded).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/category/${category}`)} className="gap-1.5 -ml-2 mb-6 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> {toLabel(category)}
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
          <h1 style={{
            fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600,
            color: "var(--fg-strong)", margin: "10px 0 4px", lineHeight: 1.2
          }}>
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
                      <p style={{
                        fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
                        fontWeight: 700, color: "var(--fg-muted)", margin: "0 0 7px"
                      }}>Listen</p>
                      <AudioPlayer audioUrl={segAudioUrl} isUnlocked={isUnlocked} />
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
          <p style={{
            fontSize: 13, color: "var(--danger)", background: "var(--danger-soft)",
            border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8,
            padding: "10px 14px", marginBottom: 16
          }}>
            {submitError}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={() => handleSubmit(segmentStates)}
            disabled={isSubmitting}
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

      {/* ── Upgrade modal ───────────────────────────────────────────────── */}
      {showUpgradeModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
          onClick={() => setShowUpgradeModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-surface)", borderRadius: 20,
              padding: "36px 32px", width: "100%", maxWidth: 400,
              boxShadow: "var(--shadow-md)", position: "relative",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <button
              onClick={() => setShowUpgradeModal(false)}
              style={{
                position: "absolute", top: 16, right: 16,
                background: "none", border: "none", cursor: "pointer",
                color: "var(--fg-muted)", padding: 4, borderRadius: 6,
              }}
            >
              <X style={{ width: 18, height: 18 }} />
            </button>

            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: "var(--amber-50)", border: "1.5px solid var(--amber-200)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 20,
            }}>
              <Zap style={{ width: 24, height: 24, color: "var(--amber-500)" }} />
            </div>

            <h2 style={{
              fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600,
              color: "var(--fg-strong)", margin: "0 0 10px",
            }}>
              Free attempt limit reached
            </h2>
            <p style={{ fontSize: 14, color: "var(--fg-muted)", margin: "0 0 24px", lineHeight: 1.6 }}>
              You&apos;ve used your 2 free practice attempts. Upgrade to Pro to keep practising with unlimited submissions.
            </p>

            <button
              onClick={() => router.push("/pricing")}
              style={{
                width: "100%", padding: "12px 20px", borderRadius: 10,
                background: "var(--brand)", border: "none", color: "#fff",
                fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
                cursor: "pointer", boxShadow: "var(--shadow-brand)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                marginBottom: 10,
              }}
            >
              <Zap style={{ width: 15, height: 15 }} />
              Upgrade to Pro
            </button>
            <button
              onClick={() => setShowUpgradeModal(false)}
              style={{
                width: "100%", padding: "11px 20px", borderRadius: 10,
                background: "none", border: "1px solid var(--border-subtle)", color: "var(--fg-muted)",
                fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
