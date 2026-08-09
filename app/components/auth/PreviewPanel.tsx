/* PreviewPanel is intentionally always dark — it's a decorative product showcase. */

const SCORE_BARS = [
  { label: "Accuracy",      score: 85, color: "#22c55e" },
  { label: "Fluency",       score: 78, color: "#22c55e" },
  { label: "Completeness",  score: 72, color: "#ca8a04" },
  { label: "Terminology",   score: 58, color: "#ef4444" },
];

const TAGS = [
  { label: "Strong opening",        color: "#22c55e", bg: "rgba(34,197,94,.15)" },
  { label: "Natural pacing",        color: "#94a3b8", bg: "rgba(148,163,184,.12)" },
  { label: "Missing 2 key phrases", color: "#f87171", bg: "rgba(248,113,113,.15)" },
  { label: "Medical terms weak",    color: "#f87171", bg: "rgba(248,113,113,.15)" },
];

const DIALOGUES = [
  { num: 1, title: "Medical Appointment",   desc: "Patient asks GP about prescription",  status: "Ready", statusColor: "#4ade80" },
  { num: 2, title: "Hospital Admission",    desc: "Emergency triage conversation",       status: "Ready", statusColor: "#4ade80" },
  { num: 3, title: "Pharmacy Consultation", desc: "Pharmacist explains dosage",          status: "New",   statusColor: "#94a3b8" },
];

const CIRCUMFERENCE = 2 * Math.PI * 26;

export default function PreviewPanel() {
  return (
    <div className="flex flex-col justify-center w-full overflow-y-auto px-10 py-12"
      style={{ backgroundColor: "#071b0f" }}>

      <p className="text-[11px] font-bold uppercase tracking-widest mb-6"
        style={{ color: "#4ade80" }}>
        What you get
      </p>

      {/* ── App preview card ── */}
      <div className="rounded-2xl p-5 mb-4 border"
        style={{ backgroundColor: "#0f3320", borderColor: "#1a5230" }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <span className="flex items-center gap-1.5 font-bold text-[15px]">
            {/* Mini logo mark */}
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none" aria-hidden>
              <rect width="32" height="32" rx="8" fill="#3a7d4e"/>
              <rect x="11" y="14" width="16" height="10" rx="2.5" fill="white" fillOpacity="0.38"/>
              <path d="M22 24 L25 28 L19 24Z" fill="white" fillOpacity="0.38"/>
              <rect x="5" y="7" width="16" height="10" rx="2.5" fill="white"/>
              <path d="M9 17 L6 21 L13 17Z" fill="white"/>
            </svg>
            <span style={{ color: "#e2e8f0" }}>CCL</span>
            <span style={{ color: "#4ade80" }}>Saathi</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] rounded-full px-2.5 py-0.5"
              style={{ backgroundColor: "#1a5230", color: "#86efac" }}>
              Health
            </span>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
              style={{ backgroundColor: "#166534" }}>
              AK
            </div>
          </div>
        </div>

        {/* Category label */}
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
          style={{ color: "#6ee7b7" }}>
          Health · 8 Dialogues
        </p>

        {/* Dialogue list */}
        {DIALOGUES.map((d) => (
          <div key={d.num}
            className="flex items-center justify-between py-2 border-t"
            style={{ borderColor: "#1a5230" }}>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] w-4 shrink-0" style={{ color: "#6ee7b7" }}>#{d.num}</span>
              <div>
                <p className="text-[13px] font-medium m-0" style={{ color: "#f0fdf4" }}>{d.title}</p>
                <p className="text-[11px] m-0" style={{ color: "#86efac" }}>{d.desc}</p>
              </div>
            </div>
            <span className="text-[11px] font-medium shrink-0" style={{ color: d.statusColor }}>
              {d.status}
            </span>
          </div>
        ))}

        {/* Interpretation bar */}
        <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: "#040f08" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
            style={{ color: "#6ee7b7" }}>
            Your interpretation
          </p>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
              style={{ backgroundColor: "#ef4444" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
            <span className="text-[12px]" style={{ color: "#a7f3d0" }}>
              Press to record your interpretation
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Play button */}
            <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center border"
              style={{ borderColor: "#4ade80" }}>
              <div style={{
                width: 0, height: 0, marginLeft: 2,
                borderTop: "3px solid transparent",
                borderBottom: "3px solid transparent",
                borderLeft: "5px solid #4ade80",
              }} />
            </div>
            <div className="flex-1 h-[3px] rounded-full" style={{ backgroundColor: "#1a5230" }}>
              <div className="w-[60%] h-full rounded-full" style={{ backgroundColor: "#4ade80" }} />
            </div>
            <span className="text-[11px]" style={{ color: "#6ee7b7" }}>1:24</span>
          </div>
        </div>
      </div>

      {/* ── Score report card (white-on-dark) ── */}
      <div className="rounded-2xl p-5" style={{ backgroundColor: "#f0fdf4" }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="font-bold text-[14px] m-0" style={{ color: "#111827" }}>AI Score Report</p>
            <p className="text-[11px] mt-0.5" style={{ color: "#6b7280" }}>
              Medical Appointment · Full dialogue
            </p>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-bold rounded-full px-2.5 py-1 border shrink-0"
            style={{ backgroundColor: "#dcfce7", color: "#16a34a", borderColor: "#bbf7d0" }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: "#16a34a" }} />
            AI SCORED
          </span>
        </div>

        {/* Score ring */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative w-[60px] h-[60px] shrink-0">
            <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
              <circle cx="32" cy="32" r="26" fill="none" stroke="#e5e7eb" strokeWidth="6" />
              <circle
                cx="32" cy="32" r="26" fill="none" stroke="#16a34a" strokeWidth="6"
                strokeDasharray={`${CIRCUMFERENCE * 0.8} ${CIRCUMFERENCE * 0.2}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-base font-bold" style={{ color: "#111827" }}>80</span>
            </div>
          </div>
          <div>
            <p className="font-bold text-[17px] m-0" style={{ color: "#16a34a" }}>Good</p>
            <p className="text-[12px] mt-0.5" style={{ color: "#374151" }}>Overall performance</p>
            <p className="text-[11px]" style={{ color: "#6b7280" }}>Above pass threshold (70)</p>
          </div>
        </div>

        {/* Score bars */}
        <div className="space-y-1.5">
          {SCORE_BARS.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-[11px] w-[84px] shrink-0" style={{ color: "#374151" }}>
                {item.label}
              </span>
              <div className="flex-1 h-[5px] rounded-full" style={{ backgroundColor: "#f3f4f6" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${item.score}%`, backgroundColor: item.color }}
                />
              </div>
              <span className="text-[11px] w-5 text-right shrink-0" style={{ color: "#374151" }}>
                {item.score}
              </span>
            </div>
          ))}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {TAGS.map((tag) => (
            <span
              key={tag.label}
              className="text-[10px] px-2 py-0.5 rounded"
              style={{ backgroundColor: tag.bg, color: tag.color }}
            >
              {tag.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
