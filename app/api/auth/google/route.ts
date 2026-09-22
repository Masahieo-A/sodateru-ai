import { makeOidcState, oidcAuthorizationUrl } from "../../../../lib/auth/google";

export const runtime = "edge";

export async function GET(request: Request): Promise<Response> {
  try {
    const requestedRedirect = new URL(request.url).searchParams.get("redirect") ?? "/";
    const { state, signed } = await makeOidcState(requestedRedirect);
    const location = oidcAuthorizationUrl(request, state);
    return new Response(null, { status: 302, headers: { Location: location, "Set-Cookie": `sodateru_oidc_state=${encodeURIComponent(signed)}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax` } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "OIDC is not configured" }, { status: 503 });
  }
}
