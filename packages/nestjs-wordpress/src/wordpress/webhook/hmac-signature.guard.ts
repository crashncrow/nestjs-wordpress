import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyWebhook, type WebhookVerification } from '../../signature/index.js';
import type { ResolvedWordPressOptions } from '../wordpress-options.interface.js';
import { WORDPRESS_RESOLVED_OPTIONS } from '../wordpress.tokens.js';

interface RawBodyRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
}

const MESSAGES: Record<Exclude<WebhookVerification, { ok: true }>['reason'], string> = {
  'missing-headers': 'Missing signature headers',
  stale: 'Stale or invalid timestamp',
  'bad-signature': 'Invalid signature',
};

/**
 * Nest adapter for the webhook signature module: reads the raw body and the configured
 * secret/tolerance, delegates to `verifyWebhook`, and turns a rejection into a 401.
 *
 * The signature covers the *raw* bytes: re-serializing the parsed JSON could differ (key
 * order, whitespace, unicode escapes) and break it, hence the `rawBody: true` requirement.
 */
@Injectable()
export class HmacSignatureGuard implements CanActivate {
  private readonly logger = new Logger(HmacSignatureGuard.name);

  constructor(
    @Inject(WORDPRESS_RESOLVED_OPTIONS) private readonly options: ResolvedWordPressOptions,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    const result = await verifyWebhook({
      secret: webhook.secret,
      body: request.rawBody,
      headers: request.headers,
      toleranceSeconds: webhook.toleranceSeconds,
    });
    if (!result.ok) throw new UnauthorizedException(MESSAGES[result.reason]);
    return true;
  }
}
