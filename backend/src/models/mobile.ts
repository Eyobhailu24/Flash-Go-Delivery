import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { notifications } from './notifications.js';

export const mobileSessions = pgTable(
  'mobile_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshHash: text('refresh_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index('mobile_sessions_user_idx').on(t.userId)],
);

export const notificationDevices = pgTable('notification_devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').references(() => mobileSessions.id, {
    onDelete: 'cascade',
  }),
  token: text('token').notNull().unique(),
  platform: text('platform').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const pushDeliveries = pgTable(
  'push_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.notificationId, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => notificationDevices.id, { onDelete: 'cascade' }),
    status: text('status').default('pending').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    ticketId: text('ticket_id'),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique('push_deliveries_notification_id_device_id_key').on(
      t.notificationId,
      t.deviceId,
    ),
    index('push_deliveries_pending_idx').on(t.status, t.nextAttemptAt),
  ],
);
