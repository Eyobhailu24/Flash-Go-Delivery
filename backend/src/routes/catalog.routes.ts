import { Hono } from 'hono';
import {
  createCategoryItem,
  deleteCategoryItem,
  getAllCategoryItems,
  getCategoryItemById,
  updateCategoryItem,
} from '../controllers/categoryItems.controller.js';
import {
  createCategoryName,
  deleteCategoryName,
  getAllCategoryNames,
  getCategoryNameById,
  getPublicCategoryNames,
  updateCategoryName,
} from '../controllers/categoryNameCatalog.controller.js';
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
items.get('/', getAllCategoryItems);
items.get('/:id', getCategoryItemById);
items.post('*', protect, restrictTo('business', 'admin'));
items.patch('*', protect, restrictTo('business', 'admin'));
items.delete('*', protect, restrictTo('business', 'admin'));
items.post('/', createCategoryItem);
items.patch('/:id', updateCategoryItem);
items.delete('/:id', deleteCategoryItem);

const categoryNames = new Hono<CatalogEnv>();
categoryNames.use('*', protect);
categoryNames.use('*', restrictTo('business', 'admin'));
categoryNames.get('/', getAllCategoryNames);
categoryNames.get('/:id', getCategoryNameById);
categoryNames.post('/', restrictTo('admin'), createCategoryName);
categoryNames.patch(
  '/:id',
  restrictTo('admin'),
  updateCategoryName,
);
categoryNames.delete(
  '/:id',
  restrictTo('admin'),
  deleteCategoryName,
);

const publicCatalog = new Hono();
publicCatalog.get('/category-names', getPublicCategoryNames);

export const catalogRoutes = new Hono();
catalogRoutes.route('/product-categories', categories);
catalogRoutes.route('/category-items', items);
catalogRoutes.route('/category-name-catalog', categoryNames);
catalogRoutes.route('/public', publicCatalog);
