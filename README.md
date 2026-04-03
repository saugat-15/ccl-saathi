# CCLSaathi 🇳🇵

> AI-powered NAATI CCL practice platform built for underserved migrant communities in Australia. Upload your interpretation, get instant AI feedback, and track your path to 5 PR points. Launching with Nepali — the community the big platforms forgot.

---

## The Problem

Thousands of Nepali migrants in Australia prepare for the NAATI CCL exam every year — a test worth 5 permanent residency points. Existing platforms serve 54 languages generically. None are built *for* Nepali candidates, with native-quality content, natural Nepali register, or culturally relevant dialogue topics.

CCLSaathi fixes that.

---

## What It Does

- 🎙️ **Record your interpretation** — practice against real NAATI-style dialogues
- 🤖 **Instant AI feedback** — accuracy score, fluency score, missed terms, and segment-level suggestions powered by Claude
- 📊 **Track your progress** — see your scores improve over time toward exam readiness
- 🇳🇵 **Built for Nepali first** — native-quality bilingual content, expanding to all 54 CCL languages

---

## Architecture

```
Next.js (Amplify Hosting)
        ↓
Amplify Auth (Cognito) — user authentication
Amplify Data (AppSync + DynamoDB) — data layer
Amplify Storage (S3) — audio storage
        ↓
Amplify Functions (Lambda) — async processing pipeline
        ↓
┌─────────────────────────────────────────┐
│           Processing Pipeline           │
│                                         │
│  processRecording                       │
│    S3 upload → starts Transcribe job    │
│          ↓                              │
│  processTranscription                   │
│    Transcribe complete → saves segments │
│          ↓                              │
│  processScoring                         │
│    Segments → Claude API → Feedback     │
└─────────────────────────────────────────┘
        ↓
AppSync Subscriptions — real-time status updates to frontend
        ↓
Stripe — subscription billing ($25/month)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router) |
| Hosting | AWS Amplify Hosting |
| Auth | AWS Amplify Auth (Cognito) |
| API | AWS AppSync (GraphQL) |
| Database | Amazon DynamoDB |
| Storage | AWS Amplify Storage (S3) |
| Functions | AWS Amplify Functions (Lambda) |
| Transcription | AWS Transcribe (en-US + ne-NP) |
| AI Scoring | Anthropic Claude API |
| Realtime | AppSync Subscriptions |
| Payments | Stripe |

---

## Data Models

```
User
 └── Recording (many)
       ├── Transcription (one)
       └── Feedback (one)

Dialogue
 └── Recording (many)
```

### Key Design Decisions

- **Single combined Transcription** per recording — bilingual segments (en-US + ne-NP) stored with timestamps, language tags, and confidence scores. Returned to the user as a readable record of their attempt.
- **Three separate Lambda functions** — each processing step is independently deployable and fails independently. Transcribe completion handled via EventBridge, not polling.
- **AppSync subscriptions** for real-time pipeline status — frontend updates automatically when Recording status changes from `PROCESSING` → `COMPLETED`.
- **DynamoDB over RDS** — all access patterns are single-owner key-value lookups. No shared mutable state between users.

---

## Project Structure

```
cclsaathi/
├── amplify/
│   ├── auth/
│   │   └── resource.ts
│   ├── data/
│   │   └── resource.ts          # DynamoDB schema
│   ├── storage/
│   │   └── resource.ts          # S3 bucket config
│   ├── functions/
│   │   ├── processRecording/
│   │   │   └── handler.ts       # S3 trigger → Transcribe
│   │   ├── processTranscription/
│   │   │   └── handler.ts       # EventBridge → save transcript
│   │   └── processScoring/
│   │       └── handler.ts       # Claude API → save feedback
│   └── backend.ts
├── app/                         # Next.js App Router
│   ├── (public)/
│   │   ├── page.tsx             # Landing (SSG)
│   │   └── pricing/
│   │       └── page.tsx         # Pricing (SSG)
│   └── (protected)/
│       ├── dashboard/
│       ├── practice/
│       └── results/
├── components/
├── lib/
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- AWS account
- Anthropic API key
- Stripe account

### Installation

```bash
git clone https://github.com/saugat-15/cclsaathi.git
cd cclsaathi
npm install
```

### Configure Amplify

```bash
npm install -g @aws-amplify/cli
amplify configure
amplify init
amplify push
```

### Environment Variables

```bash
cp .env.example .env.local
```

```env
ANTHROPIC_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

### Run Locally

```bash
npm run dev
```

---

## Roadmap

- [x] Architecture design
- [x] DynamoDB schema
- [ ] Amplify Functions — processing pipeline
- [ ] AWS Transcribe integration (en-US + ne-NP)
- [ ] Claude API scoring
- [ ] Stripe subscription integration
- [ ] Next.js frontend
- [ ] 4 official NAATI Nepali dialogues (launch content)
- [ ] Original dialogue library (50+ dialogues)
- [ ] Expand to additional CCL languages

---

## Why This Exists

This project was built by a Nepali migrant in Australia who couldn't find a single platform that genuinely served the Nepali CCL community. The big platforms list Nepali as a supported language — but the content is thin, generic, and clearly an afterthought.

CCLSaathi is built Nepali-first, with native-quality content, natural register, and culturally relevant scenarios. The same approach will be applied to every underserved language community that follows.

---

## License

MIT

---

*Not affiliated with NAATI Pty Ltd.*
