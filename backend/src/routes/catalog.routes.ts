import { Hono } from 'hono';
import {
  createCategoryItem,
  deleteCategoryItem,
  getAllCategoryItems,
  getCategoryItemById,
  updateCategoryItem,
} from '../controllers/categoryItems.controller.js';
import {
  createProductCategory,
  deleteProductCategory,
  getAllProductCategories,
  getProductCategoryById,
  updateProductCategory,
} from '../controllers/productCatergories.controller.js';
import type { CatalogEnv } from '../lib/catalogAccess.js';
import { protect, restrictTo } from '../middleware/auth.middleware.js';

const categories = new Hono<CatalogEnv>();
categories.use('*', protect);
categories.use('*', restrictTo('business', 'admin'));
categories.get('/', getAllProductCategories);
categories.get('/:id', getProductCategoryById);
categories.post('/', createProductCategory);
categories.patch('/:id', updateProductCategory);
categories.delete('/:id', deleteProductCategory);

const items = new Hono<CatalogEnv>();
items.use('*', protect);
items.use('*', restrictTo('business', 'admin'));
items.get('/', getAllCategoryItems);
items.get('/:id', getCategoryItemById);
items.post('/', createCategoryItem);
items.patch('/:id', updateCategoryItem);
items.delete('/:id', deleteCategoryItem);

export const catalogRoutes = new Hono();
catalogRoutes.route('/product-categories', categories);
catalogRoutes.route('/category-items', items);
