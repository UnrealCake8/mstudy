import { NextRequest, NextResponse } from "next/server";

const UPSTREAM_URL = "https://studyfiles.mplace.cc/base-timetable/base.pdf";

export async function GET(request: NextRequest) {
  const range = request.headers.get("range");

  const upstream = await fetch(UPSTREAM_URL, {
    headers: range ? { Range: range } : undefined,
    cache: "no-store",
  });

  const headers = new Headers();
  const passthroughHeaders = [
    "accept-ranges",
    "cache-control",
    "content-length",
    "content-range",
    "content-type",
    "etag",
    "last-modified",
  ];

  for (const name of passthroughHeaders) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/pdf");
  }

  headers.set("content-disposition", 'inline; filename="base.pdf"');

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}
