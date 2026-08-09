/**
 * NAATI Dialogue Segmentation Script
 *
 * What this does:
 * 1. Extracts text from each PDF using pdf-parse
 * 2. Sends extracted text to GPT-4o to get structured segments
 * 3. Repairs U+FFFD gaps in Devanagari (PDF font/ToUnicode loss) via a second GPT-4o pass
 * 4. Runs Whisper once (language en) on each MP3 for segment timestamps only
 * 5. Finds speech boundaries via ffmpeg silencedetect; merges chime+interpretation-window silence
 *    pairs into composite boundaries so cuts land at the chime; trims intro; Whisper for intro
 *    alignment + fallback if silence regions are too few
 * 6. Cuts MP3 into individual segment files using ffmpeg
 * 7. Uploads segments + reference JSON to S3
 *
 * Setup:
 *   npm install openai @aws-sdk/client-s3 pdf-parse
 *
 * Usage:
 *   OPENAI_API_KEY=xxx \
 *   S3_BUCKET=your-bucket \
 *   DIALOGUES_DIR=/path/to/materials \
 *   OUTPUT_DIR=./output \
 *   SKIP_IF_EXISTS=1 \
 *   AWS_REGION=ap-southeast-2 \
 *   AWS_PROFILE=saugat-dev \
 *   node segmentDialogues.mjs
 *
 * DIALOGUE_ID: optional. When set (e.g. employment), only that dialogue is processed — use while fixing segmentation.
 *
 * SILENCE_NOISE_DB: ffmpeg silencedetect noise (default -30). Lower if chimes stay in “speech” and pollute clips.
 * SILENCE_MIN_DURATION: minimum silence length in seconds (default 1.5). NAATI CCL in-speech pauses are
 *   0.5–1.3s; chime/window gaps are ≥ 2.6s. 1.5s skips pauses and catches only real boundaries.
 * SILENCE_SEGMENTATION: set to "0" or "false" to use Whisper timestamps only (no silencedetect merge).
 *
 * SKIP_IF_EXISTS: when set, if reference.json and at least one segment .mp3 exist under
 * OUTPUT_DIR/<dialogue id>/<dialogue name>/, skips PDF/GPT/Whisper/ffmpeg and still uploads to S3.
 *   If that reference.json still has U+FFFD in Devanagari, the repair pass still runs before upload.
 *
 * SKIP_DEVANAGARI_REPAIR: set to "1" or "true" to skip the U+FFFD repair pass.
 *
 * macOS: if you see EPERM / "Operation not permitted" under ~/Downloads, the app running node (Terminal,
 * Cursor, etc.) needs Files and Folders or Full Disk Access, or set DIALOGUES_DIR to a path outside Downloads.
 */

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import OpenAI from "openai";

// ─── Config ───────────────────────────────────────────────
const DIALOGUES_DIR =
  process.env.DIALOGUES_DIR ??
  "/Users/saugat/Desktop/dev/Nepali-CCL-Practice-Materials";
const OUTPUT_DIR = process.env.OUTPUT_DIR ?? path.join(process.cwd(), "output");
const SKIP_IF_EXISTS =
  process.env.SKIP_IF_EXISTS === "1" || process.env.SKIP_IF_EXISTS === "true";
const SKIP_DEVANAGARI_REPAIR =
  process.env.SKIP_DEVANAGARI_REPAIR === "1" ||
  process.env.SKIP_DEVANAGARI_REPAIR === "true";
const S3_BUCKET = process.env.S3_BUCKET;
const AWS_REGION = process.env.AWS_REGION ?? "ap-southeast-2";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const FALLBACK_SEGMENT_SECONDS = 8;
const MIN_SEGMENT_SECONDS = 0.5;

const SILENCE_SEGMENTATION_ENABLED = !/^0|false$/i.test(
  process.env.SILENCE_SEGMENTATION ?? "1",
);

