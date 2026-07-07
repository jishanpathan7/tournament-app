import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { INK, PAPER, PRIMARY, YELLOW } from "@/lib/design-tokens";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export const alt = SITE.tagline;

export default function OgImage() {
  const logoData = readFileSync(join(process.cwd(), "public", "logo-mark.png"));
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "space-between",
        background: INK,
        padding: "72px 80px",
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(255,253,245,0.07) 1px, transparent 0)",
        backgroundSize: "28px 28px",
      }}
    >
      {/* Top: brand mark + wordmark */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 72,
            height: 72,
            background: PRIMARY,
            borderRadius: 20,
            border: `3px solid ${INK}`,
          }}
        >
          <img
            src={logoSrc}
            alt=""
            width={48}
            height={48}
            style={{ filter: "brightness(0) invert(1)" }}
          />
        </div>
        <span
          style={{
            fontFamily: "serif",
            fontSize: 48,
            fontWeight: 700,
            color: PAPER,
            letterSpacing: "-1px",
          }}
        >
          {SITE.name}
        </span>
      </div>

      {/* Middle: tagline */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <p
          style={{
            fontFamily: "monospace",
            fontSize: 14,
            fontWeight: 700,
            color: YELLOW,
            textTransform: "uppercase",
            letterSpacing: "0.28em",
            margin: 0,
          }}
        >
          Tournament operating system
        </p>
        <p
          style={{
            fontFamily: "serif",
            fontSize: 64,
            fontWeight: 700,
            color: PAPER,
            letterSpacing: "-2px",
            lineHeight: 1.1,
            margin: 0,
            maxWidth: 860,
          }}
        >
          {SITE.tagline}
        </p>
      </div>

      {/* Bottom: description */}
      <p
        style={{
          fontFamily: "sans-serif",
          fontSize: 22,
          color: `${PAPER}99`,
          margin: 0,
        }}
      >
        {SITE.description}
      </p>
    </div>,
    { ...size },
  );
}
