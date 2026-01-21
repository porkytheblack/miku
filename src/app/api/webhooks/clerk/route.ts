import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET is not set');
    return new Response('Webhook secret not configured', { status: 500 });
  }

  if (!db) {
    console.error('Database not configured');
    return new Response('Database not configured', { status: 503 });
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Verify the webhook
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return new Response('Webhook verification failed', { status: 400 });
  }

  // Handle the webhook events
  const eventType = evt.type;

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;

    const email = email_addresses?.[0]?.email_address;
    const name = [first_name, last_name].filter(Boolean).join(' ') || null;

    if (!email) {
      return new Response('No email found', { status: 400 });
    }

    try {
      // Upsert user
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.id, id));

      if (existingUser.length > 0) {
        await db
          .update(users)
          .set({
            email,
            name,
            imageUrl: image_url,
            updatedAt: new Date(),
          })
          .where(eq(users.id, id));
      } else {
        await db.insert(users).values({
          id,
          email,
          name,
          imageUrl: image_url,
        });
      }
    } catch (error) {
      console.error('Failed to sync user:', error);
      return new Response('Failed to sync user', { status: 500 });
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data;

    if (id) {
      try {
        await db.delete(users).where(eq(users.id, id));
      } catch (error) {
        console.error('Failed to delete user:', error);
        return new Response('Failed to delete user', { status: 500 });
      }
    }
  }

  return new Response('Webhook processed', { status: 200 });
}