const envNumOr = (raw, fallback) => {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

/** ffmpeg silencedetect=noise=…dB */
const SILENCE_DETECT_NOISE_DB = envNumOr(process.env.SILENCE_NOISE_DB, -30);
/**
 * Minimum silence length (seconds) for ffmpeg silencedetect to report.
 * NAATI CCL pattern:
 *   - in-speech pauses: 0.5–1.3s  ← must NOT be detected as boundaries
 *   - chime / interpretation silences: ≥ 2.6s  ← must be detected
 * 1.5s sits cleanly between them.
 */
const SILENCE_DETECT_MIN_SEC = envNumOr(process.env.SILENCE_MIN_DURATION, 1.5);
/**
 * Max gap (seconds) between two detected silences to merge them into one composite boundary.
 * NAATI CCL: each segment boundary = chime silence (~3s) + interpretation window silence (~3s),
 * separated by only ~0.5–2s. Merging them ensures the speech region = exactly one segment.
 */
const SILENCE_MERGE_GAP_SEC = envNumOr(process.env.SILENCE_MERGE_GAP, 2.5);

/** When set, only process this dialogue id (e.g. employment). Matches `id` in DIALOGUES. */
const DIALOGUE_ID_FILTER = process.env.DIALOGUE_ID?.trim();

if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");
if (!S3_BUCKET) throw new Error("S3_BUCKET is required");

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const s3 = new S3Client({ region: AWS_REGION });

// ─── Dialogues to process ─────────────────────────────────
const DIALOGUES = [
  { id: "education", name: "Nepali - Education" },
  { id: "employment", name: "Nepali - Employment" },
  { id: "financial-1", name: "Nepali - Financial 1" },
  { id: "financial-2", name: "Nepali - Financial 2" },
  { id: "health", name: "Nepali - Health" },
  { id: "housing", name: "Nepali - Housing" },
  { id: "legal", name: "Nepali - Legal" },
  { id: "social-services", name: "Nepali - Social Services" },
];

const MACOS_FS_PERMISSION_HINT = `macOS blocked reading that path (EPERM). Typical fixes:
  • System Settings → Privacy & Security → Files and Folders: enable Downloads (or Documents) for the app running node (Terminal, iTerm, Cursor, etc.).
  • Or Privacy & Security → Full Disk Access: add that same app (or /usr/local/bin/node if you run node directly).
  • Or copy materials out of ~/Downloads and point DIALOGUES_DIR there (e.g. a folder under your project).`;

const isFilesystemPermissionDenied = (err) => {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? err.code : undefined;
  if (code === "EPERM" || code === "EACCES") return true;
  const msg =
    "message" in err && typeof err.message === "string" ? err.message : "";
  return msg.toLowerCase().includes("operation not permitted");
};

const withFilesystemPermissionHint = (err, summary) => {
  if (!isFilesystemPermissionDenied(err)) return summary;
  return `${summary}\n\n${MACOS_FS_PERMISSION_HINT}`;
};

/** Safe folder name under output/<id>/ — mirrors DIALOGUES_DIR PDF names (e.g. Nepali - Education). */
const dialogueOutputDirName = (dialogue) =>
  dialogue.name.replace(/[/\\?*:|"<>]/g, "-").trim() || dialogue.id;

/**
 * Fail fast with a clear message when macOS TCC denies reads (common for ~/Downloads).
 */
const assertCanReadDialoguesMaterials = (dialoguesToCheck) => {
  if (!fs.existsSync(DIALOGUES_DIR)) {
    throw new Error(`DIALOGUES_DIR does not exist: ${DIALOGUES_DIR}`);
  }

  if (dialoguesToCheck.length === 0) {
    throw new Error("No dialogues to check (empty list)");
  }

  const samplePdf = path.join(DIALOGUES_DIR, `${dialoguesToCheck[0].name}.pdf`);
  if (!fs.existsSync(samplePdf)) {
    console.warn(
      `  ⚠️  No sample PDF at ${path.basename(
        samplePdf,
      )} — skipping folder read check`,
    );
    return;
  }

  let fd;
  try {
    fd = fs.openSync(samplePdf, fs.constants.O_RDONLY);
  } catch (err) {
    throw new Error(
      withFilesystemPermissionHint(
        err,
        `Cannot open sample PDF (check DIALOGUES_DIR and permissions):\n${samplePdf}\n${
          err instanceof Error ? err.message : String(err)
        }`,
      ),
    );
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
};

const getAudioDurationSeconds = (audioPath) => {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      audioPath,
    ],
    { encoding: "utf-8" },
  );

  if (result.error || result.status !== 0) {
    const detail =
      (result.stderr && result.stderr.trim()) ||
      (result.error && result.error.message) ||
      "non-zero exit";
    console.warn(`  ⚠️  ffprobe failed — duration unknown (${detail})`);
    if (/operation not permitted/i.test(detail)) {
      console.warn(MACOS_FS_PERMISSION_HINT.replace(/^/gm, "     "));
    }
    return null;
  }

  const parsed = Number.parseFloat(String(result.stdout).trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const validatePdfExtraction = (data) => {
  if (data === null || typeof data !== "object") {
    throw new Error("GPT-4o returned non-object JSON");
  }

  const { segments } = data;
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error("GPT-4o JSON must include a non-empty segments array");
  }

  const byIndex = [...segments].sort((a, b) => a.segmentIndex - b.segmentIndex);
  const seen = new Set();

  for (const seg of byIndex) {
    if (typeof seg.segmentIndex !== "number") {
      throw new Error(
        `Invalid segment: segmentIndex must be a number (got ${JSON.stringify(
          seg,
        ).slice(0, 160)})`,
      );
    }
    if (seen.has(seg.segmentIndex)) {
      throw new Error(
        `Duplicate segmentIndex ${seg.segmentIndex} in GPT output`,
      );
    }
    seen.add(seg.segmentIndex);

    if (seg.speaker !== "EN" && seg.speaker !== "NE") {
      throw new Error(
        `Segment ${seg.segmentIndex}: speaker must be "EN" or "NE"`,
      );
    }
  }

  return { ...data, segments: byIndex };
};

/** PDF text extract often yields U+FFFD where Devanagari conjuncts failed ToUnicode mapping. */
const REPLACEMENT_CHAR = "\uFFFD";

const stringHasReplacementChar = (value) =>
  typeof value === "string" && value.includes(REPLACEMENT_CHAR);

const segmentHasDevanagariCorruption = (seg) =>
  stringHasReplacementChar(seg?.original) ||
  stringHasReplacementChar(seg?.translation) ||
  stringHasReplacementChar(seg?.expectedInterpretation);

const countReplacementCharsInSegments = (segments) => {
  let n = 0;
  for (const seg of segments) {
    for (const key of ["original", "translation", "expectedInterpretation"]) {
      const value = seg?.[key];
      if (typeof value === "string") {
        for (const ch of value) {
          if (ch === REPLACEMENT_CHAR) n += 1;
        }
      }
    }
  }
  return n;
};

/**
 * Second GPT pass: replace U+FFFD only, using bilingual context.
 * Repairs one dirty segment at a time so the model cannot skip later turns.
 * Returns a new segments array when anything changed; otherwise the same reference.
 */
const repairSingleSegmentDevanagari = async (seg, meta = {}) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You repair one NAATI CCL dialogue segment where PDF extraction replaced some Devanagari glyphs with U+FFFD.
Return one JSON object only (no markdown).
Rules:
- Fix every U+FFFD in original / translation / expectedInterpretation.
- Leave clean English and already-correct Nepali unchanged.
- Replace each U+FFFD with the correct Devanagari character(s); do not paraphrase.
- Use the English meaning to reconstruct missing Nepali.
- Prefer standard Nepali CCL register.
- The returned strings must contain zero U+FFFD characters.`,
      },
      {
        role: "user",
        content: `Repair this segment. Return JSON:
{
  "segmentIndex": ${seg.segmentIndex},
  "original": string,
  "translation": string or null,
  "expectedInterpretation": string
}

Domain: ${meta.domain ?? "unknown"}
Scenario: ${meta.scenario ?? "unknown"}
Segment:
${JSON.stringify(
  {
    segmentIndex: seg.segmentIndex,
    speaker: seg.speaker,
    original: seg.original,
    translation: seg.translation ?? null,
    expectedInterpretation: seg.expectedInterpretation,
  },
  null,
  2,
)}`,
      },
    ],
    max_completion_tokens: 2_048,
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "";
  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    console.error(
      `  ❌ Repair JSON.parse failed for segment ${seg.segmentIndex}:`,
    );
    console.error(raw.slice(0, 600));
    return null;
  }

  return {
    original:
      typeof parsed.original === "string" ? parsed.original : seg.original,
    translation:
      parsed.translation === null || typeof parsed.translation === "string"
        ? parsed.translation
        : seg.translation,
    expectedInterpretation:
      typeof parsed.expectedInterpretation === "string"
        ? parsed.expectedInterpretation
        : seg.expectedInterpretation,
  };
};

const repairDevanagariCorruption = async (segments, meta = {}) => {
  if (SKIP_DEVANAGARI_REPAIR) {
    console.log("  ⏭  Devanagari repair skipped (SKIP_DEVANAGARI_REPAIR)");
    return segments;
  }

  const dirtyIndexes = segments
    .filter(segmentHasDevanagariCorruption)
    .map((s) => s.segmentIndex);
  if (dirtyIndexes.length === 0) {
    console.log("  ✅ No U+FFFD corruption in Devanagari fields");
    return segments;
  }

  const beforeCount = countReplacementCharsInSegments(segments);
  console.log(
    `  🔧 Repairing Devanagari U+FFFD in ${dirtyIndexes.length}/${segments.length} segment(s) (${beforeCount} replacement char(s), one at a time)…`,
  );

  let changed = false;
  const merged = [...segments];

  for (const index of dirtyIndexes) {
    const i = merged.findIndex((s) => s.segmentIndex === index);
    if (i < 0) continue;
    const seg = merged[i];
    const before = countReplacementCharsInSegments([seg]);

    let repaired = await repairSingleSegmentDevanagari(seg, meta);
    if (!repaired) {
      console.warn(`  ⚠️  Segment ${index}: repair failed — left unchanged`);
      continue;
    }

    // One retry if model still left U+FFFD
    if (segmentHasDevanagariCorruption(repaired)) {
      console.warn(
        `  ⚠️  Segment ${index}: still had U+FFFD after first pass — retrying…`,
      );
      repaired =
        (await repairSingleSegmentDevanagari(
          { ...seg, ...repaired },
          meta,
        )) ?? repaired;
    }

    const next = { ...seg, ...repaired };
    const after = countReplacementCharsInSegments([next]);
    if (after > 0) {
      console.warn(
        `  ⚠️  Segment ${index}: ${after} U+FFFD remain (${before} → ${after})`,
      );
    } else {
      console.log(`  ✅ Segment ${index}: cleared U+FFFD (${before} → 0)`);
    }
    merged[i] = next;
    changed = true;
  }

  if (!changed) return segments;

  const afterCount = countReplacementCharsInSegments(merged);
  const stillDirty = merged.filter(segmentHasDevanagariCorruption).length;
  if (afterCount > 0) {
    console.warn(
      `  ⚠️  Repair left ${afterCount} U+FFFD in ${stillDirty} segment(s) — review manually`,
    );
  } else {
    console.log(
      `  ✅ Devanagari repair cleared all U+FFFD (${beforeCount} → 0)`,
    );
  }

  return merged;
};

// ─── Step 1: Extract segments from PDF ────────────────────
const extractSegmentsFromPdf = async (pdfPath) => {
  console.log(`  📄 Extracting text from PDF: ${path.basename(pdfPath)}`);

  const pdfBuffer = fs.readFileSync(pdfPath);
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: pdfBuffer });
  let pdfText;
  try {
    const textResult = await parser.getText();
    pdfText = textResult.text;
  } finally {
    await parser.destroy();
  }

  console.log(
    `  📝 ${pdfText.length} characters extracted — sending to GPT-4o`,
  );

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a data extraction assistant specialising in NAATI CCL bilingual dialogue transcripts.
Return one JSON object only (no markdown, no code fences, no commentary).
Preserve Devanagari exactly as in the source. Escape characters in JSON strings as required (e.g. quotes, backslashes, control characters).`,
      },
      {
        role: "user",
        content: `Extract all numbered dialogue rows from this NAATI CCL English-Nepali transcript into JSON with this shape:
- domain: string (e.g. Employment)
- scenario: string, one sentence
- segments: array ordered by segmentIndex ascending. Each item:
  - segmentIndex: number
  - speaker: "EN" or "NE"
  - original: string (EN line or Nepali Devanagari line from PDF)
  - translation: string or null (null for EN; for NE, English gloss from PDF if present)
  - expectedInterpretation: string (for EN: Nepali interpretation; for NE: English interpretation)
  - keyTerms: array of 3-6 strings
  - wordCount: number (approx.)

Rules:
- speaker "EN" / "NE" as above
- keyTerms: domain terms a NAATI marker would expect
- Include every numbered segment; omit unnumbered intro/scenario text
- Do not duplicate keys or repeat the same object inside segments

PDF transcript:
${pdfText}`,
      },
    ],
    max_completion_tokens: 16_384,
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const choice = response.choices[0];
  const raw = choice?.message?.content ?? "";
  if (choice?.finish_reason === "length") {
    console.warn(
      "  ⚠️  GPT stopped at output limit — raise max_completion_tokens or shorten PDF text",
    );
  }

  const clean = raw.replace(/```json|```/g, "").trim();

  try {
    return validatePdfExtraction(JSON.parse(clean));
  } catch (parseErr) {
    if (parseErr instanceof SyntaxError) {
      console.error("  ❌ GPT response JSON.parse failed:");
      console.error(clean.slice(0, 1200));
      throw new Error(
        "GPT did not return valid JSON (try again; API may have truncated)",
      );
    }
    throw parseErr;
  }
};

