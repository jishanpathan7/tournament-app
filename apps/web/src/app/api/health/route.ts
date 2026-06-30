import { NextResponse } from "next/server";

import { env } from "@/lib/env";

/**
 * BFF proxy → backend health. Demonstrates the server-side pattern (a route handler
 * forwarding to FastAPI, where it would also forward auth cookies). Curl-able proof
 * of frontend→backend connectivity: GET /api/health.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${env.apiUrl}/api/v1/health`, { cache: "no-store" });
    const backend = await res.json();
    return NextResponse.json({ proxied: true, backend });
  } catch {
    return NextResponse.json({ proxied: false, error: "backend unreachable" }, { status: 502 });
  }
}
