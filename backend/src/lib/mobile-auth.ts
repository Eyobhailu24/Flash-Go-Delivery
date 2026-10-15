import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { getCookie } from 'hono/cookie';
import type { Context } from 'hono';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { mobileSessions, users } from '../schema.js';

export type AccessPayload = {
  sub: string;
  role: string;
  phoneNumber: string;
  sid?: string;
};
const secret = () => process.env.JWT_ACCESS_SECRET ?? 'change-me-access-secret';
export const hashRefresh = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const expiresAt = () => new Date(Date.now() + 7 * 86400_000);
function accessToken(user: AccessPayload, sid: string) {
  return jwt.sign({ ...user, sid }, secret(), {
    expiresIn: '15m',
    algorithm: 'HS256',
  });
}
export async function issueMobileSession(user: AccessPayload) {
  const id = randomUUID();
  const refreshToken = randomBytes(48).toString('base64url');
  await db
    .insert(mobileSessions)
    .values({
      id,
      userId: user.sub,
      refreshHash: hashRefresh(refreshToken),
      expiresAt: expiresAt(),
    });
  return { accessToken: accessToken(user, id), refreshToken, expiresIn: 900 };
}
export async function rotateMobileSession(refreshToken: string) {
  const nextToken = randomBytes(48).toString('base64url');
  return db.transaction(async (tx) => {
    const [session] = await tx
      .update(mobileSessions)
      .set({ refreshHash: hashRefresh(nextToken), expiresAt: expiresAt() })
      .where(
        and(
          eq(mobileSessions.refreshHash, hashRefresh(refreshToken)),
          isNull(mobileSessions.revokedAt),
          gt(mobileSessions.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!session) return null;
    const [user] = await tx
      .select()
      .from(users)
      .where(and(eq(users.id, session.userId), eq(users.status, 'active')))
      .limit(1);
    if (!user?.isVerified) {
      await tx
        .update(mobileSessions)
        .set({ revokedAt: new Date() })
        .where(eq(mobileSessions.id, session.id));
      return null;
    }
    return {
      accessToken: accessToken(
        { sub: user.id, role: user.role, phoneNumber: user.phoneNumber ?? '' },
        session.id,
      ),
      refreshToken: nextToken,
      expiresIn: 900,
    };
  });
}
export async function readAccessPayload(
  c: Context,
): Promise<AccessPayload | null> {
  const bearer = c.req.header('Authorization');
  const token = bearer?.startsWith('Bearer ')
    ? bearer.slice(7)
    : getCookie(c, 'access_token');
  if (!token) return null;
  try {
    const payload = jwt.verify(token, secret(), {
      algorithms: ['HS256'],
    }) as AccessPayload;
    if (!payload.sub) return null;
    if (payload.sid) {
      const [session] = await db
        .select({ id: mobileSessions.id })
        .from(mobileSessions)
        .innerJoin(users, eq(users.id, mobileSessions.userId))
        .where(
          and(
            eq(mobileSessions.id, payload.sid),
            eq(mobileSessions.userId, payload.sub),
            isNull(mobileSessions.revokedAt),
            gt(mobileSessions.expiresAt, new Date()),
            eq(users.status, 'active'),
            eq(users.isVerified, true),
          ),
        )
        .limit(1);
      if (!session) return null;
    }
    return payload;
  } catch {
    return null;
  }
}
export async function revokeMobileSession(refreshToken: string) {
  await db
    .update(mobileSessions)
    .set({ revokedAt: new Date() })
    .where(eq(mobileSessions.refreshHash, hashRefresh(refreshToken)));
}