// ─── Step 2: Get timestamps from Whisper ──────────────────
const transcribeWithWhisper = async (mp3Path, language) => {
  console.log(`  🎙  Whisper (${language}): ${path.basename(mp3Path)}`);

  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(mp3Path),
    model: "whisper-1",
    language,
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  return response.segments ?? [];
};

/** NAATI intros end with this line; Whisper may drop or alter punctuation. */
const INTRO_END_SUBSTRING = "the dialogue begins now";

const normalizeTranscriptPiece = (s) =>
  s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Returns how many leading Whisper segments belong to the intro (to skip).
 * PDF segment 1 maps to Whisper segment at this index. If the phrase is missing, returns 0.
 */
const countWhisperIntroSegmentsToSkip = (whisperSegments) => {
  const pieces = whisperSegments.map((s) => {
    const t =
      s != null &&
      typeof s === "object" &&
      "text" in s &&
      typeof s.text === "string"
        ? s.text
        : "";
    return t.trim();
  });

  const normParts = pieces.map((p) => normalizeTranscriptPiece(p));
  const norm = normParts.join(" ");
  const idx = norm.indexOf(INTRO_END_SUBSTRING);
  if (idx === -1) {
    return 0;
  }

  const matchEndExclusive = idx + INTRO_END_SUBSTRING.length;
  let pos = 0;
  for (let i = 0; i < normParts.length; i++) {
    if (i > 0) {
      pos += 1;
    }
    pos += normParts[i].length;
    if (matchEndExclusive <= pos) {
      return i + 1;
    }
  }

  return 0;
};

