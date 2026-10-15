import { sql } from 'drizzle-orm';
import { db } from '../db.js';

type Job = {
  id: string;
  token: string;
  title: string;
  message: string;
  notification_id: string;
  device_id: string;
};
type Ticket = { status: string; id?: string; details?: { error?: string } };
let running = false;
const headers = () => ({
  'Content-Type': 'application/json',
  ...(process.env.EXPO_ACCESS_TOKEN
    ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
    : {}),
});

// The database outbox also picks up notifications inserted inside existing order transactions.
// Claims are atomic, so multiple API instances cannot send the same pending row concurrently.
export async function deliverPendingPush() {
  if (running || process.env.PUSH_ENABLED === 'false') return;
  running = true;
  try {
    await db.execute(sql`INSERT INTO push_deliveries (notification_id, device_id)
      SELECT n.notification_id, d.id FROM notifications n JOIN notification_devices d ON d.user_id=n.user_id
      JOIN mobile_sessions s ON s.id=d.session_id JOIN users u ON u.id=d.user_id
      WHERE s.revoked_at IS NULL AND s.expires_at > now() AND u.status='active'
      AND n.created_at >= d.created_at AND n.created_at > now() - interval '1 day'
      ON CONFLICT (notification_id, device_id) DO NOTHING`);
    const jobs = (await db.execute(sql`WITH candidates AS (
      SELECT id FROM push_deliveries WHERE (status='pending' OR status='sending')
      AND next_attempt_at <= now() AND attempts < 5 ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED
    ), claimed AS (
      UPDATE push_deliveries p SET status='sending', attempts=attempts+1, next_attempt_at=now()+interval '2 minutes'
      FROM candidates c WHERE p.id=c.id RETURNING p.*
    ) SELECT c.id,c.notification_id,c.device_id,d.token,n.title,n.message
      FROM claimed c JOIN notifications n ON n.notification_id=c.notification_id
      JOIN notification_devices d ON d.id=c.device_id AND d.user_id=n.user_id
      JOIN mobile_sessions s ON s.id=d.session_id JOIN users u ON u.id=d.user_id
      WHERE s.revoked_at IS NULL AND s.expires_at > now() AND u.status='active'`)) as unknown as Job[];
    if (jobs.length) {
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: headers(),
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify(
            jobs.map((job) => ({
              to: job.token,
              sound: 'default',
              channelId: 'orders',
              title: job.title,
              body: job.message,
              data: { notificationId: job.notification_id },
            })),
          ),
        });
        if (!response.ok) throw new Error(`Push transport: ${response.status}`);
        const payload = (await response.json()) as { data?: Ticket[] };
        if (!Array.isArray(payload.data) || payload.data.length !== jobs.length)
          throw new Error('Invalid push tickets');
        for (const [index, job] of jobs.entries()) {
          const ticket = payload.data[index];
          if (ticket.details?.error === 'DeviceNotRegistered') {
            await db.execute(
              sql`DELETE FROM notification_devices WHERE id=${job.device_id}::uuid`,
            );
          } else {
            const status =
              ticket.status === 'ok' && ticket.id ? 'ticket' : 'pending';
            await db.execute(
              sql`UPDATE push_deliveries SET status=${status},ticket_id=${ticket.id ?? null},next_attempt_at=now()+interval '5 minutes' WHERE id=${job.id}::uuid`,
            );
          }
        }
      } catch (error) {
        console.error(
          '[push] send will retry',
          error instanceof Error ? error.message : 'transport error',
        );
      }
    }
    const pending = (await db.execute(
      sql`SELECT id,ticket_id,device_id FROM push_deliveries WHERE status='ticket' AND next_attempt_at <= now() LIMIT 100`,
    )) as unknown as { id: string; ticket_id: string; device_id: string }[];
    if (pending.length) {
      const response = await fetch(
        'https://exp.host/--/api/v2/push/getReceipts',
        {
          method: 'POST',
          headers: headers(),
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({ ids: pending.map((job) => job.ticket_id) }),
        },
      );
      if (!response.ok) return;
      const payload = (await response.json()) as {
        data?: Record<string, Ticket>;
      };
      for (const job of pending) {
        const receipt = payload.data?.[job.ticket_id];
        if (receipt?.details?.error === 'DeviceNotRegistered')
          await db.execute(
            sql`DELETE FROM notification_devices WHERE id=${job.device_id}::uuid`,
          );
        else if (receipt)
          await db.execute(
            sql`UPDATE push_deliveries SET status=${receipt.status === 'ok' ? 'delivered' : 'failed'} WHERE id=${job.id}::uuid`,
          );
        else
          await db.execute(
            sql`UPDATE push_deliveries SET next_attempt_at=now()+interval '15 minutes' WHERE id=${job.id}::uuid`,
          );
      }
    }
    await db.execute(
      sql`UPDATE push_deliveries SET status='failed' WHERE status IN ('pending','sending') AND attempts >= 5 AND next_attempt_at <= now()`,
    );
  } finally {
    running = false;
  }
}
