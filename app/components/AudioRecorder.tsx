"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, Pause, RotateCcw } from "lucide-react";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, mimeType: string) => void;
  onReRecordStart?: () => void;
  isDisabled?: boolean;
  maxDurationSeconds?: number;
}

type RecorderState = "idle" | "recording" | "recorded";

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function AudioRecorder({
  onRecordingComplete,
  onReRecordStart,
  isDisabled,
  maxDurationSeconds = 300,
}: AudioRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartRef = useRef<number>(0);

  const playbackRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playTime, setPlayTime] = useState(0);
  const [playDuration, setPlayDuration] = useState(0);

  const clearTick = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      clearTick();
    };
  }, [audioUrl, clearTick]);

  if (typeof window !== "undefined" && typeof MediaRecorder === "undefined") {
    return (
      <p className="text-sm text-destructive">
        Your browser does not support audio recording. Please use Chrome or Firefox.
      </p>
    );
  }

  const mimeType =
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "audio/mp4";

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recordStartRef.current = Date.now();
      setElapsedSec(0);

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        clearTick();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState("recorded");
        onRecordingComplete(blob, mimeType);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setElapsedSec(0);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setState("recording");

      tickRef.current = setInterval(() => {
        const elapsed = (Date.now() - recordStartRef.current) / 1000;
        setElapsedSec(elapsed);
        if (elapsed >= maxDurationSeconds && mediaRecorderRef.current) stopRecording();
      }, 200);
    } catch {
      setError("Microphone access denied. Please allow microphone access and try again.");
    }
  }

  function stopRecording() {
    clearTick();
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
  }

  function reRecord() {
    onReRecordStart?.();
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    setState("idle");
    setPlayTime(0);
    setPlayDuration(0);
    setIsPlaying(false);
  }

  function togglePlayback() {
    const el = playbackRef.current;
    if (!el) return;
    if (el.paused) { void el.play(); setIsPlaying(true); }
    else { el.pause(); setIsPlaying(false); }
  }

  function handlePlaybackSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const el = playbackRef.current;
    if (!el || playDuration <= 0) return;
    const t = (parseFloat(e.target.value) / 100) * playDuration;
    el.currentTime = t;
    setPlayTime(t);
  }

  const progressPct = Math.min(100, (elapsedSec / maxDurationSeconds) * 100);
  const seekPct = playDuration > 0 ? (playTime / playDuration) * 100 : 0;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Your interpretation
      </p>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {state === "idle" && (
        <Button
          onClick={startRecording}
          disabled={isDisabled}
          variant="outline"
          className="gap-2 border-dashed hover:border-primary/50 hover:bg-primary/5"
        >
          <Mic className="h-4 w-4 text-primary" />
          Start recording
        </Button>
      )}

      {state === "recording" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button
              onClick={stopRecording}
              variant="destructive"
              size="sm"
              className="gap-2"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              Stop
            </Button>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-semibold tabular-nums text-destructive">
                {fmt(elapsedSec)}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-destructive rounded-full transition-all duration-150"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {Math.round(progressPct)}% of {maxDurationSeconds}s
            </p>
          </div>
        </div>
      )}

      {state === "recorded" && audioUrl && (
        <div className="space-y-3">
          <audio
            ref={playbackRef}
            src={audioUrl}
            onTimeUpdate={() => setPlayTime(playbackRef.current?.currentTime ?? 0)}
            onLoadedMetadata={() => setPlayDuration(playbackRef.current?.duration ?? 0)}
            onEnded={() => { setIsPlaying(false); setPlayTime(0); }}
            onPause={() => setIsPlaying(false)}
          />

          <div className="flex items-center gap-3 bg-secondary/60 border border-border rounded-lg px-3 py-2.5">
            <button
              type="button"
              onClick={togglePlayback}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 hover:bg-primary/90 transition-colors"
            >
              {isPlaying
                ? <Pause className="h-3.5 w-3.5 text-white fill-white" />
                : <Play className="h-3.5 w-3.5 text-white fill-white ml-0.5" />
              }
            </button>
            <input
              type="range" min={0} max={100} step={0.1} value={seekPct}
              onChange={handlePlaybackSeek}
              disabled={playDuration <= 0}
              className="audio-range flex-1 min-w-0"
            />
            <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
              {playDuration > 0 ? fmt(playTime) : "0:00"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="ghost" size="sm"
              onClick={reRecord}
              disabled={isDisabled}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Re-record
            </Button>
            <span className="text-xs font-semibold text-primary">✓ Recording saved</span>
          </div>
        </div>
      )}
    </div>
  );
}