// ─── Silence / chime boundaries (ffmpeg silencedetect) ────

/** @typedef {{ start: number; end: number; duration: number }} SilenceInterval */
/** @typedef {{ start: number; end: number }} SpeechRegion */

const parseSilenceDetectStderr = (stderr) => {
  /** @type {SilenceInterval[]} */
  const silences = [];
  let pendingStart = null;

  for (const line of stderr.split(/\r?\n/)) {
    const startM = line.match(/silence_start:\s*([\d.]+)/);
    if (startM) {
      pendingStart = Number(startM[1]);
      continue;
    }
    const endM = line.match(
      /silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/,
    );
    if (endM && pendingStart != null) {
      const end = Number(endM[1]);
      const duration = Number(endM[2]);
      if (
        Number.isFinite(pendingStart) &&
        Number.isFinite(end) &&
        end > pendingStart
      ) {
        silences.push({ start: pendingStart, end, duration });
      }
      pendingStart = null;
    }
  }

  return silences;
};

const detectSilencesWithFfmpeg = (mp3Path, noiseDb, minDurationSec) => {
  const noiseArg = `${noiseDb}dB`;
  const filter = `silencedetect=noise=${noiseArg}:duration=${minDurationSec}`;

  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-i",
      mp3Path,
      "-af",
      filter,
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 },
  );

  if (result.error) {
    throw result.error;
  }

  return parseSilenceDetectStderr(result.stderr ?? "");
};

