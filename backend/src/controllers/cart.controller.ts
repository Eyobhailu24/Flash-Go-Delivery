import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Context } from 'hono';
import { z } from 'zod';
import { db } from '../db.js';
import type { AuthUser } from '../middleware/auth.middleware.js';
import {
  carts,
  cartItems,
  categoryItems,
  productCategories,
} from '../schema.js';

type CartEnv = { Variables: { user: AuthUser } };
const MAX_CART_TOTAL_QUANTITY = 4;
const CART_QUANTITY_LIMIT_MESSAGE =
  "Dear customer please note that you can't place more than 4 items in a single order to insure proper delivery";

const cartIdParamSchema = z.object({
  id: z.string().uuid(),
});

const createCartSchema = z.object({
  businessId: z.string().uuid(),
});

const updateCartSchema = z.object({
  status: z.enum(['active', 'checked_out', 'abandoned']),
});

const addCartItemSchema = z.object({
  categoryItemId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  specialInstructions: z
    .string()
    .trim()
    .max(1000)
    .optional(),
});

const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().positive().optional(),
  specialInstructions: z
    .union([z.string().trim().max(1000), z.null()])
    .optional(),
});

const cartItemIdParamSchema = z.object({
  cartId: z.string().uuid(),
  itemId: z.string().uuid(),
});

function normalizeMoneyInput(v: string | null): number {
  if (v === null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toMoneyString(n: number): string {
  return n.toFixed(2);
}

function applyDiscountedPrice(
  price: string,
  discount: string | null,
): string {
  const priceNum = normalizeMoneyInput(price);
  const discountNum = normalizeMoneyInput(discount);
  return toMoneyString(Math.max(priceNum - discountNum, 0));
}

async function getOwnedCart(
  userId: string,
  cartId: string,
): Promise<typeof carts.$inferSelect | null> {
  const [existing] = await db
    .select()
    .from(carts)
    .where(
      and(
        eq(carts.id, cartId),
        eq(carts.customerId, userId),
      ),
    )
    .limit(1);
  return existing ?? null;
}

export const createCart = async (c: Context<CartEnv>) => {
  const parsed = createCartSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const customerId = c.var.user.id;
  const { businessId } = parsed.data;

  const [existing] = await db
    .select()
    .from(carts)
    .where(
      and(
        eq(carts.customerId, customerId),
        eq(carts.status, 'active'),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.businessId !== businessId) {
      const [existingCartItem] = await db
        .select({ id: cartItems.id })
        .from(cartItems)
        .where(eq(cartItems.cartId, existing.id))
        .limit(1);

      if (!existingCartItem) {
        const [reusedCart] = await db
          .update(carts)
          .set({ businessId })
          .where(eq(carts.id, existing.id))
          .returning();

        return c.json({ cart: reusedCart }, 200);
      }

      return c.json(
        {
          message:
            'You can only add an item from one place at a time.',
        },
        409,
      );
    }
    return c.json({ cart: existing }, 200);
  }

  const [created] = await db
    .insert(carts)
    .values({
      customerId,
      businessId,
      status: 'active',
    })
    .returning();

  return c.json({ cart: created }, 201);
};

export const getAllCarts = async (c: Context<CartEnv>) => {
  const statusQuery = c.req.query('status');
  const status =
    statusQuery === 'active' ||
    statusQuery === 'checked_out' ||
    statusQuery === 'abandoned'
      ? statusQuery
      : undefined;

  if (statusQuery && !status) {
    return c.json(
      { message: 'Invalid status query parameter.' },
      400,
    );
  }

  const rows = await db
    .select()
    .from(carts)
    .where(
      status
        ? and(
            eq(carts.customerId, c.var.user.id),
            eq(carts.status, status),
          )
        : eq(carts.customerId, c.var.user.id),
    )
    .orderBy(asc(carts.createdAt));

  return c.json({ carts: rows });
};

export const getCartById = async (c: Context<CartEnv>) => {
  const params = cartIdParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid cart id.' }, 400);
  }

  const cart = await getOwnedCart(
    c.var.user.id,
    params.data.id,
  );
  if (!cart) {
    return c.json({ message: 'Cart not found.' }, 404);
  }

  const items = await db
    .select()
    .from(cartItems)
    .where(eq(cartItems.cartId, cart.id))
    .orderBy(asc(cartItems.id));

  const subtotal = items.reduce(
    (sum, item) =>
      sum +
      normalizeMoneyInput(item.unitPrice) * item.quantity,
    0,
  );

  return c.json({
    cart,
    items,
    summary: {
      itemCount: items.length,
      totalQuantity: items.reduce(
        (sum, item) => sum + item.quantity,
        0,
      ),
      subtotal: toMoneyString(subtotal),
    },
  });
};

export const updateCart = async (c: Context<CartEnv>) => {
  const params = cartIdParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid cart id.' }, 400);
  }

  const body = updateCartSchema.safeParse(
    await c.req.json(),
  );
  if (!body.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const cart = await getOwnedCart(
    c.var.user.id,
    params.data.id,
  );
  if (!cart) {
    return c.json({ message: 'Cart not found.' }, 404);
  }

  const [updated] = await db
    .update(carts)
    .set({ status: body.data.status })
    .where(eq(carts.id, cart.id))
    .returning();

  return c.json({ cart: updated });
};

export const deleteCart = async (c: Context<CartEnv>) => {
  const params = cartIdParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid cart id.' }, 400);
  }

  const cart = await getOwnedCart(
    c.var.user.id,
    params.data.id,
  );
  if (!cart) {
    return c.json({ message: 'Cart not found.' }, 404);
  }

  const [deleted] = await db
    .delete(carts)
    .where(eq(carts.id, cart.id))
    .returning({ id: carts.id });

  return c.json({
    message: 'Cart deleted.',
    id: deleted.id,
  });
};

