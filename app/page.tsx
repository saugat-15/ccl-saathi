"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import "./../app/app.css";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import { Authenticator } from "@aws-amplify/ui-react";
import { downloadData, getUrl, list, uploadData } from "aws-amplify/storage";
import { fetchAuthSession, fetchUserAttributes } from "aws-amplify/auth";
import "@aws-amplify/ui-react/styles.css";

Amplify.configure(outputs);

const client = generateClient<Schema>();

type Recording = Schema["Recording"]["type"];
type Feedback = Schema["Feedback"]["type"];
type DialogueSummary = {
  id: string;
  title: string;
  description: string | null;
  category: Schema["Dialogue"]["type"]["category"] | undefined;
  difficulty: Schema["Dialogue"]["type"]["difficulty"] | undefined;
  audioS3Key: string;
  transcriptS3Key: string;
  segmentCount: number | null;
  sortOrder: number | null;
  createdAt: string;
};

type ReferenceSegment = {
  segmentIndex: number;
  speaker: "EN" | "NE" | string;
  original: string;
  translation: string | null;
  expectedInterpretation: string;
  audioKey: string;
};

type DialogueReference = {
  dialogueId: string;
  domain: string;
  scenario: string;
  totalSegments: number;
  segments: ReferenceSegment[];
};

type HistoryRow = {
  recordingId: string;
  dialogueTitle: string;
  status: Recording["status"];
  overallScore: number | null;
  attemptNumber: number | null;
  createdAt: string | null;
};

type SegmentRecording = {
  segmentIndex: number;
  blob: Blob;
  previewUrl: string;
};

const formatDate = (value: string | null): string => {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "N/A";
  }

  return date.toLocaleString();
};

const normalizeStoragePath = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith("s3://")) {
    const withoutScheme = trimmed.slice(5);
    const firstSlash = withoutScheme.indexOf("/");
    if (firstSlash >= 0) {
      return withoutScheme.slice(firstSlash + 1);
    }
  }
  if (trimmed.startsWith("/")) {
    return trimmed.slice(1);
  }
  return trimmed;
};