/**
 * Merge consecutive silence intervals that are separated by a gap ≤ maxGapSec.
 * NAATI CCL segment boundaries consist of a chime silence followed immediately by an
 * interpretation-window silence; the small audio between them (0.5–2s) should be absorbed
 * into the boundary, not treated as a new speech burst.
 */
const mergeNearbySilenceIntervals = (silences, maxGapSec) => {
  if (silences.length === 0) return [];

  const sorted = [...silences].sort((a, b) => a.start - b.start);
  /** @type {SilenceInterval[]} */
  const merged = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = sorted[i];
    const gap = cur.start - prev.end;
    if (gap <= maxGapSec) {
      prev.end = cur.end;
      prev.duration = prev.end - prev.start;
    } else {
      merged.push({ ...cur });
    }
  }

  return merged;
};

/**
 * Speech lives between silences; chime + quiet padding usually falls in silence intervals.
 */
const speechRegionsFromSilences = (silences, audioDurationSeconds) => {
  if (silences.length === 0) {
    return [];
  }

  const sorted = [...silences].sort((a, b) => a.start - b.start);
  /** @type {SpeechRegion[]} */
  const regions = [];

  if (sorted[0].start > 0.001) {
    regions.push({ start: 0, end: sorted[0].start });
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i].end;
    const end = sorted[i + 1].start;
    if (end > start + 1e-3) {
      regions.push({ start, end });
    }
  }

  const tailStart = sorted[sorted.length - 1].end;
  const fileEnd =
    audioDurationSeconds != null &&
    Number.isFinite(audioDurationSeconds) &&
    audioDurationSeconds > tailStart
      ? audioDurationSeconds
      : null;

  if (fileEnd != null && fileEnd > tailStart + 1e-3) {
    regions.push({ start: tailStart, end: fileEnd });
  }

  return regions;
};

const trimSpeechRegionsFromDialogueStart = (regions, dialogueStartSec) => {
  /** @type {SpeechRegion[]} */
  const out = [];
  for (const r of regions) {
    if (r.end <= dialogueStartSec) {
      continue;
    }
    const start = Math.max(r.start, dialogueStartSec);
    if (r.end > start + 1e-3) {
      out.push({ start, end: r.end });
    }
  }
  return out;
};

/** Repeatedly merge the pair separated by the shortest gap until only `targetCount` regions remain. */
const mergeAdjacentSpeechRegionsByShortestGapUntilCount = (
  regions,
  targetCount,
) => {
  /** @type {SpeechRegion[]} */
  const r = regions.map((x) => ({ start: x.start, end: x.end }));

  while (r.length > targetCount) {
    if (r.length < 2) {
      break;
    }
    let bestIdx = 0;
    let bestGap = Infinity;
    for (let i = 0; i < r.length - 1; i++) {
      const gap = r[i + 1].start - r[i].end;
      if (gap < bestGap) {
        bestGap = gap;
        bestIdx = i;
      }
    }
    const merged = { start: r[bestIdx].start, end: r[bestIdx + 1].end };
    r.splice(bestIdx, 2, merged);
  }

  return r;
};

const clampSegmentEndToDuration = (end, audioDurationSeconds) => {
  if (audioDurationSeconds == null || !Number.isFinite(audioDurationSeconds)) {
    return end;
  }
  return Math.min(end, audioDurationSeconds);
};

// ─── Step 3: Map PDF segments to Whisper timestamps ───────
/**
 * One Whisper run produces a single chronological timeline for the whole file.
 * The dialogue alternates EN/NE in PDF order, so PDF segment i maps to Whisper segment i.
 * Transcript wording for Nepali turns may be wrong in `language: en` mode; only timestamps matter.
 */
const mapSegmentsToTimestamps = (
  pdfSegments,
  whisperSegments,
  audioDurationSeconds,
) => {
  console.log(
    `  🗺  Mapping ${pdfSegments.length} PDF segments → ${whisperSegments.length} Whisper segments (sequential)`,
  );

  if (whisperSegments.length < pdfSegments.length) {
    console.warn(
      `  ⚠️  Whisper has fewer segments than PDF (${whisperSegments.length} < ${pdfSegments.length}) — estimating missing`,
    );
  } else if (whisperSegments.length > pdfSegments.length) {
    console.warn(
      `  ⚠️  Whisper has more segments than PDF (${whisperSegments.length} > ${pdfSegments.length}) — extra slots ignored`,
    );
  }

  const mapped = [];

  for (let i = 0; i < pdfSegments.length; i++) {
    const seg = pdfSegments[i];
    const ts = whisperSegments[i];

    if (
      ts != null &&
      typeof ts.start === "number" &&
      typeof ts.end === "number" &&
      ts.end > ts.start
    ) {
      mapped.push({
        ...seg,
        startTime: ts.start,
        endTime: ts.end,
      });
    } else {
      console.warn(
        `  ⚠️  No timestamp for segment ${seg.segmentIndex} — estimating`,
      );
      const prev = mapped[mapped.length - 1];
      const startTime = prev ? prev.endTime : 0;
      let endTime = startTime + FALLBACK_SEGMENT_SECONDS;

      if (audioDurationSeconds != null) {
        endTime = Math.min(endTime, audioDurationSeconds);
      }
      if (endTime <= startTime) {
        endTime =
          audioDurationSeconds != null
            ? Math.min(startTime + MIN_SEGMENT_SECONDS, audioDurationSeconds)
            : startTime + MIN_SEGMENT_SECONDS;
      }
      if (endTime <= startTime) {
        throw new Error(
          `Cannot estimate times for segment ${seg.segmentIndex}: audio duration (${audioDurationSeconds}) is before estimated start (${startTime})`,
        );
      }

      mapped.push({
        ...seg,
        startTime,
        endTime,
      });
    }
  }

  return mapped;
};

