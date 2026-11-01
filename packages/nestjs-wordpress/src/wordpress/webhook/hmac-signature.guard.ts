import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { ResolvedWordPressOptions } from '../wordpress-options.interface.js';
import { WORDPRESS_RESOLVED_OPTIONS } from '../wordpress.tokens.js';

export const SIGNATURE_HEADER = 'x-nwp-signature';
export const TIMESTAMP_HEADER = 'x-nwp-timestamp';

interface RawBodyRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
}

/**
 * Accepts a request only if `X-NWP-Signature` is `sha256=<hex HMAC>` of
 * `"<X-NWP-Timestamp>.<raw body>"` with the shared secret, and the timestamp is recent.
 *
 * - The HMAC is computed over the *raw* bytes: re-serializing the parsed JSON could differ
 *   (key order, whitespace, unicode escapes) and break the signature.
 * - Signing the timestamp too, and rejecting old ones, stops replays of captured requests.
 * - `timingSafeEqual` avoids leaking how many leading bytes matched through response time.
 */
@Injectable()
export class HmacSignatureGuard implements CanActivate {
  private readonly logger = new Logger(HmacSignatureGuard.name);

  constructor(
    @Inject(WORDPRESS_RESOLVED_OPTIONS) private readonly options: ResolvedWordPressOptions,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const { webhook } = this.options;
    if (!webhook) {
      // Also checked at bootstrap by the controller; this keeps the guard safe on its own.
      throw new InternalServerErrorException('Webhook secret is not configured');
    }

    const request = context.switchToHttp().getRequest<RawBodyRequest>();
    if (!Buffer.isBuffer(request.rawBody)) {
      this.logger.error(
        'Request has no raw body. Create the app with NestFactory.create(AppModule, { rawBody: true }).',
      );
      throw new InternalServerErrorException('Raw body is not available');
    }

    const timestamp = header(request, TIMESTAMP_HEADER);
    const signature = header(request, SIGNATURE_HEADER);
    if (!timestamp || !signature) throw new UnauthorizedException('Missing signature headers');

    const sentAt = Number(timestamp);
    const ageSeconds = Math.abs(Date.now() / 1000 - sentAt);
    if (!Number.isInteger(sentAt) || ageSeconds > webhook.toleranceSeconds) {
      throw new UnauthorizedException('Stale or invalid timestamp');
    }

    const expected = `sha256=${createHmac('sha256', webhook.secret)
      .update(`${timestamp}.`)
      .update(request.rawBody)
      .digest('hex')}`;

    if (!safeEqual(signature, expected)) throw new UnauthorizedException('Invalid signature');
    return true;
  }
}

function header(request: RawBodyRequest, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // timingSafeEqual throws on different lengths; the length itself is not secret.
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Signs a payload the same way the WordPress plugin does. Useful for tests and other senders. */
export function signWebhook(
  secret: string,
  rawBody: string,
  timestamp = Math.floor(Date.now() / 1000),
) {
  const signature = `sha256=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
  return { [TIMESTAMP_HEADER]: String(timestamp), [SIGNATURE_HEADER]: signature };
}
