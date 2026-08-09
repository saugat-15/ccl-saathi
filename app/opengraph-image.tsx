import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "CCLSaathi: NAATI CCL bilingual practice";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(145deg, #f0f7f3 0%, #ffffff 45%, #e8f2ec 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 4,
            marginBottom: 24,
          }}
        >
          <span style={{ fontSize: 56, fontWeight: 700, color: "#1a2e22" }}>CCL</span>
          <span style={{ fontSize: 56, fontWeight: 700, color: "#3B7A54" }}>Saathi</span>
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 600,
            color: "#24352c",
            maxWidth: 900,
            lineHeight: 1.25,
          }}
        >
          NAATI CCL bilingual practice: real dialogues, eight topic areas
        </div>
        <div style={{ fontSize: 24, color: "#5c6d64", marginTop: 20, maxWidth: 800 }}>
          Structured audio exercises · Replay & self-assessment · Your pace
        </div>
      </div>
    ),
    { ...size }
  );
}
