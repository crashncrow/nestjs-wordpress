/**
 * Webhook signature: the one module that signs and verifies webhooks.
 *
 * Scheme: `X-NWP-Signature: sha256=<hex HMAC-SHA256(secret, "<timestamp>.<raw body>")>` plus
 * `X-NWP-Timestamp: <unix seconds>`. Signing the timestamp lets the receiver reject replays.
 *
 * Built on Web Crypto (`crypto.subtle`), not `node:crypto`, so it runs wherever a webhook can
 * be received: Node, Edge runtimes, Cloudflare Workers, Deno, Bun. Published as
 * `nestjs-wordpress/signature` with no NestJS imports. The WordPress plugin implements the same
 * scheme in PHP; shared test vectors keep both in step.
 */

export const TIMESTAMP_HEADER = 'x-nwp-timestamp';
export const SIGNATURE_HEADER = 'x-nwp-signature';
export const DEFAULT_TOLERANCE_SECONDS = 300;

const PREFIX = 'sha256=';
const encoder = new TextEncoder();

/** `Headers` from fetch, or a Node/Express-style headers object (lower-case keys). */
export type HeadersLike =
  { get(name: string): string | null } | Record<string, string | string[] | undefined>;

export interface VerifyWebhookInput {
  secret: string;
  /** The raw request body, exactly as received (not re-serialized JSON). */
  body: string | Uint8Array;
  headers: HeadersLike;
  /** Maximum age (and clock skew) accepted, in seconds. Defaults to 300. */
  toleranceSeconds?: number;
  /** Current time in milliseconds. Injectable for tests; defaults to `Date.now()`. */
  now?: number;
}

export type WebhookVerification =
  { ok: true } | { ok: false; reason: 'missing-headers' | 'stale' | 'bad-signature' };

/** Headers to send with `body`. */
export async function signWebhook(
  secret: string,
  body: string | Uint8Array,
  options: { now?: number } = {},
): Promise<{ [TIMESTAMP_HEADER]: string; [SIGNATURE_HEADER]: string }> {
  const timestamp = String(Math.floor((options.now ?? Date.now()) / 1000));
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(secret), signedBytes(timestamp, body));
  return { [TIMESTAMP_HEADER]: timestamp, [SIGNATURE_HEADER]: PREFIX + toHex(new Uint8Array(mac)) };
}

/** Checks the signature headers against `body`. Never throws for invalid input. */
export async function verifyWebhook(input: VerifyWebhookInput): Promise<WebhookVerification> {
  const timestamp = readHeader(input.headers, TIMESTAMP_HEADER);
  const signature = readHeader(input.headers, SIGNATURE_HEADER);
  if (!timestamp || !signature) return { ok: false, reason: 'missing-headers' };

  const tolerance = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const ageSeconds = Math.abs((input.now ?? Date.now()) / 1000 - Number(timestamp));
  if (!/^\d+$/.test(timestamp) || ageSeconds > tolerance) return { ok: false, reason: 'stale' };

  const mac = signature.startsWith(PREFIX) ? fromHex(signature.slice(PREFIX.length)) : null;
  // subtle.verify compares in constant time, so response timing does not reveal how much matched.
  const valid =
    mac !== null &&
    (await crypto.subtle.verify(
      'HMAC',
      await hmacKey(input.secret),
      mac,
      signedBytes(timestamp, input.body),
    ));
  return valid ? { ok: true } : { ok: false, reason: 'bad-signature' };
}

// Return type inferred: `CryptoKey` is a value in @types/node and a type in lib.dom.
function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** `"<timestamp>."` followed by the raw body bytes. */
function signedBytes(timestamp: string, body: string | Uint8Array): Uint8Array<ArrayBuffer> {
  const prefix = encoder.encode(`${timestamp}.`);
  const payload = typeof body === 'string' ? encoder.encode(body) : body;
  const bytes = new Uint8Array(prefix.length + payload.length);
  bytes.set(prefix);
  bytes.set(payload, prefix.length);
  return bytes;
}

function readHeader(headers: HeadersLike, name: string): string | undefined {
  if (typeof headers.get === 'function')
    return (headers as { get(n: string): string | null }).get(name) ?? undefined;
  const value = (headers as Record<string, string | string[] | undefined>)[name];
  return Array.isArray(value) ? value[0] : value;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length !== 64 || !/^[\da-f]+$/i.test(hex)) return null;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
