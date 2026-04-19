"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { generateClient } from "aws-amplify/data";
import { uploadData, downloadData, getUrl, list } from "aws-amplify/storage";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import type { Schema } from "@/amplify/data/resource";
import AudioRecorder from "@/app/components/AudioRecorder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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
    <div className="flex items-center gap-3 bg-secondary/60 border border-border rounded-lg px-3 py-2.5">
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
        className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 hover:bg-primary/90 transition-colors"
      >
        {isPlaying
          ? <Pause className="h-3.5 w-3.5 text-white fill-white" />
          : <Play className="h-3.5 w-3.5 text-white fill-white ml-0.5" />
        }
      </button>
      <input
        type="range" min={0} max={100} step={0.1} value={progress}
        onChange={handleSeek}
        className="audio-range flex-1 min-w-0"
      />
      <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
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
      <Card className="w-full max-w-sm text-center p-8">
        <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
        <h2 className="text-lg font-bold text-foreground mb-1">Submitted!</h2>
        <p className="text-sm text-muted-foreground mb-6">We&apos;ll process your recordings shortly.</p>
        <Button onClick={() => router.push(`/category/${category}`)} className="w-full">
          Back to {toLabel(category)}
        </Button>
      </Card>
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
          <h1 className="text-xl font-bold tracking-tight text-foreground">Choose Practice Mode</h1>
          <p className="text-sm text-muted-foreground mt-1">How would you like to practise this dialogue?</p>
        </div>

        <Separator className="mb-5" />

        <div className="space-y-3">
          <Card
            onClick={() => setMode("full")}
            className="cursor-pointer hover:border-primary/40 hover:bg-accent/40 transition-colors"
          >
            <CardContent className="flex items-start gap-4 pt-5">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Headphones className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground mb-0.5">Full Dialogue</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Listen to the complete dialogue and record your interpretation in one go.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            onClick={() => setMode("segments")}
            className="cursor-pointer hover:border-primary/40 hover:bg-accent/40 transition-colors"
          >
            <CardContent className="flex items-start gap-4 pt-5">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <LayoutList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground mb-0.5">By Segments</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Work through each segment one at a time, listening and recording in order.
                </p>
              </div>
            </CardContent>
          </Card>
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
          <h1 className="text-xl font-bold tracking-tight text-foreground">Full Dialogue</h1>
          <p className="text-sm text-muted-foreground mt-1">Listen to the full dialogue, then record your interpretation.</p>
        </div>

        <Separator className="mb-5" />

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Reference Audio</p>
            </CardHeader>
            <CardContent className="pt-0">
              {fullAudioUrl
                ? <AudioPlayer audioUrl={fullAudioUrl} />
                : <p className="text-sm text-muted-foreground">Audio unavailable.</p>
              }
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <AudioRecorder
                onRecordingComplete={handleFullRecorded}
                onReRecordStart={handleFullReRecord}
                isDisabled={isSubmitting}
              />
            </CardContent>
          </Card>
        </div>

        <Separator className="my-5" />

        {submitError && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-4">
            {submitError}
          </p>
        )}
        <Button
          onClick={() => handleSubmit([fullRecording])}
          disabled={!fullRecording.recorded || isSubmitting}
          className="w-full sm:w-auto"
        >
          {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting…</> : "Submit Recording"}
        </Button>
      </div>
    </div>
  );

  // ── Segments mode ─────────────────────────────────────────────────────────
  const allRecorded = segmentStates.length > 0 && segmentStates.every((s) => s.recorded);
  const completedCount = segmentStates.filter((s) => s.recorded).length;
  const pct = segmentStates.length > 0 ? (completedCount / segmentStates.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <Button variant="ghost" size="sm" onClick={() => setMode(null)} className="gap-1.5 -ml-2 mb-6 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Practice Mode
        </Button>

        <div className="mb-5">
          <h1 className="text-xl font-bold tracking-tight text-foreground">By Segments</h1>
          <p className="text-sm text-muted-foreground mt-1">Record your interpretation for each segment in order.</p>
        </div>

        {/* Progress */}
        <div className="mb-6 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{completedCount} of {segmentStates.length} recorded</span>
            <span>{Math.round(pct)}%</span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <Separator className="mb-5" />

        <div className="space-y-3">
          {segmentStates.map((seg, i) => {
            const segAudioUrl = segmentAudioUrls[i];
            const isUnlocked = i <= currentIndex;
            const isDone = seg.recorded;

            return (
              <Card
                key={i}
                className={`overflow-hidden transition-opacity ${isUnlocked ? "" : "opacity-50"} ${isDone ? "border-primary/30" : ""}`}
              >
                {/* Segment header */}
                <div className={`flex items-center justify-between px-5 py-2.5 border-b ${isDone ? "bg-primary/5 border-primary/20" : "bg-muted/40"}`}>
                  <div className="flex items-center gap-2">
                    {isDone
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      : !isUnlocked
                        ? <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        : null
                    }
                    <span className={`text-xs font-semibold uppercase tracking-wider ${isDone ? "text-primary" : isUnlocked ? "text-foreground" : "text-muted-foreground"}`}>
                      Segment {i + 1}
                    </span>
                  </div>
                  {isDone && <Badge variant="success" className="text-xs">Recorded</Badge>}
                  {!isUnlocked && !isDone && (
                    <span className="text-xs text-muted-foreground">Complete segment {i} first</span>
                  )}
                </div>

                {/* Segment body */}
                <CardContent className="pt-4 space-y-4">
                  {segAudioUrl ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Listen</p>
                      <AudioPlayer audioUrl={segAudioUrl} />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Audio unavailable.</p>
                  )}

                  <div style={{ pointerEvents: isUnlocked ? "auto" : "none" }}>
                    {!isUnlocked && (
                      <p className="text-xs text-muted-foreground mb-2">Locked until previous segment is recorded.</p>
                    )}
                    <AudioRecorder
                      key={`recorder-${i}-${isUnlocked}`}
                      onRecordingComplete={(blob, mimeType) => handleSegmentRecorded(i, blob, mimeType)}
                      onReRecordStart={() => handleSegmentReRecord(i)}
                      isDisabled={!isUnlocked || isSubmitting}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Separator className="my-6" />

        {submitError && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-4">
            {submitError}
          </p>
        )}
        <Button
          onClick={() => handleSubmit(segmentStates)}
          disabled={!allRecorded || isSubmitting}
          className="w-full sm:w-auto"
        >
          {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting…</> : "Submit All Recordings"}
        </Button>
        {!allRecorded && (
          <p className="text-xs text-muted-foreground mt-2">Complete all segments to submit.</p>
        )}
      </div>
    </div>
  );
}
