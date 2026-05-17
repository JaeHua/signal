import { NextRequest } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const url = new URL(`/api/signals/${id}`, request.nextUrl.origin)
  return Response.redirect(url, 301)
}