const buildMappedTimestamps = (
  pdfSegments,
  mp3Path,
  dialogueWhisperSegments,
  audioDurationSeconds,
  dialogueStartSec,
) => {
  if (!SILENCE_SEGMENTATION_ENABLED) {
    return mapSegmentsToTimestamps(
      pdfSegments,
      dialogueWhisperSegments,
      audioDurationSeconds,
    );
  }

  console.log(
    `  🔇 silencedetect: noise=${SILENCE_DETECT_NOISE_DB}dB, min silence=${SILENCE_DETECT_MIN_SEC}s`,
  );

  const silences = detectSilencesWithFfmpeg(
    mp3Path,
    SILENCE_DETECT_NOISE_DB,
    SILENCE_DETECT_MIN_SEC,
  );
  console.log(`  ✅ Parsed ${silences.length} silence intervals from ffmpeg`);

  // Merge pairs of silences that are ≤ SILENCE_MERGE_GAP_SEC apart.
  // Each NAATI CCL boundary = chime silence + interpretation-window silence, ~0.5–2s apart.
  // After merging, each composite gap = one true segment boundary.
  const compositeSilences = mergeNearbySilenceIntervals(
    silences,
    SILENCE_MERGE_GAP_SEC,
  );
  console.log(
    `  🔕 Merged into ${compositeSilences.length} composite boundaries (gap ≤ ${SILENCE_MERGE_GAP_SEC}s merges chime + interpretation window)`,
  );

  const rawRegions = speechRegionsFromSilences(
    compositeSilences,
    audioDurationSeconds,
  );
  const trimmed = trimSpeechRegionsFromDialogueStart(
    rawRegions,
    dialogueStartSec,
  );

  console.log(
    `  🗣  ${trimmed.length} speech regions after trimming intro (need ${pdfSegments.length})`,
  );

  if (trimmed.length < pdfSegments.length) {
    console.warn(
      `  ⚠️  Speech regions after intro (${trimmed.length}) < PDF (${pdfSegments.length}) — using Whisper timestamps`,
    );
    return mapSegmentsToTimestamps(
      pdfSegments,
      dialogueWhisperSegments,
      audioDurationSeconds,
    );
  }

  // When there is exactly one extra region it is almost always a short outro narration
  // that follows the last chime (e.g. "End of dialogue" or trailing silence).
  // Drop it before resorting to a shortest-gap merge, which would otherwise incorrectly
  // merge two real dialogue segments whose composite silence happened to be marginally smaller.
  let candidates = trimmed;
  if (candidates.length === pdfSegments.length + 1) {
    const outro = candidates[candidates.length - 1];
    console.log(
      `  📋 One extra speech region at end (${outro.start.toFixed(
        2,
      )}s–${outro.end.toFixed(2)}s, ${(outro.end - outro.start).toFixed(
        2,
      )}s) — treating as outro, dropping`,
    );
    candidates = candidates.slice(0, -1);
  }

  // Final safety net: if still too many, merge by shortest gap.
  const merged = mergeAdjacentSpeechRegionsByShortestGapUntilCount(
    candidates,
    pdfSegments.length,
  );

  if (merged.length !== candidates.length) {
    console.warn(
      `  🔀 Merged ${candidates.length} → ${merged.length} regions via shortest-gap fallback — verify output`,
    );
  }

  console.log(`  🔔 Cuts from silence/chime gaps: ${merged.length} segments`);

  return pdfSegments.map((seg, i) => {
    const box = merged[i];
    if (box == null) {
      throw new Error(`Missing speech region for segment ${seg.segmentIndex}`);
    }
    const start = box.start;
    let end = clampSegmentEndToDuration(box.end, audioDurationSeconds);
    if (!(end > start + 1e-6)) {
      end = start + MIN_SEGMENT_SECONDS;
      if (audioDurationSeconds != null) {
        end = Math.min(end, audioDurationSeconds);
      }
    }
    if (!(end > start)) {
      throw new Error(
        `Invalid silence-based window for segment ${seg.segmentIndex}: ${start} → ${end}`,
      );
    }
    return { ...seg, startTime: start, endTime: end };
  });
};

// ─── Step 4: Cut MP3 into segments using ffmpeg ───────────
const cutSegment = (inputPath, outputPath, startTime, endTime) => {
  const duration = endTime - startTime;
  if (!(duration > 0)) {
    throw new Error(
      `Invalid segment duration ${duration} (${startTime} → ${endTime})`,
    );
  }

  const result = spawnSync(
    "ffmpeg",
    [
      "-loglevel",
      "error",
      "-y",
      "-i",
      inputPath,
      "-ss",
      String(startTime),
      "-t",
      String(duration),
      "-c",
      "copy",
      outputPath,
    ],
    { encoding: "utf-8" },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const msg = result.stderr?.trim() || "unknown error";
    throw new Error(`ffmpeg failed (exit ${result.status}): ${msg}`);
  }
};

