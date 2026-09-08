import "server-only";

import type { NextRequest } from "next/server";

function firstHeaderValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

export function isSameOriginRequest(request: NextRequest) {
  const originHeader = request.headers.get("origin");
  if (!originHeader) return true;

  let browserOrigin: string;
  try {
    browserOrigin = new URL(originHeader).origin;
  } catch {
    return false;
  }

  const allowedOrigins = new Set<string>([new URL(request.url).origin]);
  const forwardedProtocol = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const host = forwardedHost ?? firstHeaderValue(request.headers.get("host"));

  if (host && (forwardedProtocol === "http" || forwardedProtocol === "https")) {
    try {
      allowedOrigins.add(new URL(`${forwardedProtocol}://${host}`).origin);
    } catch {
      return false;
    }
  }

  return allowedOrigins.has(browserOrigin);
}
