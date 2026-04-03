import { a, defineData } from '@aws-amplify/backend';

const schema = a.schema({

  // ─── USER ───────────────────────────────────────────────
  // App-specific fields only — Cognito owns email/username/name
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
  // Official NAATI practice dialogues — admin managed
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
    status: a.enum([
      'UPLOADED',       // file in S3, not yet processed
      'PROCESSING',     // Transcribe job running
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
  // AWS Transcribe output — one per recording
  Transcription: a.model({
    recordingId: a.id().required(),
    userId: a.id().required(),
    dialogueId: a.id().required(),
    rawText: a.string(),                    // full combined transcript as plain string
    segments: a.json(),                     // structured segment array (see below)
    overallConfidence: a.float(),           // average confidence across all segments
    transcribeJobId: a.string(),            // AWS Transcribe job ID for reference
    recording: a.belongsTo('Recording', 'recordingId'),
  })
    .authorization(allow => [
      allow.owner(),
      allow.group('admin'),
    ]),

  // segments JSON shape:
  // [
  //   {
  //     segmentIndex: 1,
  //     text: "I need to see a doctor about my shoulder",
  //     language: "en-US",
  //     startTime: 0.5,
  //     endTime: 4.2,
  //     confidence: 0.97
  //   },
  //   {
  //     segmentIndex: 2,
  //     text: "मलाई मेरो काँधको बारेमा डाक्टरसँग भेट्नु छ",
  //     language: "ne-NP",
  //     startTime: 5.1,
  //     endTime: 9.8,
  //     confidence: 0.84
  //   }
  // ]

  // ─── FEEDBACK ───────────────────────────────────────────
  // Claude API scoring output — one per recording
  Feedback: a.model({
    recordingId: a.id().required(),
    userId: a.id().required(),
    dialogueId: a.id().required(),
    accuracyScore: a.float(),               // 0-100
    fluencyScore: a.float(),                // 0-100
    overallScore: a.float(),                // 0-100 — what user sees prominently
    missedTerms: a.string().array(),        // key terms user missed or mistranslated
    suggestions: a.string().array(),        // actionable improvement tips
    gradedSegments: a.json(),              // per-segment breakdown (see below)
    recording: a.belongsTo('Recording', 'recordingId'),
  })
    .authorization(allow => [
      allow.owner(),
      allow.group('admin'),
    ]),

  // gradedSegments JSON shape:
  // [
  //   {
  //     segmentIndex: 1,
  //     referenceText: "मलाई मेरो काँधको बारेमा डाक्टरसँग भेट्नु छ",
  //     userText: "मलाई मेरो काँधको बारे डाक्टर भेट्नु छ",
  //     segmentAccuracy: 78,
  //     missedTerms: ["बारेमा", "सँग"],
  //     comment: "Missing postposition 'सँग' changes the meaning slightly"
  //   }
  // ]

});

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});