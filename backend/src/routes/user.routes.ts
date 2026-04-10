import { Hono } from 'hono';
import {
  createUser,
  deleteUser,
  getAllUsers,
  getUserById,
  updateUser,
} from '../controllers/user.controller.js';
import {
  protect,
  restrictTo,
  type AuthUser,
} from '../middleware/auth.middleware.js';

type Env = { Variables: { user: AuthUser } };

export const userRoutes = new Hono<Env>();

userRoutes.use('*', protect);
userRoutes.use('*', restrictTo('admin'));

userRoutes.get('/', getAllUsers);
userRoutes.get('/:id', getUserById);
userRoutes.post('/', createUser);
userRoutes.patch('/:id', updateUser);
userRoutes.delete('/:id', deleteUser);
