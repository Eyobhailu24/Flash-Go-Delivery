import 'dotenv/config';
import { serve } from '@hono/node-server';
import { app } from './app.js';
import { promoteDueCustomerCancelOrders } from './lib/orderConfirmation.js';
import { deliverPendingPush } from './lib/push-worker.js';

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port }, () => {
  console.log(`Backend running on http://localhost:${port}`);
  setInterval(() => {
    void promoteDueCustomerCancelOrders().catch((error) => console.error('[order-confirmation] promote failed', error));
  }, 15_000);
  if (process.env.PUSH_ENABLED !== 'false') setInterval(() => {
    void deliverPendingPush().catch((error) => console.error('[push] worker failed', error instanceof Error ? error.message : error));
  }, 5_000);
});
