import { revalidateTag } from 'next/cache';
import { verifyWebhook } from 'nestjs-wordpress/signature';

/**
 * Called by the NestJS demo after it processed a WordPress webhook.
 * Body: `{ "tags": ["post:12", "type:post"] }`, signed with REVALIDATE_SECRET.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return Response.json({ error: 'REVALIDATE_SECRET is not set' }, { status: 500 });

  // Read the raw text: the signature covers the exact bytes, not a re-serialized object.
  const rawBody = await request.text();
  // Same signature module the NestJS guard uses (Web Crypto: also works on the Edge runtime).
  const verification = await verifyWebhook({ secret, body: rawBody, headers: request.headers });
  if (!verification.ok) {
    return Response.json(
      { error: 'Invalid signature', reason: verification.reason },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { tags } = (body ?? {}) as { tags?: unknown };
  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string')) {
    return Response.json({ error: 'Expected { tags: string[] }' }, { status: 400 });
  }

  for (const tag of tags) {
    // { expire: 0 }: the next visit gets fresh content instead of one last stale render.
    // 'max' (stale-while-revalidate) would be faster but shows the old version once.
    revalidateTag(tag, { expire: 0 });
  }
  return Response.json({ revalidated: tags });
}
