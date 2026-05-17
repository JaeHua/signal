import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const url = new URL("/api/signals", request.nextUrl.origin)
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value)
  })
  return Response.redirect(url, 301)
}
