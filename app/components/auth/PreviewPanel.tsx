const SCORE_BARS = [
  { label: "Accuracy", score: 85, color: "#16a34a" },
  { label: "Fluency", score: 78, color: "#16a34a" },
  { label: "Completeness", score: 72, color: "#ca8a04" },
  { label: "Terminology", score: 58, color: "#dc2626" },
];

const TAGS = [
  { label: "Strong opening", color: "#16a34a", bg: "#f0fdf4" },
  { label: "Natural pacing", color: "#6b7280", bg: "#f3f4f6" },
  { label: "Missing 2 key phrases", color: "#dc2626", bg: "#fef2f2" },
  { label: "Medical terms weak", color: "#dc2626", bg: "#fef2f2" },
];

const DIALOGUES = [
  { num: 1, title: "Medical Appointment", desc: "Patient asks GP about prescription", status: "Ready", statusColor: "#4ade80" },
  { num: 2, title: "Hospital Admission", desc: "Emergency triage conversation", status: "Ready", statusColor: "#4ade80" },
  { num: 3, title: "Pharmacy Consultation", desc: "Pharmacist explains dosage", status: "New", statusColor: "#94a3b8" },
];

const CIRCUMFERENCE = 2 * Math.PI * 26;

export default function PreviewPanel() {
  return (
    <div
      style={{
        flex: 1,
        backgroundColor: "#0a2318",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "3rem 3.5rem",
        overflowY: "auto",
      }}
    >
      <p
        style={{
          color: "#4ade80",
          fontSize: "0.7rem",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: "1.5rem",
        }}
      >
        What you get
      </p>

      {/* App preview card */}
      <div
        style={{
          backgroundColor: "#0f3d20",
          borderRadius: "16px",
          padding: "1.25rem",
          marginBottom: "1rem",
          border: "1px solid #1a5230",
        }}
      >
        {/* App header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.25rem",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
            <span style={{ color: "#e2e8f0" }}>CCL</span>
            <span style={{ color: "#4ade80" }}>Saathi</span>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                backgroundColor: "#1a5230",
                color: "#86efac",
                fontSize: "0.72rem",
                padding: "0.2rem 0.6rem",
                borderRadius: "999px",
              }}
            >
              Health
            </span>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                backgroundColor: "#166534",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: "0.7rem",
                fontWeight: 700,
              }}
            >
              AK
            </div>
          </div>
        </div>

        <p
          style={{
            color: "#6ee7b7",
            fontSize: "0.65rem",
            letterSpacing: "0.1em",
            fontWeight: 700,
            textTransform: "uppercase",
            marginBottom: "0.5rem",
          }}
        >
          Health — 8 Dialogues
        </p>

        {DIALOGUES.map((d) => (
          <div
            key={d.num}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.55rem 0",
              borderTop: "1px solid #1a5230",
            }}
          >
            <div style={{ display: "flex", gap: "0.65rem", alignItems: "center" }}>
              <span style={{ color: "#6ee7b7", fontSize: "0.68rem", minWidth: 16 }}>
                #{d.num}
              </span>
              <div>
                <p style={{ color: "#f0fdf4", fontSize: "0.8rem", fontWeight: 500, margin: 0 }}>
                  {d.title}
                </p>
                <p style={{ color: "#86efac", fontSize: "0.68rem", margin: "0.1rem 0 0" }}>
                  {d.desc}
                </p>
              </div>
            </div>
            <span style={{ color: d.statusColor, fontSize: "0.7rem", fontWeight: 500 }}>
              {d.status}
            </span>
          </div>
        ))}

        {/* Interpretation bar */}
        <div
          style={{
            marginTop: "0.75rem",
            backgroundColor: "#071a10",
            borderRadius: "10px",
            padding: "0.75rem 1rem",
          }}
        >
          <p
            style={{
              color: "#6ee7b7",
              fontSize: "0.6rem",
              letterSpacing: "0.1em",
              fontWeight: 700,
              textTransform: "uppercase",
              marginBottom: "0.5rem",
            }}
          >
            Your interpretation
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                backgroundColor: "#ef4444",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#fff" }} />
            </div>
            <span style={{ color: "#a7f3d0", fontSize: "0.75rem" }}>
              Press to record your interpretation
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {/* Play button */}
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: "1.5px solid #4ade80",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: "4px solid transparent",
                  borderBottom: "4px solid transparent",
                  borderLeft: "6px solid #4ade80",
                  marginLeft: 2,
                }}
              />
            </div>
            <div style={{ flex: 1, height: 3, backgroundColor: "#1a5230", borderRadius: 2 }}>
              <div style={{ width: "60%", height: "100%", backgroundColor: "#4ade80", borderRadius: 2 }} />
            </div>
            <span style={{ color: "#6ee7b7", fontSize: "0.68rem" }}>1:24</span>
          </div>
        </div>
      </div>

      {/* Score report card */}
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "1.25rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "1rem",
          }}
        >
          <div>
            <p style={{ fontWeight: 700, color: "#111827", fontSize: "0.9rem", margin: 0 }}>
              AI Score Report
            </p>
            <p style={{ color: "#6b7280", fontSize: "0.72rem", margin: "0.15rem 0 0" }}>
              Medical Appointment · Full dialogue
            </p>
          </div>
          <span
            style={{
              backgroundColor: "#f0fdf4",
              color: "#16a34a",
              fontSize: "0.68rem",
              fontWeight: 700,
              padding: "0.25rem 0.6rem",
              borderRadius: "999px",
              border: "1px solid #bbf7d0",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                backgroundColor: "#16a34a",
                borderRadius: "50%",
                display: "inline-block",
              }}
            />
            AI SCORED
          </span>
        </div>

        {/* Score ring + summary */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ position: "relative", width: 60, height: 60, flexShrink: 0 }}>
            <svg viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)", width: 60, height: 60 }}>
              <circle cx="32" cy="32" r="26" fill="none" stroke="#e5e7eb" strokeWidth="6" />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="#16a34a"
                strokeWidth="6"
                strokeDasharray={`${CIRCUMFERENCE * 0.8} ${CIRCUMFERENCE * 0.2}`}
                strokeLinecap="round"
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: "1rem", fontWeight: 700, color: "#111827" }}>80</span>
            </div>
          </div>
          <div>
            <p style={{ fontWeight: 700, color: "#16a34a", fontSize: "1.05rem", margin: 0 }}>Good</p>
            <p style={{ color: "#374151", fontSize: "0.78rem", margin: "0.1rem 0 0" }}>
              Overall performance
            </p>
            <p style={{ color: "#6b7280", fontSize: "0.72rem", margin: "0.1rem 0 0" }}>
              Above pass threshold (70)
            </p>
          </div>
        </div>

        {/* Score bars */}
        {SCORE_BARS.map((item) => (
          <div
            key={item.label}
            style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem" }}
          >
            <span style={{ fontSize: "0.72rem", color: "#374151", width: 88, flexShrink: 0 }}>
              {item.label}
            </span>
            <div style={{ flex: 1, height: 5, backgroundColor: "#f3f4f6", borderRadius: 3 }}>
              <div
                style={{
                  width: `${item.score}%`,
                  height: "100%",
                  backgroundColor: item.color,
                  borderRadius: 3,
                }}
              />
            </div>
            <span style={{ fontSize: "0.72rem", color: "#374151", width: 22, textAlign: "right", flexShrink: 0 }}>
              {item.score}
            </span>
          </div>
        ))}

        {/* Tags */}
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
          {TAGS.map((tag) => (
            <span
              key={tag.label}
              style={{
                fontSize: "0.65rem",
                padding: "0.2rem 0.5rem",
                borderRadius: 4,
                backgroundColor: tag.bg,
                color: tag.color,
              }}
            >
              {tag.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
