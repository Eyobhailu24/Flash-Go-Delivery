import { Hono } from 'hono';
import {
  addCartItem,
  clearCart,
  createCart,
  deleteCart,
  getAllCarts,
  getCartById,
  removeCartItem,
  updateCart,
  updateCartItem,
} from '../controllers/cart.controller.js';
import {
  protect,
  restrictTo,
  type AuthUser,
} from '../middleware/auth.middleware.js';

type Env = { Variables: { user: AuthUser } };

export const cartRoutes = new Hono<Env>();

cartRoutes.use('*', protect);
cartRoutes.use('*', restrictTo('customer', 'admin'));

cartRoutes.get('/', getAllCarts);
cartRoutes.get('/:id', getCartById);
cartRoutes.post('/', createCart);
cartRoutes.patch('/:id', updateCart);
cartRoutes.delete('/:id', deleteCart);

cartRoutes.post('/:id/items', addCartItem);
cartRoutes.patch('/:cartId/items/:itemId', updateCartItem);
cartRoutes.delete('/:cartId/items/:itemId', removeCartItem);
cartRoutes.delete('/:id/items', clearCart);
