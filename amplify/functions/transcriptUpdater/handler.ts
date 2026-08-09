import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { env } from '$amplify/env/transcriptUpdater';
import type { Schema } from '../../data/resource';

type S3Record = {
    s3: {
        bucket: { name: string };
        object: { key: string };
    };
};

type S3EventNotification = { Records: S3Record[] };

type TranscriptPayload = {
    recordingId?: string;
    sourceRecordingKey?: string;
    text?: string;
    segments?: Array<{ start: number; end: number; text: string }>;
};

type ReferenceSegment = {
    segmentIndex: number;
    original: string;
    expectedInterpretation: string;
};

type ReferenceTranscriptPayload = {
    segments?: ReferenceSegment[];
};

type ScoreReport = {
    scores: {
        accuracy: number;
        completeness: number;
        terminology: number;
        fluency: number;
        overall: number;
    };
    summary: {
        strengths: string[];
        priorityImprovements: string[];
    };
    missedTerms: Array<{
        term: string;
        expectedMeaning: string;
        userRendering: string;
        severity: 'low' | 'medium' | 'high';
    }>;
    criticalErrors: Array<{
        segmentIndex: number;
        type: 'omission' | 'mistranslation' | 'addition' | 'terminology' | 'number' | 'register';
        impact: string;
        evidence: string;
    }>;
    segmentFeedback: Array<{
        segmentIndex: number;
        accuracy: number;
        completeness: number;
        comment: string;
        missedTerms?: string[];
        /** Attributed slice of userTranscript for this segment (empty if absent). */
        userPortion: string;
    }>;
    examReadiness: {
        level: 'not_ready' | 'developing' | 'borderline' | 'ready';
        reason: string;
    };
};

const s3Client = new S3Client({});
let cachedOpenAiApiKey: string | undefined;

function elapsedMs(start: number): number {
    return Date.now() - start;
}

function decodeObjectKey(key: string): string {
    return decodeURIComponent(key.replace(/\+/g, ' '));
}

