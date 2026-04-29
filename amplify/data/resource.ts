import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({

  // ─── USER ───────────────────────────────────────────────
  User: a.model({
    hasSubscription: a.boolean().default(false),
    subscriptionExpiresAt: a.datetime(),
    stripeCustomerId: a.string(),
    stripeSubscriptionId: a.string(),
    recordings: a.hasMany('Recording', 'userId'),
  })
    .authorization(allow => [
      allow.owner(),
      allow.group('admin'),
    ]),

  // ─── DIALOGUE ───────────────────────────────────────────
  Dialogue: a.model({
    title: a.string().required(),
    description: a.string(),
    category: a.enum([
      'HEALTH',
      'LEGAL',
      'IMMIGRATION',
      'EMPLOYMENT',
      'SOCIAL_SERVICES',
    ]),
    difficulty: a.enum(['EASY', 'MEDIUM', 'HARD']),
    audioS3Key: a.string().required(),      // s3://naati-dialogues/{id}.mp3
    transcriptS3Key: a.string().required(), // s3://naati-dialogues/{id}.json
    durationSeconds: a.integer(),
    segmentCount: a.integer(),              // how many interpreted segments
    isActive: a.boolean().default(true),    // soft delete / hide from users
    sortOrder: a.integer(),                 // control display order on frontend
    recordings: a.hasMany('Recording', 'dialogueId'),
  })
    .authorization(allow => [
      allow.group('admin'),                   // only admin can create/edit
      allow.authenticated().to(['read']),     // subscribers can read
    ]),

  // ─── RECORDING ──────────────────────────────────────────
  // A single attempt by a user on a dialogue
  Recording: a.model({
    userId: a.id().required(),
    dialogueId: a.id().required(),
    s3Key: a.string().required(),           // s3://naati-user-recordings/{userId}/{attemptId}.mp3
    durationSeconds: a.float(),
    status: a.enum([
      'UPLOADED',       // file in S3, not yet processed
      'PROCESSING',     // OpenAI Whisper transcription in progress
      'SCORING',        // Claude scoring in progress
      'COMPLETED',      // feedback ready
      'FAILED',         // something went wrong
    ]),
    errorMessage: a.string(),               // populated if status = FAILED
    attemptNumber: a.integer(),             // nth attempt on this dialogue
    user: a.belongsTo('User', 'userId'),
    dialogue: a.belongsTo('Dialogue', 'dialogueId'),
    transcription: a.hasOne('Transcription', 'recordingId'),
    feedback: a.hasOne('Feedback', 'recordingId'),
  })
    .authorization(allow => [
      allow.owner(),
      allow.group('admin'),
    ]),

  // ─── TRANSCRIPTION ──────────────────────────────────────
  // Populated from S3 transcript JSON (OpenAI Whisper); one row per recording
  Transcription: a.model({
    recordingId: a.id().required(),
    userId: a.id().required(),
    dialogueId: a.id().required(),
    rawText: a.string(),                    // full transcript text
    segments: a.json(),                     // structured segment array (see below)
    overallConfidence: a.float(),           // optional; not set by Whisper path unless derived
    transcribeJobId: a.string(),            // optional reference (e.g. S3 transcript key)
    recording: a.belongsTo('Recording', 'recordingId'),
  })
    .authorization(allow => [
      allow.ownerDefinedIn('userId'),
      allow.group('admin'),
    ]),

  // ─── FEEDBACK ───────────────────────────────────────────
  // Claude API scoring output — one per recording
  Feedback: a.model({
    recordingId: a.id().required(),
    userId: a.id().required(),
    dialogueId: a.id().required(),
    accuracyScore: a.float(),               // 0-100
    completenessScore: a.float(),           // 0-100
    terminologyScore: a.float(),            // 0-100
    fluencyScore: a.float(),                // 0-100
    overallScore: a.float(),                // 0-100 — what user sees prominently
    strengths: a.string().array(),          // what the user did well
    missedTerms: a.string().array(),        // key terms user missed or mistranslated
    suggestions: a.string().array(),        // actionable improvement tips
    criticalErrors: a.json(),               // per-segment critical error breakdown
    examReadinessLevel: a.enum(['not_ready', 'developing', 'borderline', 'ready']),
    examReadinessReason: a.string(),
    gradedSegments: a.json(),               // per-segment score breakdown
    recording: a.belongsTo('Recording', 'recordingId'),
  })
    .authorization(allow => [
      allow.ownerDefinedIn('userId'),
      allow.group('admin'),
    ]),

});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});