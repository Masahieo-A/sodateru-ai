import { callbackUrl, exchangeCode, OIDC_STATE_COOKIE, readOidcState, upsertGoogleUser } from "../../../../../lib/auth/google";
import { createSession, sessionCookie } from "../../../../../lib/auth/session";

export const runtime = "edge";

function readCookie(request: Request, name: string): string | null {
  const match = (request.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const stateCookie = readCookie(request, OIDC_STATE_COOKIE);
  const state = stateCookie ? await readOidcState(stateCookie) : null;
  if (!state || params.get("state") !== state.state) return Response.json({ error: "Invalid OIDC state" }, { status: 400 });
  if (params.get("error")) return Response.json({ error: params.get("error_description") ?? params.get("error") }, { status: 401 });
  const code = params.get("code");
  if (!code) return Response.json({ error: "Missing authorization code" }, { status: 400 });
  try {
    const claims = await exchangeCode(code, callbackUrl(request), state.nonce);
    const userId = await upsertGoogleUser(claims);
    const session = await createSession(userId);
    const headers = new Headers({ Location: state.redirect });
    headers.append("Set-Cookie", sessionCookie(session.value, session.maxAge));
    headers.append("Set-Cookie", "sodateru_oidc_state=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax");
    return new Response(null, { status: 302, headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Authentication failed" }, { status: 401 });
  }
}