// ─── Step 5: Upload to S3 ─────────────────────────────────
const uploadToS3 = async (filePath, s3Key, contentType) => {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: fs.readFileSync(filePath),
      ContentType: contentType,
    }),
  );
};

const dirHasMp3Segments = (segmentsDir) => {
  if (!fs.existsSync(segmentsDir)) return false;
  return fs.readdirSync(segmentsDir).some((f) => f.endsWith(".mp3"));
};

const uploadDialogueToS3 = async (
  dialogue,
  referenceJson,
  mp3Path,
  segmentsOut,
  referenceJsonPath,
) => {
  console.log(`  ☁️  Uploading to S3...`);

  await uploadToS3(mp3Path, `dialogues/${dialogue.id}/full.mp3`, "audio/mpeg");

  for (const seg of referenceJson.segments) {
    const segPath = path.join(segmentsOut, `segment-${seg.segmentIndex}.mp3`);
    if (!fs.existsSync(segPath)) {
      throw new Error(`Missing segment file for upload: ${segPath}`);
    }
    await uploadToS3(
      segPath,
      `dialogues/${dialogue.id}/segments/segment-${seg.segmentIndex}.mp3`,
      "audio/mpeg",
    );
  }

  await uploadToS3(
    referenceJsonPath,
    `dialogues/${dialogue.id}/reference.json`,
    "application/json",
  );

  console.log(`  ✅ Uploaded → s3://${S3_BUCKET}/dialogues/${dialogue.id}/`);
};

// ─── Main: Process one dialogue ───────────────────────────
const processDialogue = async (dialogue) => {
  console.log(`\n🎬 Processing: ${dialogue.name}`);

  const pdfPath = path.join(DIALOGUES_DIR, `${dialogue.name}.pdf`);
  const mp3Path = path.join(DIALOGUES_DIR, `${dialogue.name}.mp3`);
  const dialogueOut = path.join(
    OUTPUT_DIR,
    dialogue.id,
    dialogueOutputDirName(dialogue),
  );
  const segmentsOut = path.join(dialogueOut, "segments");
  const referenceJsonPath = path.join(dialogueOut, "reference.json");

  const canResumeFromLocal =
    SKIP_IF_EXISTS &&
    fs.existsSync(referenceJsonPath) &&
    dirHasMp3Segments(segmentsOut);

  if (canResumeFromLocal) {
    if (!fs.existsSync(mp3Path)) {
      throw new Error(`MP3 not found (needed for S3 upload): ${mp3Path}`);
    }
    console.log(
      `  ⏭  Local reference + segment audio present — skipping PDF/GPT/Whisper/ffmpeg; running S3 upload`,
    );
    let referenceJson;
    try {
      referenceJson = JSON.parse(fs.readFileSync(referenceJsonPath, "utf-8"));
    } catch {
      throw new Error(`Could not parse reference.json: ${referenceJsonPath}`);
    }
    if (
      !Array.isArray(referenceJson.segments) ||
      referenceJson.segments.length === 0
    ) {
      throw new Error(
        `reference.json has no segments (delete output and re-run, or fix file): ${referenceJsonPath}`,
      );
    }

    const repairedSegments = await repairDevanagariCorruption(
      referenceJson.segments,
      { domain: referenceJson.domain, scenario: referenceJson.scenario },
    );
    if (repairedSegments !== referenceJson.segments) {
      referenceJson = { ...referenceJson, segments: repairedSegments };
      fs.writeFileSync(
        referenceJsonPath,
        JSON.stringify(referenceJson, null, 2),
      );
    }

    await uploadDialogueToS3(
      dialogue,
      referenceJson,
      mp3Path,
      segmentsOut,
      referenceJsonPath,
    );
    return referenceJson;
  }

  if (!fs.existsSync(pdfPath)) throw new Error(`PDF not found: ${pdfPath}`);
  if (!fs.existsSync(mp3Path)) throw new Error(`MP3 not found: ${mp3Path}`);

  const audioDurationSeconds = getAudioDurationSeconds(mp3Path);

  fs.mkdirSync(segmentsOut, { recursive: true });

  // 1. Extract segments from PDF via GPT-4o, then repair PDF U+FFFD in Devanagari
  const pdfData = await extractSegmentsFromPdf(pdfPath);
  console.log(`  ✅ ${pdfData.segments.length} segments extracted from PDF`);
  pdfData.segments = await repairDevanagariCorruption(pdfData.segments, {
    domain: pdfData.domain,
    scenario: pdfData.scenario,
  });

  // 2. Whisper once (en): one timeline; Nepali turns still get boundaries from segment order
  const whisperSegments = await transcribeWithWhisper(mp3Path, "en");
  console.log(`  ✅ Whisper: ${whisperSegments.length} segment timestamps`);

  const introSkip = countWhisperIntroSegmentsToSkip(whisperSegments);
  const dialogueWhisperSegments =
    introSkip > 0 ? whisperSegments.slice(introSkip) : whisperSegments;
  if (introSkip > 0) {
    console.log(
      `  📍 Skipped ${introSkip} Whisper intro segment(s) (after "${INTRO_END_SUBSTRING}")`,
    );
  } else {
    console.log(
      `  ⚠️  Intro phrase not found in Whisper text — mapping from first segment (no skip)`,
    );
  }

  const dialogueStartSec =
    dialogueWhisperSegments[0] != null &&
    typeof dialogueWhisperSegments[0].start === "number"
      ? dialogueWhisperSegments[0].start
      : 0;

  // 3. Timestamps: silence/chime gaps (ffmpeg) + PDF count, Whisper for intro + fallback
  const mapped = buildMappedTimestamps(
    pdfData.segments,
    mp3Path,
    dialogueWhisperSegments,
    audioDurationSeconds,
    dialogueStartSec,
  );

  // 4. Cut MP3 into individual segment files
  console.log(`  ✂️  Cutting ${mapped.length} segments...`);
  for (const seg of mapped) {
    const outPath = path.join(segmentsOut, `segment-${seg.segmentIndex}.mp3`);
    cutSegment(mp3Path, outPath, seg.startTime, seg.endTime);
  }
  console.log(`  ✅ All segments cut`);

  // 5. Build reference JSON
  const referenceJson = {
    dialogueId: dialogue.id,
    domain: pdfData.domain,
    scenario: pdfData.scenario,
    totalSegments: mapped.length,
    createdAt: new Date().toISOString(),
    segments: mapped.map((seg) => ({
      segmentIndex: seg.segmentIndex,
      speaker: seg.speaker,
      original: seg.original,
      translation: seg.translation,
      expectedInterpretation: seg.expectedInterpretation,
      keyTerms: seg.keyTerms,
      wordCount: seg.wordCount,
      startTime: seg.startTime,
      endTime: seg.endTime,
      audioKey: `dialogues/${dialogue.id}/segments/segment-${seg.segmentIndex}.mp3`,
    })),
  };

  fs.writeFileSync(referenceJsonPath, JSON.stringify(referenceJson, null, 2));

  await uploadDialogueToS3(
    dialogue,
    referenceJson,
    mp3Path,
    segmentsOut,
    referenceJsonPath,
  );

  return referenceJson;
};

