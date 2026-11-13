import { ImageResponse } from "next/og";
import { MARK_PARTS } from "@/components/brand-mark-paths";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FILL = { brand: "#EE6A42", white: "#ffffff", ink: "#1a1a18" } as const;

export default function Image () {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(165deg, #fbf9f3 0%, #f6f4ee 42%, #efe8dc 100%)",
          color: FILL.ink,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(238,106,66,0.14), transparent 70%)",
          }}
        />
        <svg
          viewBox="0 0 515 415"
          width="240"
          height="193"
          style={{ display: "flex", marginBottom: 36 }}
        >
          {MARK_PARTS.map((p) => (
            <path
              key={p.id}
              d={p.d}
              fill={FILL[p.tone]}
              fillRule={p.evenodd ? "evenodd" : "nonzero"}
            />
          ))}
        </svg>
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 650,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: "#6a675e",
          }}
        >
          {SITE_TAGLINE}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 48,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: "#c8421b",
          }}
        >
          tagawallet.com
        </div>
      </div>
    ),
    { ...size },
  );
}
