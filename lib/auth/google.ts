import { getDb, getEnv } from "../db";
import { base64UrlDecode, base64UrlEncode, randomToken, sha256, signValue, verifySignedValue } from "./crypto";

export const OIDC_STATE_COOKIE = "sodateru_oidc_state";
const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

export interface OidcState {
  state: string;
  nonce: string;
  redirect: string;
  issuedAt: number;
  expiresAt: number;
}
export interface GoogleClaims { sub: string; email: string; email_verified?: boolean; name?: string; picture?: string; hd?: string; iss: string; aud: string; exp: number; iat: number; nonce: string; }

export async function makeOidcState(redirect: string): Promise<{ signed: string; state: OidcState }> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const state = {
    state: randomToken(24),
    nonce: randomToken(24),
    redirect: safeRedirect(redirect),
    issuedAt,
    expiresAt: issuedAt + 600,
  };
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(state)));
  return { state, signed: await signValue(payload, getEnv().AUTH_SECRET) };
}

export async function readOidcState(signed: string): Promise<OidcState | null> {
  const payload = await verifySignedValue(signed, getEnv().AUTH_SECRET);
  if (!payload) return null;
  try {
    const state = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payload)),
    ) as OidcState;
    const now = Math.floor(Date.now() / 1000);
    if (!state.issuedAt || !state.expiresAt || state.issuedAt > now + 60 || state.expiresAt < now) {
      return null;
    }
    return state;
  } catch { return null; }
}

export async function exchangeCode(code: string, redirectUri: string, expectedNonce: string): Promise<GoogleClaims> {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new Error("Google OIDC credentials are not configured");
  const body = new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: "authorization_code" });
  const response = await fetch(GOOGLE_TOKEN, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error("Google token exchange failed");
  const token = await response.json() as { id_token?: string };
  if (!token.id_token) throw new Error("Google did not return an ID token");
  return verifyIdToken(token.id_token, env.GOOGLE_CLIENT_ID, expectedNonce);
}

async function verifyIdToken(jwt: string, clientId: string, expectedNonce: string): Promise<GoogleClaims> {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Malformed Google ID token");
  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0]))) as { alg?: string; kid?: string };
  const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1]))) as GoogleClaims;
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== "RS256" || !header.kid || !claims.sub ||
      !GOOGLE_ISSUERS.has(claims.iss) || claims.aud !== clientId ||
      claims.exp <= now || !claims.iat || claims.iat > now + 60 ||
      claims.nonce !== expectedNonce) {
    throw new Error("Invalid Google ID token claims");
  }
  if (!claims.email || claims.email_verified !== true || claims.hd !== "tomidah.com" || !claims.email.toLowerCase().endsWith("@tomidah.com")) throw new Error("Only verified tomidah.com accounts are allowed");
  const jwksResponse = await fetch(GOOGLE_JWKS);
  if (!jwksResponse.ok) throw new Error("Unable to load Google signing keys");
  const jwks = await jwksResponse.json() as { keys: Array<{ kid: string; kty: string; n: string; e: string; alg?: string }> };
  const key = jwks.keys.find((candidate) => candidate.kid === header.kid);
  if (!key) throw new Error("Unknown Google signing key");
  const cryptoKey = await crypto.subtle.importKey("jwk", { kty: key.kty, n: key.n, e: key.e, alg: key.alg ?? "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, base64UrlDecode(parts[2]) as unknown as BufferSource, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new Error("Invalid Google ID token signature");
  return claims;
}

export async function upsertGoogleUser(claims: GoogleClaims): Promise<string> {
  const env = getEnv();
  const email = claims.email.toLowerCase();
  const allowlisted = await getDb().prepare("SELECT google_sub FROM teacher_allowlist WHERE google_sub=? OR lower(email)=?").bind(claims.sub, email).first();
  const configured = (env.TEACHER_ALLOWLIST ?? "").split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean).includes(email) || (env.TEACHER_ALLOWLIST ?? "").split(",").map((entry) => entry.trim()).includes(claims.sub);
  const role = allowlisted || configured ? "teacher" : "student";
  const existing = await getDb().prepare("SELECT id FROM users WHERE google_sub=?").bind(claims.sub).first<{ id: string }>();
  const id = existing?.id ?? await sha256(`google:${claims.sub}`);
  await getDb().prepare(`INSERT INTO users (id,google_sub,email,name,picture_url,role) VALUES (?,?,?,?,?,?)
    ON CONFLICT(google_sub) DO UPDATE SET email=excluded.email,name=excluded.name,picture_url=excluded.picture_url,role=excluded.role,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
    .bind(id, claims.sub, email, claims.name ?? email.split("@")[0], claims.picture ?? null, role).run();
  return id;
}

export function safeRedirect(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function oidcAuthorizationUrl(request: Request, state: OidcState): string {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID) throw new Error("GOOGLE_CLIENT_ID is not configured");
  const url = new URL(GOOGLE_AUTH);
  url.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: callbackUrl(request), response_type: "code", scope: "openid email profile", state: state.state, nonce: state.nonce, hd: "tomidah.com", prompt: "select_account" }).toString();
  return url.toString();
}

export function callbackUrl(request: Request): string {
  const configuredOrigin = getEnv().APP_URL?.trim();
  if (configuredOrigin) {
    const url = new URL(configuredOrigin);
    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      throw new Error("APP_URL must use HTTPS");
    }
    return new URL("/api/auth/google/callback", url.origin).toString();
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1") {
    return new URL("/api/auth/google/callback", requestUrl.origin).toString();
  }
  throw new Error("APP_URL is not configured");
}