export const addCartItem = async (c: Context<CartEnv>) => {
  const params = cartIdParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid cart id.' }, 400);
  }

  const body = addCartItemSchema.safeParse(
    await c.req.json(),
  );
  if (!body.success) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }
  const cart = await getOwnedCart(
    c.var.user.id,
    params.data.id,
  );
  if (!cart) {
    return c.json({ message: 'Cart not found.' }, 404);
  }
  if (cart.status !== 'active') {
    return c.json(
      { message: 'Only active carts can be modified.' },
      409,
    );
  }

  const [catalogItem] = await db
    .select({
      id: categoryItems.id,
      price: categoryItems.price,
      discount: categoryItems.discount,
      isAvailable: categoryItems.isAvailable,
      businessId: productCategories.businessId,
    })
    .from(categoryItems)
    .innerJoin(
      productCategories,
      eq(categoryItems.categoryId, productCategories.id),
    )
    .where(eq(categoryItems.id, body.data.categoryItemId))
    .limit(1);

  if (!catalogItem || !catalogItem.isAvailable) {
    return c.json(
      {
        message: 'Category item not found or unavailable.',
      },
      404,
    );
  }
  if (catalogItem.businessId !== cart.businessId) {
    return c.json(
      {
        message:
          'You can only add an item from one place at a time.',
      },
      409,
    );
  }

  const effectivePrice = applyDiscountedPrice(
    catalogItem.price,
    catalogItem.discount,
  );

  const [existingItem] = await db
    .select()
    .from(cartItems)
    .where(
      and(
        eq(cartItems.cartId, cart.id),
        eq(
          cartItems.categoryItemId,
          body.data.categoryItemId,
        ),
      ),
    )
    .limit(1);

  const itemsInCart = await db
    .select({ quantity: cartItems.quantity })
    .from(cartItems)
    .where(eq(cartItems.cartId, cart.id));
  const currentTotalQuantity = itemsInCart.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const nextTotalQuantity =
    currentTotalQuantity + body.data.quantity;
  if (nextTotalQuantity > MAX_CART_TOTAL_QUANTITY) {
    return c.json(
      { message: CART_QUANTITY_LIMIT_MESSAGE },
      409,
    );
  }

  if (existingItem) {
    const [updated] = await db
      .update(cartItems)
      .set({
        quantity:
          existingItem.quantity + body.data.quantity,
        unitPrice: effectivePrice,
        specialInstructions:
          body.data.specialInstructions ??
          existingItem.specialInstructions,
      })
      .where(eq(cartItems.id, existingItem.id))
      .returning();

    return c.json({ item: updated });
  }

  const [created] = await db
    .insert(cartItems)
    .values({
      cartId: cart.id,
      categoryItemId: body.data.categoryItemId,
      quantity: body.data.quantity,
      unitPrice: effectivePrice,
      specialInstructions: body.data.specialInstructions,
    })
    .returning();

  return c.json({ item: created }, 201);
};