export default function Page() {
  const [dialogues, setDialogues] = useState<DialogueSummary[]>([]);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [dialogueStorageKeys, setDialogueStorageKeys] = useState<string[]>([]);
  const [recordingStorageKeys, setRecordingStorageKeys] = useState<string[]>([]);
  const [activeDialogue, setActiveDialogue] = useState<DialogueSummary | null>(null);
  const [reference, setReference] = useState<DialogueReference | null>(null);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(0);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [segmentAudioUrl, setSegmentAudioUrl] = useState<string>("");
  const [isLoadingReference, setIsLoadingReference] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [identityId, setIdentityId] = useState<string>("");
  const [userSub, setUserSub] = useState<string>("");
  const [segmentRecordings, setSegmentRecordings] = useState<
    Record<number, SegmentRecording>
  >({});
  const [selectedDialogueId, setSelectedDialogueId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const segmentRecordingsRef = useRef<Record<number, SegmentRecording>>({});
  const authRetryRef = useRef<number>(0);

  const activeSegment = useMemo(() => {
    if (!reference) {
      return null;
    }

    return reference.segments[activeSegmentIndex] ?? null;
  }, [reference, activeSegmentIndex]);

  const clearSegmentRecordings = (): void => {
    setSegmentRecordings((previous) => {
      for (const value of Object.values(previous)) {
        URL.revokeObjectURL(value.previewUrl);
      }
      return {};
    });
  };

  useEffect(() => {
    segmentRecordingsRef.current = segmentRecordings;
  }, [segmentRecordings]);

  const hydrate = async (): Promise<void> => {
    setMessage("");
    try {
      const [dialogueResult, recordingResult, feedbackResult, session, attributes] =
        await Promise.all([
          client.models.Dialogue.list({
            filter: {
              isActive: {
                eq: true,
              },
            },
            selectionSet: [
              "id",
              "title",
              "description",
              "category",
              "difficulty",
              "audioS3Key",
              "transcriptS3Key",
              "segmentCount",
              "sortOrder",
              "createdAt",
            ],
          }),
          client.models.Recording.list({
            selectionSet: [
              "id",
              "dialogueId",
              "status",
              "attemptNumber",
              "createdAt",
              "s3Key",
              "userId",
            ],
          }),
          client.models.Feedback.list({
            selectionSet: ["recordingId", "dialogueId", "overallScore", "userId"],
          }),
          fetchAuthSession(),
          fetchUserAttributes(),
        ]);

      authRetryRef.current = 0;

      const cognitoSub = attributes.sub ?? "";
      setUserSub(cognitoSub);
      setIdentityId(session.identityId ?? "");

      const sortedDialogues: DialogueSummary[] = dialogueResult.data
        .map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description ?? null,
          category: item.category,
          difficulty: item.difficulty,
          audioS3Key: item.audioS3Key,
          transcriptS3Key: item.transcriptS3Key,
          segmentCount: item.segmentCount ?? null,
          sortOrder: item.sortOrder ?? null,
          createdAt: item.createdAt,
        }))
        .sort((a, b) => {
          const left = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
          const right = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
          return left - right;
        });

      setDialogues(sortedDialogues);

      const relevantRecordings = recordingResult.data.filter(
        (item) => item.userId === cognitoSub,
      );
      const feedbackMap = new Map(
        feedbackResult.data
          .filter((item) => item.userId === cognitoSub)
          .map((item) => [item.recordingId, item]),
      );

      const dialogueMap = new Map(sortedDialogues.map((item) => [item.id, item.title]));
      const rows: HistoryRow[] = relevantRecordings
        .map((item) => {
          const feedback = feedbackMap.get(item.id);
          return {
            recordingId: item.id,
            dialogueTitle: dialogueMap.get(item.dialogueId) ?? "Unknown dialogue",
            status: item.status ?? "UPLOADED",
            overallScore: feedback?.overallScore ?? null,
            attemptNumber: item.attemptNumber ?? null,
            createdAt: item.createdAt ?? null,
          };
        })
        .sort((a, b) => {
          const left = a.createdAt ? new Date(a.createdAt).valueOf() : 0;
          const right = b.createdAt ? new Date(b.createdAt).valueOf() : 0;
          return right - left;
        });

      setHistoryRows(rows);

      const [dialogueListResult, recordingListResult] = await Promise.all([
        list({
          path: "dialogues/",
          options: {
            listAll: true,
          },
        }),
        session.identityId
          ? list({
              path: `recordings/${session.identityId}/`,
              options: {
                listAll: true,
              },
            })
          : Promise.resolve({ items: [] }),
      ]);

      setDialogueStorageKeys(
        dialogueListResult.items
          .map((item) => item.path)
          .filter((path): path is string => typeof path === "string"),
      );
      setRecordingStorageKeys(
        recordingListResult.items
          .map((item) => item.path)
          .filter((path): path is string => typeof path === "string"),
      );
    } catch (error) {
      const description =
        error instanceof Error ? error.message : "Unable to load data";
      if (
        description.includes("User needs to be authenticated") &&
        authRetryRef.current < 5
      ) {
        authRetryRef.current += 1;
        window.setTimeout(() => {
          void hydrate();
        }, 800);
        return;
      }
      setMessage(description);
    }
  };

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      for (const value of Object.values(segmentRecordingsRef.current)) {
        URL.revokeObjectURL(value.previewUrl);
      }
    };
  }, []);

  const loadDialogue = async (dialogue: DialogueSummary): Promise<void> => {
    setSelectedDialogueId(dialogue.id);
    setActiveDialogue(dialogue);
    setReference(null);
    setActiveSegmentIndex(0);
    setRecordingBlob(null);
    clearSegmentRecordings();
    setSegmentAudioUrl("");
    setIsLoadingReference(true);
    setMessage("");

    try {
      const transcriptPath = normalizeStoragePath(dialogue.transcriptS3Key);
      const transcriptBlob = (
        await downloadData({
          path: transcriptPath,
        }).result
      ).body;
      const transcriptText = await transcriptBlob.text();
      const parsed = JSON.parse(transcriptText) as DialogueReference;
      setReference(parsed);

      if (parsed.segments.length > 0) {
        const firstUrl = await getUrl({
          path: normalizeStoragePath(parsed.segments[0].audioKey),
        });
        setSegmentAudioUrl(firstUrl.url.toString());
      }
    } catch (error) {
      const description =
        error instanceof Error ? error.message : "Unable to load transcript";
      setMessage(description);
    } finally {
      setIsLoadingReference(false);
    }
  };

  const onSegmentChange = async (index: number): Promise<void> => {
    if (!reference) {
      return;
    }
    const segment = reference.segments[index];
    if (!segment) {
      return;
    }

    setActiveSegmentIndex(index);
    setRecordingBlob(segmentRecordings[index]?.blob ?? null);

    const url = await getUrl({
      path: normalizeStoragePath(segment.audioKey),
    });
    setSegmentAudioUrl(url.url.toString());
  };

  const startRecording = async (): Promise<void> => {
    setMessage("");
    setRecordingBlob(null);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;

    const recorder = new MediaRecorder(stream, {
      mimeType: "audio/webm",
    });
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setRecordingBlob(blob);
      const previewUrl = URL.createObjectURL(blob);
      setSegmentRecordings((previous) => {
        const existing = previous[activeSegmentIndex];
        if (existing) {
          URL.revokeObjectURL(existing.previewUrl);
        }
        return {
          ...previous,
          [activeSegmentIndex]: {
            segmentIndex: activeSegmentIndex,
            blob,
            previewUrl,
          },
        };
      });
      stream.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setMessage(`Recorded response for segment ${activeSegmentIndex + 1}.`);
    };

    recorder.start();
    setIsRecording(true);
  };

  const stopRecording = (): void => {
    if (!mediaRecorderRef.current) {
      return;
    }
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const submitDialogueAttempt = async (): Promise<void> => {
    if (!activeDialogue || !userSub || !identityId) {
      return;
    }
    const recordings = Object.values(segmentRecordings).sort(
      (left, right) => left.segmentIndex - right.segmentIndex,
    );
    if (recordings.length === 0) {
      setMessage("Record at least one segment before submitting.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const nextAttempt = historyRows.length + 1;
      for (const segmentRecording of recordings) {
        const timestamp = Date.now();
        const path = `recordings/${identityId}/${activeDialogue.id}/attempt-${nextAttempt}/segment-${segmentRecording.segmentIndex + 1}-${timestamp}.webm`;

        await uploadData({
          path,
          data: segmentRecording.blob,
          options: {
            contentType: "audio/webm",
          },
        }).result;

        await client.models.Recording.create({
          userId: userSub,
          dialogueId: activeDialogue.id,
          s3Key: path,
          attemptNumber: nextAttempt,
          status: "UPLOADED",
        });
      }

      setMessage(
        `Submitted ${recordings.length} segment recording(s) for ${activeDialogue.title}.`,
      );
      await hydrate();
    } catch (error) {
      const description =
        error instanceof Error ? error.message : "Unable to upload recording";
      setMessage(description);
    } finally {
      setIsSaving(false);
    }
  };

  const goNext = async (): Promise<void> => {
    if (!reference) {
      return;
    }

    const next = activeSegmentIndex + 1;
    if (next >= reference.segments.length) {
      setMessage("Dialogue completed. Great work.");
      return;
    }

    await onSegmentChange(next);
  };

  const goPrevious = async (): Promise<void> => {
    if (activeSegmentIndex <= 0) {
      return;
    }
    await onSegmentChange(activeSegmentIndex - 1);
  };

  return (
    <Authenticator>
      {({ signOut, user }) => (
        <main className="page">
          <header className="header">
            <div>
              <h1>CCL Saathi Practice</h1>
              <p>Signed in as {user?.signInDetails?.loginId ?? "User"}</p>
            </div>
            <button type="button" onClick={signOut}>
              Sign out
            </button>
          </header>

          <section className="grid">
            <article className="panel">
              <h2>Available Dialogues</h2>
              <p className="muted">
                Listed from API metadata and backed by S3 path keys.
              </p>
              <ul className="list">
                {dialogues.map((dialogue) => (
                  <li key={dialogue.id}>
                    <button
                      type="button"
                      className="itemButton"
                      aria-pressed={selectedDialogueId === dialogue.id}
                      onClick={() => void loadDialogue(dialogue)}
                    >
                      <span>{dialogue.title}</span>
                      <small>
                        {dialogue.category ?? "General"} · {dialogue.difficulty ?? "N/A"}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            </article>

            <article className="panel">
              <h2>Activity History</h2>
              <p className="muted">Previous attempts and available feedback scores.</p>
              <ul className="list">
                {historyRows.length === 0 ? (
                  <li className="empty">No attempts yet.</li>
                ) : (
                  historyRows.map((row) => (
                    <li key={row.recordingId} className="historyItem">
                      <strong>{row.dialogueTitle}</strong>
                      <span>Status: {row.status ?? "UPLOADED"}</span>
                      <span>
                        Score:{" "}
                        {typeof row.overallScore === "number"
                          ? `${Math.round(row.overallScore)} / 100`
                          : "Pending"}
                      </span>
                      <span>Attempt: {row.attemptNumber ?? "N/A"}</span>
                      <span>{formatDate(row.createdAt)}</span>
                    </li>
                  ))
                )}
              </ul>
            </article>
          </section>

          <section className="panel">
            <h2>Storage Paths</h2>
            <div className="storageColumns">
              <div>
                <h3>dialogues/*</h3>
                <ul className="pathList">
                  {dialogueStorageKeys.slice(0, 12).map((path) => (
                    <li key={path}>{path}</li>
                  ))}
                  {dialogueStorageKeys.length === 0 ? <li>No dialogue files listed.</li> : null}
                </ul>
              </div>
              <div>
                <h3>recordings/{identityId || "{identity-id}"}/*</h3>
                <ul className="pathList">
                  {recordingStorageKeys.slice(0, 12).map((path) => (
                    <li key={path}>{path}</li>
                  ))}
                  {recordingStorageKeys.length === 0 ? (
                    <li>No personal recordings uploaded yet.</li>
                  ) : null}
                </ul>
              </div>
            </div>
          </section>

          <section className="panel practicePanel">
            <h2>Practice Session</h2>
            {!activeDialogue ? <p>Select a dialogue to start.</p> : null}
            {isLoadingReference ? <p>Loading transcript and segments...</p> : null}
            {activeDialogue && reference && activeSegment ? (
              <>
                <p>
                  <strong>{activeDialogue.title}</strong> · Segment {activeSegment.segmentIndex}/
                  {reference.segments.length}
                </p>
                <p className="muted">{reference.scenario}</p>
                <p>
                  <strong>Speaker:</strong> {activeSegment.speaker}
                </p>
                <p>
                  <strong>Original:</strong> {activeSegment.original}
                </p>
                <p>
                  <strong>Expected interpretation:</strong>{" "}
                  {activeSegment.expectedInterpretation}
                </p>
                <p className="muted">
                  Recorded segments: {Object.keys(segmentRecordings).length}/
                  {reference.segments.length}
                </p>

                {segmentAudioUrl ? (
                  <audio controls key={segmentAudioUrl} src={segmentAudioUrl}>
                    <track kind="captions" />
                  </audio>
                ) : null}

                <div className="segmentList">
                  <h3>Segments</h3>
                  <ul className="list">
                    {reference.segments.map((segment, index) => (
                      <li key={segment.segmentIndex} className="segmentListItem">
                        <div>
                          <strong>Segment {segment.segmentIndex}</strong>
                          <div className="muted">{segment.speaker}</div>
                        </div>
                        <button
                          type="button"
                          aria-pressed={index === activeSegmentIndex}
                          onClick={() => void onSegmentChange(index)}
                        >
                          Start
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="actions">
                  {!isRecording ? (
                    <button type="button" onClick={() => void startRecording()}>
                      Start recording response
                    </button>
                  ) : (
                    <button type="button" onClick={stopRecording}>
                      Stop recording
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isSaving || Object.keys(segmentRecordings).length === 0}
                    onClick={() => void submitDialogueAttempt()}
                  >
                    {isSaving ? "Submitting..." : "Submit recorded segments"}
                  </button>
                  <button
                    type="button"
                    disabled={activeSegmentIndex === 0}
                    onClick={() => void goPrevious()}
                  >
                    Previous segment
                  </button>
                  <button type="button" onClick={() => void goNext()}>
                    Next segment
                  </button>
                </div>

                {recordingBlob && segmentRecordings[activeSegmentIndex] ? (
                  <audio controls src={segmentRecordings[activeSegmentIndex].previewUrl}>
                    <track kind="captions" />
                  </audio>
                ) : null}
              </>
            ) : null}
            {message ? <p className="message">{message}</p> : null}
          </section>
        </main>
      )}
    </Authenticator>
  );
}
