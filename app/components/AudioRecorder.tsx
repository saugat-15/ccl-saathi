"use client";

import { useState, useRef, useEffect } from "react";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, mimeType: string) => void;
  isDisabled?: boolean;
}

type RecorderState = "idle" | "recording" | "recorded";

export default function AudioRecorder({ onRecordingComplete, isDisabled }: AudioRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (typeof window !== "undefined" && typeof MediaRecorder === "undefined") {
    return <p style={{ color: "#ef4444", fontSize: "0.85rem" }}>Your browser does not support audio recording. Please use Chrome or Firefox.</p>;
  }

  const mimeType = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")
    ? "audio/webm"
    : "audio/mp4";

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState("recorded");
        onRecordingComplete(blob, mimeType);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setState("recording");
    } catch {
      setError("Microphone access denied. Please allow microphone access and try again.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }

  function reRecord() {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    setState("idle");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {error && <p style={{ color: "#ef4444", fontSize: "0.8rem", margin: 0 }}>{error}</p>}

      {state === "idle" && (
        <button
          onClick={startRecording}
          disabled={isDisabled}
          style={btnStyle("#2563eb", isDisabled)}
        >
          Record
        </button>
      )}

      {state === "recording" && (
        <button
          onClick={stopRecording}
          disabled={isDisabled}
          style={btnStyle("#dc2626", false)}
        >
          Stop Recording
        </button>
      )}

      {state === "recorded" && audioUrl && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <audio controls src={audioUrl} style={{ width: "100%", height: 36 }} />
          <button
            onClick={reRecord}
            disabled={isDisabled}
            style={btnStyle("#6b7280", isDisabled)}
          >
            Re-record
          </button>
        </div>
      )}
    </div>
  );
}

function btnStyle(bg: string, disabled?: boolean): React.CSSProperties {
  return {
    padding: "0.4rem 0.9rem",
    borderRadius: 6,
    border: "none",
    background: disabled ? "#d1d5db" : bg,
    color: "white",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: "0.85rem",
    fontWeight: 500,
    alignSelf: "flex-start",
  };
}