export const updateCartItem = async (
  c: Context<CartEnv>,
) => {
  const params = cartItemIdParamSchema.safeParse(
    c.req.param(),
  );
  if (!params.success) {
    return c.json(
      { message: 'Invalid cart id or cart item id.' },
      400,
    );
  }

  const body = updateCartItemSchema.safeParse(
    await c.req.json(),
  );
  if (
    !body.success ||
    Object.keys(body.data).length === 0
  ) {
    return c.json(
      { message: 'Invalid request payload.' },
      400,
    );
  }

  const cart = await getOwnedCart(
    c.var.user.id,
    params.data.cartId,
  );
  if (!cart) {
    return c.json({ message: 'Cart not found.' }, 404);
  }
  if (cart.status !== 'active') {
    return c.json(
      { message: 'Only active carts can be modified.' },
      409,
    );
  }

  const [existing] = await db
    .select()
    .from(cartItems)
    .where(
      and(
        eq(cartItems.id, params.data.itemId),
        eq(cartItems.cartId, cart.id),
      ),
    )
    .limit(1);

  if (!existing) {
    return c.json({ message: 'Cart item not found.' }, 404);
  }

  const patch: Partial<typeof cartItems.$inferInsert> = {};
  if (body.data.quantity !== undefined) {
    const itemsInCart = await db
      .select({
        id: cartItems.id,
        quantity: cartItems.quantity,
      })
      .from(cartItems)
      .where(eq(cartItems.cartId, cart.id));
    const otherItemsTotal = itemsInCart
      .filter((item) => item.id !== existing.id)
      .reduce((sum, item) => sum + item.quantity, 0);
    const nextTotalQuantity =
      otherItemsTotal + body.data.quantity;
    if (nextTotalQuantity > MAX_CART_TOTAL_QUANTITY) {
      return c.json(
        { message: CART_QUANTITY_LIMIT_MESSAGE },
        409,
      );
    }
    patch.quantity = body.data.quantity;
  }
  if (body.data.specialInstructions !== undefined) {
    patch.specialInstructions =
      body.data.specialInstructions;
  }

  const [updated] = await db
    .update(cartItems)
    .set(patch)
    .where(eq(cartItems.id, existing.id))
    .returning();

  return c.json({ item: updated });
};

export const removeCartItem = async (
  c: Context<CartEnv>,
) => {
  const params = cartItemIdParamSchema.safeParse(
    c.req.param(),
  );
  if (!params.success) {
    return c.json(
      { message: 'Invalid cart id or cart item id.' },
      400,
    );
  }

  const cart = await getOwnedCart(
    c.var.user.id,
    params.data.cartId,
  );
  if (!cart) {
    return c.json({ message: 'Cart not found.' }, 404);
  }
  if (cart.status !== 'active') {
    return c.json(
      { message: 'Only active carts can be modified.' },
      409,
    );
  }

  const [removed] = await db
    .delete(cartItems)
    .where(
      and(
        eq(cartItems.id, params.data.itemId),
        eq(cartItems.cartId, cart.id),
      ),
    )
    .returning({ id: cartItems.id });

  if (!removed) {
    return c.json({ message: 'Cart item not found.' }, 404);
  }

  const [remainingItem] = await db
    .select({ id: cartItems.id })
    .from(cartItems)
    .where(eq(cartItems.cartId, cart.id))
    .limit(1);

  if (!remainingItem) {
    await db
      .update(carts)
      .set({ status: 'abandoned' })
      .where(eq(carts.id, cart.id));
  }

  return c.json({
    message: 'Cart item removed.',
    id: removed.id,
  });
};

export const clearCart = async (c: Context<CartEnv>) => {
  const params = cartIdParamSchema.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ message: 'Invalid cart id.' }, 400);
  }

  const cart = await getOwnedCart(
    c.var.user.id,
    params.data.id,
  );
  if (!cart) {
    return c.json({ message: 'Cart not found.' }, 404);
  }
  if (cart.status !== 'active') {
    return c.json(
      { message: 'Only active carts can be modified.' },
      409,
    );
  }

  const existingItems = await db
    .select({ id: cartItems.id })
    .from(cartItems)
    .where(eq(cartItems.cartId, cart.id));

  if (existingItems.length === 0) {
    return c.json({ message: 'Cart is already empty.' });
  }

  await db.delete(cartItems).where(
    inArray(
      cartItems.id,
      existingItems.map((item) => item.id),
    ),
  );

  await db
    .update(carts)
    .set({ status: 'abandoned' })
    .where(eq(carts.id, cart.id));

  return c.json({ message: 'Cart cleared.' });
};
