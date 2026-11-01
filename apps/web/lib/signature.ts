import { createHmac, timingSafeEqual } from 'node:crypto';

const TOLERANCE_SECONDS = 300;

/**
 * Verifies `X-NWP-Signature: sha256=<hex>` over `"<X-NWP-Timestamp>.<raw body>"`: the same
 * scheme the WordPress plugin uses towards NestJS and NestJS uses towards this app.
 */
export function verifySignature(
  secret: string,
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
): boolean {
  if (!timestamp || !signature) return false;

  const sentAt = Number(timestamp);
  if (!Number.isInteger(sentAt) || Math.abs(Date.now() / 1000 - sentAt) > TOLERANCE_SECONDS) {
    return false;
  }

  const expected = `sha256=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
