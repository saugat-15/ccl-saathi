import {
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
    type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import {
    GetSecretValueCommand,
    SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import {
    TranscribeClient,
    StartTranscriptionJobCommand,
    type LanguageCode,
    type MediaFormat,
} from '@aws-sdk/client-transcribe';

type S3Record = {
    s3: {
        bucket: { name: string };
        object: { key: string };
    };
};

type S3EventNotification = { Records: S3Record[] };

/** AWS Transcribe supports ne-NP; SDK typings may lag. */
const TRANSCRIPTION_LANGUAGES = ['en-US', 'ne-NP'] as LanguageCode[];

/** Group same-language words into one segment when gap (seconds) is below this. */
const SEGMENT_GAP_MERGE_SEC = 2;

type TranscribeWordSpan = {
    start: number;
    end: number;
    text: string;
    confidence: number;
    language: 'en-US' | 'ne-NP';
};

type MergedSegment = {
    segmentIndex: number;
    text: string;
    language: 'en-US' | 'ne-NP';
    startTime: number;
    endTime: number;
    confidence: number;
};

type MergedTranscriptPayload = {
    recordingId: string;
    mergedAt: string;
    rawText: string;
    overallConfidence: number;
    segments: MergedSegment[];
    sources: { enKey: string; neKey: string };
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

const EXT_TO_MEDIA_FORMAT: Record<string, MediaFormat> = {
    '.mp3': 'mp3',
    '.mp4': 'mp4',
    '.wav': 'wav',
    '.flac': 'flac',
    '.ogg': 'ogg',
    '.amr': 'amr',
    '.webm': 'webm',
    '.m4a': 'm4a',
};

function mediaFormatForObjectKey(key: string): MediaFormat | undefined {
    const lower = key.toLowerCase();
    for (const [ext, format] of Object.entries(EXT_TO_MEDIA_FORMAT)) {
        if (lower.endsWith(ext)) {
            return format;
        }
    }
    return undefined;
}

function decodeObjectKey(key: string): string {
    return decodeURIComponent(key.replace(/\+/g, ' '));
}

/** Job name: Transcribe allows [^*], max 200 chars, alphanumeric + ._- */
function jobNameFrom(parts: string[]): string {
    const raw = parts.join('-').replace(/[^a-zA-Z0-9._-]+/g, '-');
    const trimmed = raw.replace(/^-+|-+$/g, '').slice(0, 180);
    return trimmed.length > 0 ? trimmed : `job-${Date.now()}`;
}

/**
 * Expects `recordings/{cognitoSub}/{recordingId}.mp3` (same layout as naati-user-recordings/{cognitoId}/…).
 */
function parseRecordingKey(key: string): { cognitoId: string; recordingId: string } | undefined {
    const segments = key.split('/').filter(Boolean);
    if (segments.length < 3 || segments[0] !== 'recordings') {
        return undefined;
    }
    const cognitoId = segments[1];
    const fileName = segments.at(-1) ?? '';
    const recordingId = fileName.replace(/\.[^/.]+$/, '');
    if (!cognitoId || !recordingId) {
        return undefined;
    }
    return { cognitoId, recordingId };
}

function normalizeOutputPrefix(prefix: string): string {
    return prefix.replace(/\/*$/, '/');
}

function outputObjectKey(
    outputPrefix: string,
    recordingId: string,
    langFileBase: 'en' | 'ne' | 'merged',
): string {
    return `${outputPrefix}${recordingId}/${langFileBase}.json`.replace(/\/{2,}/g, '/');
}

function parseCompletedTranscriptKey(
    key: string,
    outputPrefix: string,
): { recordingId: string } | undefined {
    const prefix = normalizeOutputPrefix(outputPrefix);
    if (!key.startsWith(prefix)) {
        return undefined;
    }
    const relative = key.slice(prefix.length);
    const segments = relative.split('/');
    if (segments.length < 2) {
        return undefined;
    }
    const fileName = segments[segments.length - 1];
    if (fileName !== 'en.json' && fileName !== 'ne.json') {
        return undefined;
    }
    const recordingId = segments.slice(0, -1).join('/');
    if (!recordingId) {
        return undefined;
    }
    return { recordingId };
}

function getTranscribeResultsItems(data: unknown): unknown[] | undefined {
    if (!isRecord(data)) {
        return undefined;
    }
    const results = data.results;
    if (!isRecord(results)) {
        return undefined;
    }
    const items = results.items;
    return Array.isArray(items) ? items : undefined;
}

function parseTranscribeWords(data: unknown, language: 'en-US' | 'ne-NP'): TranscribeWordSpan[] {
    const items = getTranscribeResultsItems(data);
    if (!items) {
        return [];
    }

    const words: TranscribeWordSpan[] = [];

    for (const item of items) {
        if (!isRecord(item)) {
            continue;
        }
        const type = item.type;
        const alternatives = item.alternatives;

        if (type === 'punctuation') {
            if (Array.isArray(alternatives) && alternatives[0] && isRecord(alternatives[0])) {
                const content = alternatives[0].content;
                if (typeof content === 'string' && words.length > 0) {
                    const last = words[words.length - 1];
                    last.text = (last.text + content).trim();
                }
            }
            continue;
        }

        const startRaw = item.start_time;
        const endRaw = item.end_time;
        const start =
            typeof startRaw === 'string'
                ? parseFloat(startRaw)
                : typeof startRaw === 'number'
                    ? startRaw
                    : NaN;
        const end =
            typeof endRaw === 'string'
                ? parseFloat(endRaw)
                : typeof endRaw === 'number'
                    ? endRaw
                    : start;

        if (type !== 'pronunciation' && !Number.isFinite(start)) {
            continue;
        }

        let content = '';
        let confidence = 0;
        if (Array.isArray(alternatives) && alternatives[0] && isRecord(alternatives[0])) {
            const alt = alternatives[0];
            if (typeof alt.content === 'string') {
                content = alt.content;
            }
            const c = alt.confidence;
            if (typeof c === 'string') {
                confidence = parseFloat(c);
            } else if (typeof c === 'number') {
                confidence = c;
            }
        }

        if (!content || !Number.isFinite(start)) {
            continue;
        }

        const endTime = Number.isFinite(end) ? end : start;
        words.push({
            start,
            end: endTime,
            text: content,
            confidence: Number.isFinite(confidence) ? confidence : 0,
            language,
        });
    }

    return words;
}

function mergeAndGroupSegments(words: TranscribeWordSpan[]): MergedSegment[] {
    const sorted = [...words].sort((a, b) => a.start - b.start);
    type Acc = {
        text: string;
        language: 'en-US' | 'ne-NP';
        startTime: number;
        endTime: number;
        confSum: number;
        confCount: number;
    };

    const segments: MergedSegment[] = [];
    let cur: Acc | null = null;

    const flush = (): void => {
        if (!cur || cur.confCount === 0) {
            return;
        }
        segments.push({
            segmentIndex: segments.length + 1,
            text: cur.text,
            language: cur.language,
            startTime: cur.startTime,
            endTime: cur.endTime,
            confidence: cur.confSum / cur.confCount,
        });
    };

    for (const w of sorted) {
        if (
            cur &&
            cur.language === w.language &&
            w.start - cur.endTime <= SEGMENT_GAP_MERGE_SEC
        ) {
            cur.text = `${cur.text} ${w.text}`.trim();
            cur.endTime = Math.max(cur.endTime, w.end);
            cur.confSum += w.confidence;
            cur.confCount += 1;
        } else {
            flush();
            cur = {
                text: w.text,
                language: w.language,
                startTime: w.start,
                endTime: w.end,
                confSum: w.confidence,
                confCount: 1,
            };
        }
    }
    flush();

    return segments.map((s, i) => ({ ...s, segmentIndex: i + 1 }));
}

function isNoSuchKeyError(err: unknown): boolean {
    if (!isRecord(err)) {
        return false;
    }
    if (err.name === 'NoSuchKey') {
        return true;
    }
    const meta = err.$metadata;
    if (isRecord(meta) && meta.httpStatusCode === 404) {
        return true;
    }
    return false;
}

async function readObjectBodyText(out: GetObjectCommandOutput): Promise<string> {
    const body = out.Body;
    if (body === undefined) {
        return '';
    }
    if (typeof body.transformToString === 'function') {
        return body.transformToString();
    }
    return '';
}

async function getJsonFromS3(s3: S3Client, bucket: string, key: string): Promise<unknown | null> {
    try {
        const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const str = await readObjectBodyText(out);
        if (!str) {
            return null;
        }
        return JSON.parse(str) as unknown;
    } catch (err) {
        if (isNoSuchKeyError(err)) {
            return null;
        }
        throw err;
    }
}

type MergeResult = {
    recordingId: string;
    status: 'merged' | 'deferred' | 'error';
    key?: string;
    message?: string;
};

async function mergeIfBothReady(
    bucket: string,
    outputPrefix: string,
    recordingId: string,
    s3: S3Client,
): Promise<MergeResult> {
    const prefix = normalizeOutputPrefix(outputPrefix);
    const enKey = outputObjectKey(prefix, recordingId, 'en');
    const neKey = outputObjectKey(prefix, recordingId, 'ne');
    const mergedKey = outputObjectKey(prefix, recordingId, 'merged');

    const [enData, neData] = await Promise.all([
        getJsonFromS3(s3, bucket, enKey),
        getJsonFromS3(s3, bucket, neKey),
    ]);

    if (enData === null || neData === null) {
        console.info('merge deferred: waiting for both en.json and ne.json', {
            recordingId,
            hasEn: enData !== null,
            hasNe: neData !== null,
        });
        return { recordingId, status: 'deferred' };
    }

    try {
        const enWords = parseTranscribeWords(enData, 'en-US');
        const neWords = parseTranscribeWords(neData, 'ne-NP');
        const combined = [...enWords, ...neWords];
        const segments = mergeAndGroupSegments(combined);
        const rawText = segments.map((s) => s.text).join(' ').trim();
        const overallConfidence =
            segments.length > 0
                ? segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length
                : 0;

        const payload: MergedTranscriptPayload = {
            recordingId,
            mergedAt: new Date().toISOString(),
            rawText,
            overallConfidence,
            segments,
            sources: { enKey, neKey },
        };

        await s3.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: mergedKey,
                Body: JSON.stringify(payload, null, 2),
                ContentType: 'application/json',
            }),
        );

        console.info('Wrote merged transcript', { mergedKey, segmentCount: segments.length });
        return { recordingId, status: 'merged', key: mergedKey };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('merge failed', { recordingId, message });
        return { recordingId, status: 'error', message };
    }
}

type JobResult = {
    key: string;
    language: LanguageCode;
    jobName?: string;
    outputKey?: string;
    error?: string;
};

export const handler = async (
    event: unknown,
    context: { awsRequestId: string },
): Promise<{ statusCode: number; body: string }> => {
    console.info('naatiProcessor invoked', {
        requestId: context.awsRequestId,
        env: {
            TRANSCRIBE_ACCESS_ROLE_ARN: process.env.TRANSCRIBE_ACCESS_ROLE_ARN
                ? '[set]'
                : '[missing]',
            TRANSCRIBE_OUTPUT_PREFIX: process.env.TRANSCRIBE_OUTPUT_PREFIX ?? '[unset]',
            AWS_REGION: process.env.AWS_REGION ?? '[unset]',
        },
    });

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

    const transcribeClient = new TranscribeClient({});
    const s3Client = new S3Client({});
    const roleArn = process.env.TRANSCRIBE_ACCESS_ROLE_ARN;

    const jobResults: JobResult[] = [];
    const mergeResults: MergeResult[] = [];

    console.info('Processing S3 records', { recordCount: event.Records.length });

    for (const record of event.Records) {
        const bucket = record.s3.bucket.name;
        const rawKey = record.s3.object.key;
        const key = decodeObjectKey(rawKey);

        console.info('S3 record', { bucket, rawKey, decodedKey: key });

        const transcriptCompleted = parseCompletedTranscriptKey(key, outputPrefix);
        if (transcriptCompleted) {
            const mergeResult = await mergeIfBothReady(
                bucket,
                outputPrefix,
                transcriptCompleted.recordingId,
                s3Client,
            );
            mergeResults.push(mergeResult);
            continue;
        }

        if (key.startsWith(outputPrefix) && key.endsWith('/merged.json')) {
            console.info('Ignoring merged transcript upload (avoid rerun)', { key });
            continue;
        }

        if (!key.startsWith('recordings/')) {
            console.info('Ignoring S3 object outside recordings/ (not a user upload to transcribe)', {
                key,
            });
            continue;
        }

        if (!roleArn) {
            console.error('TRANSCRIBE_ACCESS_ROLE_ARN is not set');
            jobResults.push({
                key,
                language: 'en-US',
                error: 'Missing TRANSCRIBE_ACCESS_ROLE_ARN',
            });
            continue;
        }

        const parsed = parseRecordingKey(key);
        if (!parsed) {
            console.warn('Skipping record: key must be recordings/{entity_id}/{recordingId}.<ext>', {
                key,
            });
            jobResults.push({
                key,
                language: 'en-US',
                error:
                    'Key must match recordings/{cognitoId}/{recordingId}.<ext> — skipped',
            });
            continue;
        }

        const { recordingId, cognitoId } = parsed;
        console.info('Parsed upload', { recordingId, cognitoId });

        const fileName = key.split('/').at(-1) ?? key;
        const format = mediaFormatForObjectKey(fileName);
        if (!format) {
            console.warn('Skipping record: unsupported file extension', {
                fileName,
            });
            jobResults.push({
                key,
                language: 'en-US',
                error: 'Unsupported or missing audio extension — skipped',
            });
            continue;
        }

        const mediaUri = `s3://${bucket}/${key}`;
        const shortReq = context.awsRequestId.slice(0, 8);

        for (const languageCode of TRANSCRIPTION_LANGUAGES) {
            const langBase = languageCode === 'en-US' ? 'en' : 'ne';
            const jobName = jobNameFrom([recordingId, langBase, shortReq]);
            const transcriptOutputKey = outputObjectKey(outputPrefix, recordingId, langBase);

            try {
                console.info('Starting transcription job', {
                    jobName,
                    mediaUri,
                    output: { outputBucketName: bucket, outputKey: transcriptOutputKey },
                    languageCode,
                    mediaFormat: format,
                });

                const response = await transcribeClient.send(
                    new StartTranscriptionJobCommand({
                        TranscriptionJobName: jobName,
                        IdentifyLanguage: true,
                        Media: { MediaFileUri: mediaUri },
                        MediaFormat: format,
                        OutputBucketName: bucket,
                        OutputKey: transcriptOutputKey,
                        JobExecutionSettings: {
                            DataAccessRoleArn: roleArn,
                        },
                    }),
                );

                jobResults.push({
                    key,
                    language: languageCode,
                    jobName: response.TranscriptionJob?.TranscriptionJobName ?? jobName,
                    outputKey: transcriptOutputKey,
                });
                console.info('StartTranscriptionJob success', {
                    jobName: response.TranscriptionJob?.TranscriptionJobName ?? jobName,
                    status: response.TranscriptionJob?.TranscriptionJobStatus ?? 'unknown',
                });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error('StartTranscriptionJob failed', {
                    key,
                    jobName,
                    languageCode,
                    mediaUri,
                    message,
                    stack: err instanceof Error ? err.stack : undefined,
                });
                jobResults.push({ key, language: languageCode, error: message });
            }
        }
    }

    const jobFailed = jobResults.filter((r) => r.error !== undefined);
    const mergeFailed = mergeResults.filter((r) => r.status === 'error');
    const statusCode =
        jobFailed.length > 0 || mergeFailed.length > 0 ? 207 : 200;

    return {
        statusCode,
        body: JSON.stringify({ jobResults, mergeResults }),
    };
};

let cachedOpenAiApiKey: string | undefined;

function parseOpenAiSecretString(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
        try {
            const parsed: unknown = JSON.parse(trimmed);
            if (
                typeof parsed === 'object' &&
                parsed !== null &&
                'OpenAI_API_KEY' in parsed &&
                typeof (parsed as { OpenAI_API_KEY: unknown }).OpenAI_API_KEY === 'string'
            ) {
                return (parsed as { OpenAI_API_KEY: string }).OpenAI_API_KEY;
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
