import { getSessionUser } from "../../../../lib/auth/session";

export const runtime = "edge";

export async function GET(request: Request): Promise<Response> {
  try { return Response.json({ user: await getSessionUser(request) }); }
  catch { return Response.json({ user: null }, { status: 503 }); }
}
