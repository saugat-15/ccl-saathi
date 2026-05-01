import {
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import {
    GetSecretValueCommand,
    SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { env } from '$amplify/env/naati-processor.js';
import type { Schema } from '../../data/resource.js';

type S3Record = {
    s3: {
        bucket: { name: string };
        object: { key: string };
    };
};

type S3EventNotification = { Records: S3Record[] };

const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';

/** Saved to `{TRANSCRIBE_OUTPUT_PREFIX}{recordingId}/transcript.json`. */
type WhisperStoredTranscript = {
    source: 'openai-whisper';
    recordingId: string;
    sourceRecordingKey: string;
    transcribedAt: string;
    detectedLanguage?: string;
    text: string;
    segments: Array<{ start: number; end: number; text: string }>;
};

type WhisperVerboseSegment = {
    start: number;
    end: number;
    text?: string;
};

type WhisperVerboseJson = {
    text?: string;
    language?: string;
    segments?: WhisperVerboseSegment[];
};

function safeStringify(value: unknown, maxLen: number): string {
    try {
        const json = JSON.stringify(value);
        if (json.length <= maxLen) return json;
        return `${json.slice(0, maxLen)}…(truncated)`;
    } catch {
        return '[unstringifiable]';
    }
}

function isS3UploadEvent(event: unknown): event is S3EventNotification {
    if (typeof event !== 'object' || event === null || !('Records' in event)) {
        return false;
    }
    const rec = (event as { Records: unknown }).Records;
    return Array.isArray(rec);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function decodeObjectKey(key: string): string {
    return decodeURIComponent(key.replace(/\+/g, ' '));
}

/**
 * Handles two key shapes:
 *   protected/{identityId}/recordings/{recordingId}.ext  (Amplify Storage upload path)
 *   recordings/{cognitoId}/{recordingId}.ext             (legacy)
 */
function parseRecordingKey(key: string): { cognitoId: string; recordingId: string } | undefined {
    const segments = key.split('/').filter(Boolean);

    // protected/{identityId}/recordings/{recordingId}.ext
    if (segments[0] === 'protected' && segments[2] === 'recordings' && segments.length >= 4) {
        const cognitoId = segments[1];
        const fileName = segments.at(-1) ?? '';
        const recordingId = fileName.replace(/\.[^/.]+$/, '');
        if (cognitoId && recordingId) {
            return { cognitoId, recordingId };
        }
    }

    // recordings/{cognitoId}/{recordingId}.ext
    if (segments[0] === 'recordings' && segments.length >= 3) {
        const cognitoId = segments[1];
        const fileName = segments.at(-1) ?? '';
        const recordingId = fileName.replace(/\.[^/.]+$/, '');
        if (cognitoId && recordingId) {
            return { cognitoId, recordingId };
        }
    }

    return undefined;
}

function normalizeOutputPrefix(prefix: string): string {
    return prefix.replace(/\/*$/, '/');
}

function transcriptOutputKey(outputPrefix: string, recordingId: string): string {
    const prefix = normalizeOutputPrefix(outputPrefix);
    return `${prefix}${recordingId}/transcript.json`.replace(/\/{2,}/g, '/');
}

function verboseJsonFromResponse(raw: unknown): WhisperVerboseJson {
    if (!isRecord(raw)) {
        return {};
    }
    const textRaw = raw.text;
    const text = typeof textRaw === 'string' ? textRaw : undefined;
    const langRaw = raw.language;
    const language = typeof langRaw === 'string' ? langRaw : undefined;
    const segmentsRaw = raw.segments;
    const segments: WhisperVerboseSegment[] = [];
    if (Array.isArray(segmentsRaw)) {
        for (const item of segmentsRaw) {
            if (!isRecord(item)) {
                continue;
            }
            const s = item.start;
            const e = item.end;
            const start =
                typeof s === 'number' ? s : typeof s === 'string' ? parseFloat(s) : NaN;
            const end = typeof e === 'number' ? e : typeof e === 'string' ? parseFloat(e) : NaN;
            const t = item.text;
            if (!Number.isFinite(start)) {
                continue;
            }
            segments.push({
                start,
                end: Number.isFinite(end) ? end : start,
                text: typeof t === 'string' ? t : undefined,
            });
        }
    }
    return { text, language, segments };
}

function storedTranscriptFromVerbose(
    verbose: WhisperVerboseJson,
    recordingId: string,
    sourceRecordingKey: string,
): WhisperStoredTranscript {
    const rawText =
        typeof verbose.text === 'string' && verbose.text.trim().length > 0
            ? verbose.text.trim()
            : (verbose.segments ?? [])
                .map((s) => (typeof s.text === 'string' ? s.text.trim() : ''))
                .filter(Boolean)
                .join(' ')
                .trim();

    const segments = (verbose.segments ?? [])
        .map((s) => ({
            start: s.start,
            end: s.end,
            text: (typeof s.text === 'string' ? s.text : '').trim(),
        }))
        .filter((s) => s.text.length > 0);

    return {
        source: 'openai-whisper',
        recordingId,
        sourceRecordingKey,
        transcribedAt: new Date().toISOString(),
        detectedLanguage: verbose.language,
        text: rawText,
        segments,
    };
}

async function transcribeWithWhisper(
    audio: Uint8Array,
    fileName: string,
    apiKey: string,
): Promise<WhisperVerboseJson> {
    const form = new FormData();
    const mime =
        fileName.toLowerCase().endsWith('.wav')
            ? 'audio/wav'
            : fileName.toLowerCase().endsWith('.webm')
                ? 'audio/webm'
                : fileName.toLowerCase().endsWith('.m4a')
                    ? 'audio/mp4'
                    : fileName.toLowerCase().endsWith('.ogg')
                        ? 'audio/ogg'
                        : fileName.toLowerCase().endsWith('.flac')
                            ? 'audio/flac'
                            : 'audio/mpeg';
    form.append('file', new Blob([new Uint8Array(audio)], { type: mime }), fileName);
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');
    form.append('prompt', 'prompt: `This is a bilingual NAATI CCL dialogue alternating between English and Nepali. Transcribe each speaker in their original language. Do not translate. When the speaker speaks Nepali, transcribe in Nepali Devanagari script. When the speaker speaks English, transcribe in English.`,');

    const res = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
        body: form,
    });

    const rawText = await res.text();
    let parsed: unknown;
    try {
        parsed = rawText ? (JSON.parse(rawText) as unknown) : {};
    } catch {
        throw new Error(
            `OpenAI transcription: non-JSON response (${res.status}): ${rawText.slice(0, 500)}`,
        );
    }

    if (!res.ok) {
        const errMsg =
            isRecord(parsed) && typeof parsed.error === 'object' && parsed.error !== null
                ? safeStringify(parsed.error, 800)
                : rawText.slice(0, 500);
        throw new Error(`OpenAI transcription failed (${res.status}): ${errMsg}`);
    }

    return verboseJsonFromResponse(parsed);
}

let cachedOpenAiApiKey: string | undefined;

function parseOpenAiSecretString(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
        try {
            const parsed: unknown = JSON.parse(trimmed);
            if (typeof parsed === 'object' && parsed !== null) {
                const value = (parsed as any).OpenAI_API_KEY ?? (parsed as any).openai_api_key;
                if (typeof value === 'string' && value !== '') {
                    return value;
                }
            }
        } catch {
            /* use raw string below */
        }
    }
    return raw;
}

/**
 * Reads the OpenAI API key from Secrets Manager (see OPENAI_SECRET_ID / backend IAM).
 * Result is cached for the lifetime of the Lambda execution environment.
 */
export async function getOpenAiApiKey(): Promise<string> {
    if (cachedOpenAiApiKey !== undefined) {
        return cachedOpenAiApiKey;
    }

    const secretId = process.env.OPENAI_SECRET_ID;
    if (!secretId) {
        throw new Error('OPENAI_SECRET_ID is not set');
    }

    const client = new SecretsManagerClient({
        region: process.env.AWS_REGION ?? 'ap-southeast-2',
    });

    const response = await client.send(
        new GetSecretValueCommand({
            SecretId: secretId,
            VersionStage: 'AWSCURRENT',
        }),
    );

    const raw = response.SecretString;
    if (raw === undefined || raw === '') {
        throw new Error('OpenAI secret has no SecretString');
    }

    cachedOpenAiApiKey = parseOpenAiSecretString(raw);
    return cachedOpenAiApiKey;
}

type ProcessResult = {
    recordingId?: string;
    sourceKey?: string;
    outputKey?: string;
    error?: string;
};

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(
    env as typeof env & { AMPLIFY_DATA_DEFAULT_NAME: string },
);

Amplify.configure(resourceConfig, libraryOptions);
const dataClient = generateClient<Schema>();

export const handler = async (
    event: unknown,
    context: { awsRequestId: string },
): Promise<{ statusCode: number; body: string }> => {

    const outputPrefix = normalizeOutputPrefix(
        process.env.TRANSCRIBE_OUTPUT_PREFIX ?? 'naati-transcriptions/',
    );

    console.info('Event shape check', {
        isS3UploadEvent: isS3UploadEvent(event),
        eventPreview: safeStringify(event, 2500),
    });

    if (!isS3UploadEvent(event)) {
        console.warn('Unexpected event shape', {
            error: 'Expected S3 event with Records',
            eventPreview: safeStringify(event, 2500),
        });
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Expected S3 event with Records' }),
        };
    }

    const s3Client = new S3Client({});
    const results: ProcessResult[] = [];

    console.info('Processing S3 records', { recordCount: event.Records.length });

    for (const record of event.Records) {
        const bucket = record.s3.bucket.name;
        const rawKey = record.s3.object.key;
        const key = decodeObjectKey(rawKey);

        console.info('S3 record', { bucket, rawKey, decodedKey: key });

        if (key.startsWith(outputPrefix)) {
            console.info('Ignoring object under transcript output prefix (avoid rerun)', { key });
            continue;
        }

        if (!key.startsWith('recordings/') && !key.startsWith('protected/')) {
            console.info('Ignoring S3 object outside recordings/ or protected/', { key });
            continue;
        }

        const parsed = parseRecordingKey(key);
        if (!parsed) {
            console.warn('Skipping record: key must be recordings/{entity_id}/{recordingId}.<ext>', {
                key,
            });
            results.push({
                error:
                    'Key must match recordings/{cognitoId}/{recordingId}.<ext> — skipped',
                sourceKey: key,
            });
            continue;
        }

        const { recordingId, cognitoId } = parsed;
        console.info('Parsed upload', { recordingId, cognitoId });

        const fileName = key.split('/').at(-1) ?? key;
        const outKey = transcriptOutputKey(outputPrefix, recordingId);

        await dataClient.models.Recording.update({ id: recordingId, status: 'PROCESSING', errorMessage: null });
        console.info('Recording marked as PROCESSING', { recordingId });

        let apiKey: string;
        try {
            apiKey = await getOpenAiApiKey();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('OpenAI API key unavailable', { message });
            await dataClient.models.Recording.update({ id: recordingId, status: 'FAILED', errorMessage: message });
            results.push({ recordingId, sourceKey: key, error: message });
            continue;
        }

        let audioBytes: Uint8Array;
        try {
            const obj = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
            const body = obj.Body;
            if (body === undefined || typeof body.transformToByteArray !== 'function') {
                throw new Error('S3 object has no readable body');
            }
            audioBytes = await body.transformToByteArray();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('Failed to read recording from S3', { key, message });
            await dataClient.models.Recording.update({ id: recordingId, status: 'FAILED', errorMessage: message });
            results.push({ recordingId, sourceKey: key, error: message });
            continue;
        }

        try {
            const verbose = await transcribeWithWhisper(audioBytes, fileName, apiKey);
            const stored = storedTranscriptFromVerbose(verbose, recordingId, key);
            await s3Client.send(
                new PutObjectCommand({
                    Bucket: bucket,
                    Key: outKey,
                    Body: JSON.stringify(stored, null, 2),
                    ContentType: 'application/json',
                }),
            );
            console.info('Wrote Whisper transcript', { outKey });
            results.push({ recordingId, sourceKey: key, outputKey: outKey });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('Whisper transcription failed', {
                key,
                message,
                stack: err instanceof Error ? err.stack : undefined,
            });
            await dataClient.models.Recording.update({ id: recordingId, status: 'FAILED', errorMessage: message });
            results.push({ recordingId, sourceKey: key, error: message });
        }
    }

    const failed = results.filter((r) => r.error !== undefined);
    const statusCode = failed.length > 0 ? 207 : 200;

    return {
        statusCode,
        body: JSON.stringify({ results }),
    };
};
