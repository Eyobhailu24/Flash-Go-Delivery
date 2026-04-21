import { Hono } from 'hono';
import {
  createAdminProfile,
  deleteAdminProfile,
  getAdminProfileById,
  getAllAdminProfiles,
  updateAdminProfile,
} from '../controllers/adminProfile.controller.js';
import {
  createBusinessProfile,
  deleteBusinessProfile,
  getAllBusinessProfiles,
  getBusinessProfileById,
  updateBusinessProfile,
} from '../controllers/businessProfile.controller.js';
import {
  createCustomerProfile,
  deleteCustomerProfile,
  getAllCustomerProfiles,
  getCustomerProfileById,
  updateCustomerProfile,
} from '../controllers/customerProfile.controller.js';
import {
  createDriverProfile,
  deleteDriverProfile,
  getAllDriverProfiles,
  getDriverProfileById,
  updateDriverProfile,
} from '../controllers/driverProfile.controller.js';
import {
  protect,
  restrictTo,
  type AuthUser,
} from '../middleware/auth.middleware.js';

type Env = { Variables: { user: AuthUser } };

const adminProfiles = new Hono<Env>();
adminProfiles.use('*', protect);
adminProfiles.use('*', restrictTo('admin'));
adminProfiles.get('/', getAllAdminProfiles);
adminProfiles.get('/:id', getAdminProfileById);
adminProfiles.post('/', createAdminProfile);
adminProfiles.patch('/:id', updateAdminProfile);
adminProfiles.delete('/:id', deleteAdminProfile);

const customerProfiles = new Hono<Env>();
customerProfiles.use('*', protect);
customerProfiles.use('*', restrictTo('admin'));
customerProfiles.get('/', getAllCustomerProfiles);
customerProfiles.get('/:id', getCustomerProfileById);
customerProfiles.post('/', createCustomerProfile);
customerProfiles.patch('/:id', updateCustomerProfile);
customerProfiles.delete('/:id', deleteCustomerProfile);

const driverProfiles = new Hono<Env>();
driverProfiles.use('*', protect);
driverProfiles.use('*', restrictTo('admin'));
driverProfiles.get('/', getAllDriverProfiles);
driverProfiles.get('/:id', getDriverProfileById);
driverProfiles.post('/', createDriverProfile);
driverProfiles.patch('/:id', updateDriverProfile);
driverProfiles.delete('/:id', deleteDriverProfile);

const businessProfiles = new Hono<Env>();
businessProfiles.use('*', protect);
businessProfiles.get('/', restrictTo('admin'), getAllBusinessProfiles);
businessProfiles.post('/', restrictTo('admin'), createBusinessProfile);
businessProfiles.get(
  '/:id',
  restrictTo('admin', 'business'),
  getBusinessProfileById,
);
businessProfiles.patch(
  '/:id',
  restrictTo('admin', 'business'),
  updateBusinessProfile,
);
businessProfiles.delete(
  '/:id',
  restrictTo('admin'),
  deleteBusinessProfile,
);

export const profileRoutes = new Hono();
profileRoutes.route('/admin', adminProfiles);
profileRoutes.route('/customers', customerProfiles);
profileRoutes.route('/drivers', driverProfiles);
profileRoutes.route('/businesses', businessProfiles);