// ─── Entry point ──────────────────────────────────────────
const main = async () => {
  console.log("🚀 NAATI Dialogue Segmentation Script");
  console.log(`📁 Source : ${DIALOGUES_DIR}`);
  console.log(`📂 Output : ${OUTPUT_DIR}`);
  console.log(`☁️  Bucket : ${S3_BUCKET}`);
  console.log(`🌏 Region : ${AWS_REGION}`);
  console.log(`AWS Profile : ${process.env.AWS_PROFILE || "default"}`);
  if (process.env.AWS_PROFILE && process.env.AWS_PROFILE !== "default") {
    console.log(
      `   (SDK will use profile "${process.env.AWS_PROFILE}" — it must have keys/SSO in ~/.aws)`,
    );
  }
  if (SKIP_IF_EXISTS) {
    console.log(
      `⏭  Skip if local artifacts exist: yes (skips PDF/GPT/Whisper/ffmpeg; still uploads to S3)\n`,
    );
  } else {
    console.log(`⏭  Skip if local artifacts exist: no\n`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const dialoguesToProcess = DIALOGUE_ID_FILTER
    ? DIALOGUES.filter((d) => d.id === DIALOGUE_ID_FILTER)
    : DIALOGUES;

  if (DIALOGUE_ID_FILTER && dialoguesToProcess.length === 0) {
    const known = DIALOGUES.map((d) => d.id).join(", ");
    console.error(
      `Unknown DIALOGUE_ID="${DIALOGUE_ID_FILTER}". Known ids: ${known}`,
    );
    process.exit(1);
  }

  if (DIALOGUE_ID_FILTER) {
    console.log(`🎯 Single dialogue mode: ${DIALOGUE_ID_FILTER}\n`);
  }

  try {
    assertCanReadDialoguesMaterials(dialoguesToProcess);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const results = [];

  for (const dialogue of dialoguesToProcess.slice(0, 1)) {
    try {
      const result = await processDialogue(dialogue);
      results.push({
        dialogue: dialogue.id,
        status: "success",
        segments: result.totalSegments,
      });
    } catch (err) {
      let message =
        err instanceof Error
          ? withFilesystemPermissionHint(err, err.message)
          : String(err);
      if (/credentials/i.test(message)) {
        message += `\n     Hint: AWS_PROFILE=${process.env.AWS_PROFILE || "(unset)"} — profile "saugat-dev" has no keys; use default (omit AWS_PROFILE) or aws configure --profile saugat-dev`;
      }
      console.error(`  ❌ Failed: ${dialogue.name} —`, message);
      results.push({
        dialogue: dialogue.id,
        status: "failed",
        error: message,
      });
    }
  }

  console.log("\n\n📊 Summary:");
  console.table(results);
  console.log("\n✅ Done");

  const hasFailure = results.some((r) => r.status === "failed");
  if (hasFailure) {
    process.exitCode = 1;
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
