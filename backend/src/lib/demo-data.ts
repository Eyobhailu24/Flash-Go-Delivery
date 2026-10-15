import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import {
  users,
  customerProfile,
  businessProfile,
  driverProfile,
  adminProfile,
  categoryNameCatalog,
  productCategories,
  categoryItems,
} from '../schema.js';

export const DEMO_PASSWORD = 'FlashGoDemo!2026';
export const DEMO_ROLES = ['customer', 'business', 'driver', 'admin'] as const;
export async function seedMobileDemo(isolated = false) {
  const run = isolated ? randomUUID().slice(0, 8) : 'demo';
  const passwordHash = await argon2.hash(
    process.env.MOBILE_DEMO_PASSWORD || DEMO_PASSWORD,
  );
  const records = DEMO_ROLES.map((role, index) => ({
    id: isolated
      ? randomUUID()
      : `f1a50000-0000-4000-8000-00000000000${index + 1}`,
    fullName: `FlashGo ${role[0].toUpperCase() + role.slice(1)} ${run}`,
    email: `${role}.${run}@flashgo.example`,
    phoneNumber: isolated
      ? `+2519${Math.floor(10000000 + Math.random() * 89999999)}`
      : `+25190000000${index + 1}`,
    role,
    passwordHash,
    isVerified: true,
    verifiedAt: new Date(),
    status: 'active' as const,
  }));
  const ids = Object.fromEntries(
    records.map((user) => [user.role, user.id]),
  ) as Record<(typeof DEMO_ROLES)[number], string>;
  const categoryNameId = isolated
    ? randomUUID()
    : 'f1a50000-0000-4000-8000-000000000010';
  const categoryId = isolated
    ? randomUUID()
    : 'f1a50000-0000-4000-8000-000000000011';
  const itemId = isolated
    ? randomUUID()
    : 'f1a50000-0000-4000-8000-000000000012';
  await db.transaction(async (tx) => {
    for (const user of records)
      await tx
        .insert(users)
        .values(user)
        .onConflictDoUpdate({ target: users.id, set: user });
    await tx
      .insert(customerProfile)
      .values({
        userId: ids.customer,
        addresses: [
          {
            label: 'Home',
            address: 'Demo address, Bole, Addis Ababa',
            lat: 8.9948,
            lng: 38.7864,
            isDefault: true,
          },
        ],
      })
      .onConflictDoNothing();
    await tx
      .insert(businessProfile)
      .values({
        userId: ids.business,
        businessName: `FlashGo Demo Kitchen ${isolated ? run : ''}`.trim(),
        businessType: 'Restaurant',
        address: 'Demo kitchen, Bole, Addis Ababa',
        latitude: 8.9957,
        longitude: 38.7855,
        status: 'approved',
        approvedDate: new Date(),
      })
      .onConflictDoNothing();
    await tx
      .insert(driverProfile)
      .values({
        userId: ids.driver,
        vehicleType: 'Motorbike',
        licenseNumber: `DEMO-${run}`,
        isAvailable: true,
      })
      .onConflictDoNothing();
    await tx
      .insert(adminProfile)
      .values({ userId: ids.admin, level: 'super_admin' })
      .onConflictDoNothing();
    await tx
      .insert(categoryNameCatalog)
      .values({
        id: categoryNameId,
        name: `Demo favorites ${isolated ? run : ''}`.trim(),
      })
      .onConflictDoNothing();
    await tx
      .insert(productCategories)
      .values({ id: categoryId, categoryNameId, businessId: ids.business })
      .onConflictDoNothing();
    await tx
      .insert(categoryItems)
      .values({
        id: itemId,
        categoryId,
        name: 'Demo Tibs',
        description: 'Sample menu item for testing delivery.',
        price: '250.00',
        discount: '25.00',
      })
      .onConflictDoNothing();
  });
  return {
    accounts: records.map(({ passwordHash: _, ...record }) => record),
    ids,
    categoryNameId,
    categoryId,
    itemId,
  };
}
