const encoder = new TextEncoder();

export function base64UrlEncode(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlDecode(input: string): Uint8Array {
  const value = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function randomToken(bytes = 32): string {
  const output = new Uint8Array(bytes);
  crypto.getRandomValues(output);
  return base64UrlEncode(output);
}

export async function sha256(value: string): Promise<string> {
  return base64UrlEncode(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64UrlEncode(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

export async function signValue(value: string, secret: string): Promise<string> {
  return `${value}.${await hmac(value, secret)}`;
}

export async function verifySignedValue(signed: string, secret: string): Promise<string | null> {
  const separator = signed.lastIndexOf(".");
  if (separator < 1) return null;
  const value = signed.slice(0, separator);
  const signature = signed.slice(separator + 1);
  return await constantTimeEqual(signature, await hmac(value, secret)) ? value : null;
}
