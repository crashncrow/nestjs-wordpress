import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  signWebhook,
  verifyWebhook,
} from '../../src/signature/index.js';

interface Vector {
  name: string;
  secret: string;
  timestamp: string;
  body: string;
  signature: string;
}

// Shared with the WordPress plugin (wordpress-plugin/tests/signature-vectors.php) and generated
// with node:crypto, an implementation independent from the Web Crypto one under test.
const { vectors } = JSON.parse(
  readFileSync(new URL('../fixtures/signature-vectors.json', import.meta.url), 'utf8'),
) as { vectors: Vector[] };

const at = (timestamp: string) => Number(timestamp) * 1000;

describe('webhook signature', () => {
  describe.each(vectors)('vector: $name', (vector) => {
    it('signs to the expected signature', async () => {
      const headers = await signWebhook(vector.secret, vector.body, { now: at(vector.timestamp) });
      expect(headers).toEqual({
        [TIMESTAMP_HEADER]: vector.timestamp,
        [SIGNATURE_HEADER]: vector.signature,
      });
    });

    it('verifies the expected signature, from a string or raw bytes', async () => {
      const headers = {
        [TIMESTAMP_HEADER]: vector.timestamp,
        [SIGNATURE_HEADER]: vector.signature,
      };
      const now = at(vector.timestamp);
      await expect(
        verifyWebhook({ secret: vector.secret, body: vector.body, headers, now }),
      ).resolves.toEqual({ ok: true });
      await expect(
        verifyWebhook({
          secret: vector.secret,
          body: new TextEncoder().encode(vector.body),
          headers,
          now,
        }),
      ).resolves.toEqual({ ok: true });
    });
  });

  const secret = 'secret';
  const body = '{"event":"post.saved"}';
  const now = 1_800_000_000_000;

  it('accepts fetch Headers and Node-style header objects (including arrays)', async () => {
    const signed = await signWebhook(secret, body, { now });
    await expect(
      verifyWebhook({ secret, body, headers: new Headers(signed), now }),
    ).resolves.toEqual({ ok: true });
    const arrays = {
      [TIMESTAMP_HEADER]: [signed[TIMESTAMP_HEADER]],
      [SIGNATURE_HEADER]: [signed[SIGNATURE_HEADER]],
    };
    await expect(verifyWebhook({ secret, body, headers: arrays, now })).resolves.toEqual({
      ok: true,
    });
  });

  it.each([
    ['missing headers', {}, 'missing-headers'],
    ['missing signature', { [TIMESTAMP_HEADER]: '1800000000' }, 'missing-headers'],
    [
      'non-numeric timestamp',
      { [TIMESTAMP_HEADER]: 'abc', [SIGNATURE_HEADER]: 'sha256=00' },
      'stale',
    ],
    [
      'malformed signature',
      { [TIMESTAMP_HEADER]: '1800000000', [SIGNATURE_HEADER]: 'md5=abc' },
      'bad-signature',
    ],
    [
      'wrong hex length',
      { [TIMESTAMP_HEADER]: '1800000000', [SIGNATURE_HEADER]: 'sha256=abcd' },
      'bad-signature',
    ],
  ] as const)('rejects %s', async (_name, headers, reason) => {
    await expect(verifyWebhook({ secret, body, headers, now })).resolves.toEqual({
      ok: false,
      reason,
    });
  });

  it('rejects a wrong secret and a tampered body', async () => {
    const headers = await signWebhook(secret, body, { now });
    await expect(verifyWebhook({ secret: 'other', body, headers, now })).resolves.toEqual({
      ok: false,
      reason: 'bad-signature',
    });
    await expect(verifyWebhook({ secret, body: `${body} `, headers, now })).resolves.toEqual({
      ok: false,
      reason: 'bad-signature',
    });
  });

  it('accepts timestamps exactly at the tolerance and rejects one second past it, both directions', async () => {
    const headers = await signWebhook(secret, body, { now });
    const verify = (offsetSeconds: number) =>
      verifyWebhook({
        secret,
        body,
        headers,
        now: now + offsetSeconds * 1000,
        toleranceSeconds: 60,
      });
    await expect(verify(60)).resolves.toEqual({ ok: true });
    await expect(verify(-60)).resolves.toEqual({ ok: true });
    await expect(verify(61)).resolves.toEqual({ ok: false, reason: 'stale' });
    await expect(verify(-61)).resolves.toEqual({ ok: false, reason: 'stale' });
  });
});