function transcriptKeyMatch(
    key: string,
    transcriptPrefix: string,
): { recordingId: string } | null {
    if (!key.endsWith('/transcript.json')) {
        return null;
    }

    const segments = key.split('/').filter(Boolean);
    if (segments.length < 2) {
        return null;
    }
    const recordingId = segments[segments.length - 2];
    if (!recordingId) {
        return null;
    }

    const normalizedPrefix = transcriptPrefix.replace(/\/*$/, '/');
    const isLegacyTranscript = key.startsWith(normalizedPrefix);
    const isHierarchicalTranscript =
        segments[0] === 'protected' &&
        segments.length >= 6 &&
        segments[2] === 'recordings';

    if (!isLegacyTranscript && !isHierarchicalTranscript) {
        return null;
    }
    return { recordingId };
}

function isS3UploadEvent(event: unknown): event is S3EventNotification {
    if (typeof event !== 'object' || event === null || !('Records' in event)) {
        return false;
    }
    const records = (event as { Records: unknown }).Records;
    return Array.isArray(records);
}

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(
    env as typeof env & { AMPLIFY_DATA_DEFAULT_NAME: string },
);

const intialiseDataClient = async () => {
    try {
        const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(
            env as typeof env & { AMPLIFY_DATA_DEFAULT_NAME: string },
        );

        Amplify.configure(resourceConfig, libraryOptions);
        return generateClient<Schema>();
    } catch (error) {
        console.error('Failed to initialise data client', { error });
        throw error;
    }
};

async function readTranscriptPayload(
    bucket: string,
    key: string,
): Promise<TranscriptPayload> {
    const object = await s3Client.send(
        new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        }),
    );
    const body = object.Body;
    if (body === undefined || typeof body.transformToString !== 'function') {
        throw new Error('Transcript object has no readable body');
    }
    const raw = await body.transformToString();
    const parsed = JSON.parse(raw) as TranscriptPayload;
    return parsed;
}

async function readJsonFromS3(bucket: string, key: string): Promise<unknown> {
    const object = await s3Client.send(
        new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        }),
    );
    const body = object.Body;
    if (body === undefined || typeof body.transformToString !== 'function') {
        throw new Error(`Object ${key} has no readable body`);
    }
    const raw = await body.transformToString();
    return JSON.parse(raw) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function toNumberInRange(value: unknown, fieldName: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`Invalid ${fieldName}: must be a finite number`);
    }
    if (value < 0 || value > 100) {
        throw new Error(`Invalid ${fieldName}: must be between 0 and 100`);
    }
    return value;
}

function toStringArray(value: unknown, fieldName: string): string[] {
    if (!Array.isArray(value)) {
        throw new Error(`Invalid ${fieldName}: must be an array`);
    }
    return value.map((item) => {
        if (typeof item !== 'string') {
            throw new Error(`Invalid ${fieldName}: array must contain strings`);
        }
        return item;
    });
}

function parseScoreReport(value: unknown): ScoreReport {
    if (!isRecord(value)) {
        throw new Error('Scoring response is not an object');
    }
    const scores = value.scores;
    const summary = value.summary;
    const missedTerms = value.missedTerms;
    const criticalErrors = value.criticalErrors;
    const segmentFeedback = value.segmentFeedback;
    const examReadiness = value.examReadiness;

    if (!isRecord(scores)) {
        throw new Error('Scoring response missing scores');
    }
    if (!isRecord(summary)) {
        throw new Error('Scoring response missing summary');
    }
    if (!Array.isArray(missedTerms)) {
        throw new Error('Scoring response missing missedTerms');
    }
    if (!Array.isArray(segmentFeedback)) {
        throw new Error('Scoring response missing segmentFeedback');
    }
    if (!Array.isArray(criticalErrors)) {
        throw new Error('Scoring response missing criticalErrors');
    }
    if (!isRecord(examReadiness)) {
        throw new Error('Scoring response missing examReadiness');
    }

    return {
        scores: {
            accuracy: toNumberInRange(scores.accuracy, 'scores.accuracy'),
            completeness: toNumberInRange(scores.completeness, 'scores.completeness'),
            terminology: toNumberInRange(scores.terminology, 'scores.terminology'),
            fluency: toNumberInRange(scores.fluency, 'scores.fluency'),
            overall: toNumberInRange(scores.overall, 'scores.overall'),
        },
        summary: {
            strengths: toStringArray(summary.strengths, 'summary.strengths'),
            priorityImprovements: toStringArray(
                summary.priorityImprovements,
                'summary.priorityImprovements',
            ),
        },
        missedTerms: missedTerms.map((item) => {
            if (!isRecord(item) || typeof item.term !== 'string') {
                throw new Error('Invalid missedTerms item');
            }
            const severity = item.severity;
            if (severity !== 'low' && severity !== 'medium' && severity !== 'high') {
                throw new Error('Invalid missedTerms.severity');
            }
            return {
                term: item.term,
                expectedMeaning:
                    typeof item.expectedMeaning === 'string' ? item.expectedMeaning : '',
                userRendering:
                    typeof item.userRendering === 'string' ? item.userRendering : '',
                severity,
            };
        }),
        criticalErrors: criticalErrors.map((item) => {
            if (!isRecord(item)) {
                throw new Error('Invalid criticalErrors item');
            }
            const type = item.type;
            if (
                type !== 'omission' &&
                type !== 'mistranslation' &&
                type !== 'addition' &&
                type !== 'terminology' &&
                type !== 'number' &&
                type !== 'register'
            ) {
                throw new Error('Invalid criticalErrors.type');
            }
            return {
                segmentIndex:
                    typeof item.segmentIndex === 'number' && Number.isFinite(item.segmentIndex)
                        ? item.segmentIndex
                        : 0,
                type,
                impact: typeof item.impact === 'string' ? item.impact : '',
                evidence: typeof item.evidence === 'string' ? item.evidence : '',
            };
        }),
        segmentFeedback: segmentFeedback.map((item) => {
            if (!isRecord(item)) {
                throw new Error('Invalid segmentFeedback item');
            }
            const missed = item.missedTerms;
            return {
                segmentIndex:
                    typeof item.segmentIndex === 'number' && Number.isFinite(item.segmentIndex)
                        ? item.segmentIndex
                        : 0,
                accuracy: toNumberInRange(item.accuracy, 'segmentFeedback.accuracy'),
                completeness: toNumberInRange(item.completeness, 'segmentFeedback.completeness'),
                comment: typeof item.comment === 'string' ? item.comment : '',
                missedTerms:
                    missed === undefined ? undefined : toStringArray(missed, 'segmentFeedback.missedTerms'),
                userPortion: typeof item.userPortion === 'string' ? item.userPortion : '',
            };
        }),
        examReadiness: {
            level:
                examReadiness.level === 'not_ready' ||
                    examReadiness.level === 'developing' ||
                    examReadiness.level === 'borderline' ||
                    examReadiness.level === 'ready'
                    ? examReadiness.level
                    : 'not_ready',
            reason: typeof examReadiness.reason === 'string' ? examReadiness.reason : '',
        },
    };
}

function canonicalDialoguePrefix(dialogueId: string): string {
    const parts = dialogueId.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[0] === 'dialogues') {
        return `dialogues/${parts[1]}`;
    }
    return dialogueId.replace(/\/+$/, '');
}

async function resolveReferenceArtifacts(
    bucket: string,
    dialogueId: string,
): Promise<{ referenceKey: string; originalPdfKey: string }> {
    const prefix = canonicalDialoguePrefix(dialogueId);
    const referenceKey = `${prefix}/reference.json`;
    const originalPdfKey = `${prefix}/original.pdf`;
    await s3Client.send(
        new GetObjectCommand({
            Bucket: bucket,
            Key: referenceKey,
        }),
    );
    return { referenceKey, originalPdfKey };
}

async function scoreTranscript(
    apiKey: string,
    context: { recordingId: string; dialogueId: string },
    referenceSegments: ReferenceSegment[],
    userText: string,
): Promise<ScoreReport> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: env.OPENAI_SCORER_MODEL ?? 'gpt-4.1-mini',
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: [
                        'You are a NAATI CCL examiner conducting a formal assessment. Your scores must reflect actual interpretation quality based solely on what is literally present in userTranscript.',
                        '',
                        'STEP 1 — VALIDITY CHECK: Before scoring, check if userTranscript contains a plausible interpretation of the source dialogue.',
                        'If userTranscript is empty, nonsensical, random noise, unrelated text, or does not interpret any of the source content → ALL scores must be 0–10.',
                        'If userTranscript only partially covers some segments → score only what is present; missing segments score 0.',
                        '',
                        'STEP 2 — ATTRIBUTION: Split userTranscript into portions and attribute each portion to the corresponding referenceSegment in order.',
                        'Each referenceSegment has an expectedInterpretation — compare the attributed portion directly to that.',
                        'For every segmentFeedback entry set userPortion to the exact attributed text from userTranscript for that segment (empty string if absent).',
                        '',
                        'STEP 3 — SCORE EACH SEGMENT using this rubric (use the full 0–100 range):',
                        '• 0–15: Absent, nonsensical, or completely irrelevant to that segment.',
                        '• 16–35: Attempted but major meaning loss — wrong language, most content missing or wrong.',
                        '• 36–55: Partial — some correct elements but significant omissions or mistranslations.',
                        '• 56–69: Near-pass — most meaning present but notable gaps or inaccuracies.',
                        '• 70–79: Pass — meaning transferred, minor omissions or imprecision only.',
                        '• 80–89: Good — accurate with only minor terminology gaps.',
                        '• 90–100: Excellent — near-perfect, correct terminology, complete meaning.',
                        '',
                        'MANDATORY SCORING RULES:',
                        '1. A score ≥ 70 REQUIRES citing specific text from userTranscript that proves correct meaning transfer. If you cannot cite it, the score must be below 50.',
                        '2. NEVER give benefit of the doubt. Default to the lower score when uncertain.',
                        '3. If the user repeated the source language instead of interpreting, accuracy = 0.',
                        '4. If a segment portion is absent from userTranscript, that segment scores 0 on all dimensions.',
                        '5. Scores must be integers.',
                        '6. overallScore = round(0.45×accuracy + 0.25×completeness + 0.20×terminology + 0.10×fluency).',
                        '7. Produce EXACTLY one segmentFeedback entry per referenceSegment.',
                        '8. Comments must be factual and cite specific evidence from userTranscript.',
                        '9. You must return ONLY valid JSON matching the required schema.',
                    ].join('\n'),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        task: 'Score this NAATI CCL attempt segment by segment. Apply the validity check first. Be strict — only reward what is demonstrably present in userTranscript.',
                        context: {
                            ...context,
                            sourceLanguage: 'mixed english-nepali',
                        },
                        referenceSegments,
                        userTranscript: userText,
                        outputSchema: {
                            recordingId: 'string',
                            dialogueId: 'string',
                            scores: {
                                accuracy: 'number 0-100',
                                completeness: 'number 0-100',
                                terminology: 'number 0-100',
                                fluency: 'number 0-100',
                                overall: 'number 0-100',
                            },
                            summary: {
                                strengths: ['string'],
                                priorityImprovements: ['string'],
                            },
                            missedTerms: [
                                {
                                    term: 'string',
                                    expectedMeaning: 'string',
                                    userRendering: 'string',
                                    severity: 'low|medium|high',
                                },
                            ],
                            criticalErrors: [
                                {
                                    segmentIndex: 'number',
                                    type: 'omission|mistranslation|addition|terminology|number|register',
                                    impact: 'string',
                                    evidence: 'string',
                                },
                            ],
                            segmentFeedback: [
                                {
                                    segmentIndex: 'number',
                                    accuracy: 'number 0-100',
                                    completeness: 'number 0-100',
                                    comment: 'string',
                                    missedTerms: ['string'],
                                    userPortion:
                                        'string — attributed text from userTranscript for this segment; empty if absent',
                                },
                            ],
                            examReadiness: {
                                level: 'not_ready|developing|borderline|ready',
                                reason: 'string',
                            },
                        },
                    }),
                },
            ],
        }),
    });

    const text = await response.text();
    if (!response.ok) {
        throw new Error(`Scoring call failed (${response.status}): ${text.slice(0, 400)}`);
    }
    const parsed = JSON.parse(text) as {
        choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = parsed.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
        throw new Error('Scoring response did not include JSON content');
    }
    return parseScoreReport(JSON.parse(content) as unknown);
}

function parseOpenAiSecretString(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('{')) {
        return raw;
    }
    try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (!isRecord(parsed)) {
            return raw;
        }
        const keyValue = parsed.OpenAI_API_KEY;
        const keyValueLower = parsed.openai_api_key;
        if (typeof keyValue === 'string' && keyValue.length > 0) {
            return keyValue;
        }
        if (typeof keyValueLower === 'string' && keyValueLower.length > 0) {
            return keyValueLower;
        }
    } catch {
        return raw;
    }
    return raw;
}

async function getOpenAiApiKey(): Promise<string> {
    if (cachedOpenAiApiKey) {
        return cachedOpenAiApiKey;
    }
    const secretId = process.env.OPENAI_SECRET_ID;
    if (!secretId) {
        throw new Error('OPENAI_SECRET_ID is not configured');
    }
    const secretsClient = new SecretsManagerClient({
        region: env.AWS_REGION ?? 'ap-southeast-2',
    });
    const response = await secretsClient.send(
        new GetSecretValueCommand({
            SecretId: secretId,
            VersionStage: 'AWSCURRENT',
        }),
    );
    if (!response.SecretString) {
        throw new Error('OpenAI secret has no SecretString');
    }
    cachedOpenAiApiKey = parseOpenAiSecretString(response.SecretString);
    return cachedOpenAiApiKey;
}

async function incrementFreeAttempts(
    dataClient: ReturnType<typeof generateClient<Schema>>,
    userId: string,
): Promise<void> {
    try {
        const billingList = await dataClient.models.BillingProfile.list({
            filter: { userId: { eq: userId } },
        });
        if (billingList.errors || billingList.data.length === 0) {
            console.warn('incrementFreeAttempts: billing profile not found', { userId });
            return;
        }
        const billing = billingList.data[0];
        const hasValidSubscription =
            billing.hasSubscription === true &&
            (billing.subscriptionExpiresAt == null ||
                new Date(billing.subscriptionExpiresAt) > new Date());

        if (hasValidSubscription) {
            return; // subscribers don't consume free attempts
        }

        await dataClient.models.BillingProfile.update({
            id: billing.id,
            freeAttempts: (billing.freeAttempts ?? 0) + 1,
        });
        console.info('incrementFreeAttempts: incremented', { userId, was: billing.freeAttempts });
    } catch (err) {
        // Non-fatal: log and continue — a failed counter update must not fail the whole pipeline
        console.error('incrementFreeAttempts: error', {
            userId,
            message: err instanceof Error ? err.message : String(err),
        });
    }
}

export const handler = async (event: unknown): Promise<{ statusCode: number; body: string }> => {
    const handlerStartedAt = Date.now();
    let dataClient: ReturnType<typeof generateClient<Schema>>;
    try {
        dataClient = await intialiseDataClient();
    } catch (error) {
        console.error('Failed to initialise data client', { error });
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to initialise data client' }),
        };
    }
    if (!isS3UploadEvent(event)) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Expected S3 event with Records' }),
        };
    }

    const transcriptPrefix = env.TRANSCRIPT_PREFIX ?? 'naati-transcriptions/';
    const results: Array<{ key: string; recordingId?: string; error?: string }> = [];
    console.info('Transcript updater started', {
        recordCount: event.Records.length,
        transcriptPrefix,
    });

    for (const record of event.Records) {
        const recordStartedAt = Date.now();
        const bucket = record.s3.bucket.name;
        const key = decodeObjectKey(record.s3.object.key);
        console.info('Processing S3 record', { bucket, key });
        const match = transcriptKeyMatch(key, transcriptPrefix);
        if (!match) {
            console.info('Skipping non-transcript key', { key });
            continue;
        }

        const { recordingId } = match;
        console.info('Matched transcript key', { key, recordingId });

        try {
            const readStartedAt = Date.now();
            const payload = await readTranscriptPayload(bucket, key);
            console.info('Loaded transcript payload', {
                key,
                recordingId,
                textLength: (payload.text ?? '').length,
                segmentCount: payload.segments?.length ?? 0,
                elapsedMs: elapsedMs(readStartedAt),
            });

            const recordingLookupStartedAt = Date.now();
            const recordingGet = await dataClient.models.Recording.get({ id: recordingId });
            if (recordingGet.errors || !recordingGet.data) {
                throw new Error(
                    `Recording lookup failed: ${recordingGet.errors?.map((e: any) => e.message).join(', ') ?? 'not found'
                    }`,
                );
            }
            console.info('Loaded recording row', {
                recordingId,
                dialogueId: recordingGet.data.dialogueId,
                status: recordingGet.data.status,
                elapsedMs: elapsedMs(recordingLookupStartedAt),
            });

            // ── Free-attempt gate (backend enforcement) ──────────────────────
            const userId = recordingGet.data.userId;
            const billingList = await dataClient.models.BillingProfile.list({
                filter: { userId: { eq: userId } },
            });
            const billing = billingList.data?.[0];
            const hasValidSubscription =
                billing?.hasSubscription === true &&
                (billing.subscriptionExpiresAt == null ||
                    new Date(billing.subscriptionExpiresAt) > new Date());

            if (!hasValidSubscription && (billing?.freeAttempts ?? 0) >= 5) {
                console.warn('Free attempt limit reached, rejecting', { userId, recordingId, freeAttempts: billing?.freeAttempts });
                await dataClient.models.Recording.update({
                    id: recordingId,
                    status: 'FAILED',
                    errorMessage: "You've reached the 5-attempt limit for free accounts. Join the Pro waitlist to keep practising.",
                });
                results.push({ key, recordingId, error: 'limit_reached' });
                continue;
            }
            // ─────────────────────────────────────────────────────────────────

            const recordingUpdateToScoring = await dataClient.models.Recording.update({
                id: recordingId,
                status: 'SCORING',
                errorMessage: null,
            });
            if (recordingUpdateToScoring.errors) {
                throw new Error(
                    `Recording status update failed: ${recordingUpdateToScoring.errors.map((e) => e.message).join(', ')}`,
                );
            }
            console.info('Recording marked as SCORING', { recordingId });

            const transcriptionId = `tr-${recordingId}`;
            const transcriptionUpdateStartedAt = Date.now();
            const transcriptionUpdate = await dataClient.models.Transcription.update({
                id: transcriptionId,
                recordingId,
                userId: recordingGet.data.userId,
                dialogueId: recordingGet.data.dialogueId,
                rawText: payload.text ?? '',
                segments: JSON.stringify(payload.segments ?? []),
                transcribeJobId: key,
            });
            if (!transcriptionUpdate.errors && transcriptionUpdate.data) {
                console.info('Updated transcription row', {
                    recordingId,
                    transcriptionId,
                    elapsedMs: elapsedMs(transcriptionUpdateStartedAt),
                });
            } else {
                const transcriptionCreateStartedAt = Date.now();
                const transcriptionCreate = await dataClient.models.Transcription.create({
                    id: transcriptionId,
                    recordingId,
                    userId: recordingGet.data.userId,
                    dialogueId: recordingGet.data.dialogueId,
                    rawText: payload.text ?? '',
                    segments: JSON.stringify(payload.segments ?? []),
                    transcribeJobId: key,
                });
                if (transcriptionCreate.errors) {
                    throw new Error(
                        `Transcription create failed: ${transcriptionCreate.errors.map((e) => e.message).join(', ')}`,
                    );
                }
                console.info('Created transcription row', {
                    recordingId,
                    transcriptionId,
                    elapsedMs: elapsedMs(transcriptionCreateStartedAt),
                });
            }

            const referenceResolveStartedAt = Date.now();
            const { referenceKey, originalPdfKey } = await resolveReferenceArtifacts(
                bucket,
                recordingGet.data.dialogueId,
            );
            console.info('Resolved reference key', {
                recordingId,
                dialogueId: recordingGet.data.dialogueId,
                referenceKey,
                originalPdfKey,
                elapsedMs: elapsedMs(referenceResolveStartedAt),
            });
            const referenceRaw = await readJsonFromS3(bucket, referenceKey);
            const reference = (isRecord(referenceRaw) ? referenceRaw : {}) as ReferenceTranscriptPayload;
            const referenceSegments = Array.isArray(reference.segments) ? reference.segments : [];
            if (referenceSegments.length === 0) {
                throw new Error('Reference transcript has no segments for scoring');
            }
            console.info('Loaded reference segments', {
                recordingId,
                referenceSegmentCount: referenceSegments.length,
            });

            const apiKeyStartedAt = Date.now();
            const apiKey = await getOpenAiApiKey();
            console.info('Loaded OpenAI API key from Secrets Manager', {
                recordingId,
                elapsedMs: elapsedMs(apiKeyStartedAt),
            });
            const scoringStartedAt = Date.now();
            const report = await scoreTranscript(
                apiKey,
                { recordingId, dialogueId: recordingGet.data.dialogueId },
                referenceSegments,
                payload.text ?? '',
            );
            console.info('Scoring completed', {
                recordingId,
                overall: report.scores.overall,
                elapsedMs: elapsedMs(scoringStartedAt),
            });

            const feedbackId = `fb-${recordingId}`;
            const feedbackPayload = {
                id: feedbackId,
                recordingId,
                userId: recordingGet.data.userId,
                dialogueId: recordingGet.data.dialogueId,
                accuracyScore: report.scores.accuracy,
                completenessScore: report.scores.completeness,
                terminologyScore: report.scores.terminology,
                fluencyScore: report.scores.fluency,
                overallScore: report.scores.overall,
                missedTerms: report.missedTerms.map((item) => item.term),
                strengths: report.summary.strengths,
                suggestions: report.summary.priorityImprovements,
                criticalErrors: JSON.stringify(report.criticalErrors),
                examReadinessLevel: report.examReadiness.level,
                examReadinessReason: report.examReadiness.reason,
                gradedSegments: JSON.stringify(
                    report.segmentFeedback.map((segment) => {
                        const reference = referenceSegments.find(
                            (ref) => ref.segmentIndex === segment.segmentIndex,
                        );
                        return {
                            segmentIndex: segment.segmentIndex,
                            segmentAccuracy: segment.accuracy,
                            segmentCompleteness: segment.completeness,
                            missedTerms: segment.missedTerms ?? [],
                            comment: segment.comment,
                            userPortion: segment.userPortion,
                            expectedInterpretation: reference?.expectedInterpretation ?? '',
                        };
                    }),
                ),
            };
            const feedbackUpdateStartedAt = Date.now();
            const feedbackUpdate = await dataClient.models.Feedback.update(feedbackPayload);
            if (!feedbackUpdate.errors && feedbackUpdate.data) {
                console.info('Updated feedback row', {
                    recordingId,
                    feedbackId,
                    elapsedMs: elapsedMs(feedbackUpdateStartedAt),
                });
            } else {
                const feedbackCreateStartedAt = Date.now();
                const feedbackCreate = await dataClient.models.Feedback.create(feedbackPayload);
                if (feedbackCreate.errors) {
                    throw new Error(
                        `Feedback create failed: ${feedbackCreate.errors.map((e) => e.message).join(', ')}`,
                    );
                }
                console.info('Created feedback row', {
                    recordingId,
                    feedbackId,
                    elapsedMs: elapsedMs(feedbackCreateStartedAt),
                });
            }

            const recordingUpdate = await dataClient.models.Recording.update({
                id: recordingId,
                status: 'COMPLETED',
                errorMessage: null,
            });
            if (recordingUpdate.errors) {
                throw new Error(
                    `Recording update failed: ${recordingUpdate.errors.map((e) => e.message).join(', ')}`,
                );
            }
            console.info('Recording marked as COMPLETED', {
                recordingId,
                totalElapsedMs: elapsedMs(recordStartedAt),
            });

            // Increment free-attempt counter server-side.
            // The owner cannot write User fields (schema enforces read-only for owner),
            // so this Lambda (IAM auth) is the sole writer of freeAttempts.
            await incrementFreeAttempts(dataClient, recordingGet.data.userId);

            results.push({ key, recordingId });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const userMessage =
                'Something went wrong while processing this attempt. Please try again.';
            await dataClient.models.Recording.update({
                id: recordingId,
                status: 'FAILED',
                errorMessage: userMessage,
            });
            console.error('Transcript updater failed for recording', {
                key,
                recordingId,
                message,
                totalElapsedMs: elapsedMs(recordStartedAt),
                stack: err instanceof Error ? err.stack : undefined,
            });
            results.push({ key, recordingId, error: message });
        }
    }

    const hasErrors = results.some((r) => r.error !== undefined);
    console.info('Transcript updater finished', {
        hasErrors,
        processed: results.length,
        elapsedMs: elapsedMs(handlerStartedAt),
    });
    return {
        statusCode: hasErrors ? 207 : 200,
        body: JSON.stringify({ results }),
    };
};
