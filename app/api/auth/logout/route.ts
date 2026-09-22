import { revokeSession, sessionCookie } from "../../../../lib/auth/session";

export const runtime = "edge";

export async function GET(request: Request): Promise<Response> {
  await revokeSession(request);
  return new Response(null, { status: 302, headers: { Location: "/", "Set-Cookie": sessionCookie("", 0) } });
}

export async function POST(request: Request): Promise<Response> { return GET(request); }
