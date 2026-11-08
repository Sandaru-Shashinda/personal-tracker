import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

const SIZES = new Set([180, 192, 512]);

export async function GET(req: NextRequest, ctx: RouteContext<"/icons/[size]">) {
  const { size: raw } = await ctx.params;
  const size = SIZES.has(Number(raw)) ? Number(raw) : 192;
  const maskable = req.nextUrl.searchParams.has("maskable");
  const pad = maskable ? size * 0.2 : size * 0.12;
  const inner = size - pad * 2;
  const stroke = Math.max(2, inner * 0.09);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2a78d6",
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={(stroke / inner) * 24} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
