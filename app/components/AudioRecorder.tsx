"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, mimeType: string) => void;
  onReRecordStart?: () => void;
  isDisabled?: boolean;
  maxDurationSeconds?: number;
}

type RecorderState = "idle" | "recording" | "recorded";

function fmt(secs: number) {
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(Math.floor(secs % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

const BARS = 28;

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
      <p style={{ color: "var(--danger)", fontSize: 13 }}>
        Your browser does not support audio recording. Please use Chrome or Firefox.
      </p>
    );
  }

  const mimeType =
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm" : "audio/mp4";

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
    setPlayTime(0); setPlayDuration(0); setIsPlaying(false);
  }

  function togglePlayback() {
    const el = playbackRef.current;
    if (!el) return;
    if (el.paused) { void el.play(); setIsPlaying(true); }
    else { el.pause(); setIsPlaying(false); }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const el = playbackRef.current;
    if (!el || playDuration <= 0) return;
    const t = (parseFloat(e.target.value) / 100) * playDuration;
    el.currentTime = t;
    setPlayTime(t);
  }

  const seekPct = playDuration > 0 ? (playTime / playDuration) * 100 : 0;

  /* ── Waveform bars ── */
  function barHeight(i: number) {
    if (state === "idle") return 10;
    if (state === "recorded") return 20 + ((i * 13) % 60);
    return 20 + ((i * 17 + Math.floor(elapsedSec) * 7) % 70);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Label */}
      <p style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
        fontWeight: 600, color: "var(--fg-muted)", margin: 0 }}>
        Your interpretation
      </p>

      {error && (
        <p style={{ fontSize: 13, color: "var(--danger)",
          background: "var(--danger-soft)", borderRadius: 8, padding: "8px 12px", margin: 0 }}>
          {error}
        </p>
      )}

      {/* Recorder row — idle or recording */}
      {(state === "idle" || state === "recording") && (
        <div style={{ background: "var(--gg-50)", border: "1px solid var(--gg-200)",
          borderRadius: 16, padding: "18px 22px",
          display: "flex", alignItems: "center", gap: 20,
          opacity: isDisabled ? 0.5 : 1 }}>

          {/* Big round record / stop button */}
          <button
            type="button"
            onClick={state === "idle" ? startRecording : stopRecording}
            disabled={isDisabled}
            aria-label={state === "recording" ? "Stop recording" : "Start recording"}
            style={{
              position: "relative",
              width: 64, height: 64, borderRadius: "50%",
              background: state === "recording" ? "var(--rec-press)" : "var(--rec)",
              border: "none", cursor: isDisabled ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              boxShadow: "var(--shadow-rec)",
              transition: "background 0.15s",
            }}
          >
            {/* Pulse ring while recording */}
            {state === "recording" && (
              <span style={{
                position: "absolute", inset: -6, borderRadius: "50%",
                border: "2px solid var(--rec)", opacity: 0.4,
                animation: "pulse-rec 1.4s infinite",
              }} />
            )}
            {/* Icon */}
            {state === "recording" ? (
              /* Stop square */
              <span style={{ width: 18, height: 18, borderRadius: 4, background: "#fff" }} />
            ) : (
              /* Mic shape */
              <svg width="22" height="28" viewBox="0 0 22 28" fill="none">
                <rect x="5" y="0" width="12" height="18" rx="6" fill="#fff"/>
                <path d="M1 13c0 5.523 4.477 10 10 10s10-4.477 10-10" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none"/>
                <line x1="11" y1="23" x2="11" y2="28" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
          </button>

          {/* Waveform */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 3, height: 44 }}>
            {Array.from({ length: BARS }).map((_, i) => (
              <span key={i} style={{
                display: "block",
                width: 3, borderRadius: 2,
                height: `${barHeight(i)}%`,
                background: state === "idle" ? "var(--gg-300)" : "var(--forest-500)",
                opacity: state === "idle" ? 0.5 : 1,
                transition: "height 0.2s ease-out",
              }} />
            ))}
          </div>

          {/* Timer */}
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 500,
            color: state === "recording" ? "var(--rec)" : "var(--fg-muted)",
            minWidth: 52, textAlign: "right" }}>
            {fmt(elapsedSec)}
          </div>
        </div>
      )}

      {/* Playback row — after recording */}
      {state === "recorded" && audioUrl && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <audio
            ref={playbackRef}
            src={audioUrl}
            onTimeUpdate={() => setPlayTime(playbackRef.current?.currentTime ?? 0)}
            onLoadedMetadata={() => setPlayDuration(playbackRef.current?.duration ?? 0)}
            onEnded={() => { setIsPlaying(false); setPlayTime(0); }}
            onPause={() => setIsPlaying(false)}
          />

          <div style={{ background: "var(--gg-50)", border: "1px solid var(--gg-200)",
            borderRadius: 12, padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 12 }}>
            {/* Play/pause */}
            <button
              type="button"
              onClick={togglePlayback}
              style={{
                width: 40, height: 40, borderRadius: "50%",
                background: "var(--forest-500)", border: "none",
                cursor: "pointer", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "var(--shadow-brand)",
              }}
            >
              {isPlaying ? (
                <span style={{ display: "flex", gap: 3 }}>
                  <span style={{ width: 3, height: 12, background: "#fff", borderRadius: 1 }} />
                  <span style={{ width: 3, height: 12, background: "#fff", borderRadius: 1 }} />
                </span>
              ) : (
                <span style={{ width: 0, height: 0, borderStyle: "solid",
                  borderWidth: "7px 0 7px 11px",
                  borderColor: "transparent transparent transparent #fff",
                  marginLeft: 2 }} />
              )}
            </button>

            <input
              type="range" min={0} max={100} step={0.1}
              value={seekPct} onChange={handleSeek}
              disabled={playDuration <= 0}
              className="audio-range"
              style={{ flex: 1, minWidth: 0 }}
            />

            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13,
              color: "var(--fg-muted)", flexShrink: 0 }}>
              {playDuration > 0 ? fmt(playTime) : "0:00"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button
              type="button"
              onClick={reRecord}
              disabled={isDisabled}
              style={{ background: "transparent", border: "1px solid var(--gg-300)",
                padding: "7px 14px", borderRadius: 8,
                fontSize: 13, fontWeight: 500, color: "var(--fg-strong)",
                cursor: isDisabled ? "not-allowed" : "pointer", fontFamily: "var(--font-sans)" }}
            >
              Re-record
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--forest-600)" }}>
              ✓ Recording saved
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
