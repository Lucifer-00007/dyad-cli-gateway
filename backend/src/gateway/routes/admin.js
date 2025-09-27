const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { adminController } = require('../controllers');
const { providerValidation } = require('../validations');
const { requestLogger, errorConverter, errorHandler } = require('../middlewares');

const router = express.Router();

// Apply middleware stack to all admin routes
router.use(requestLogger);

// Add request start time for duration tracking
router.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// All admin routes require JWT authentication with admin role
router.use(auth('manageUsers')); // Using existing admin permission

// Provider management routes
router
  .route('/providers')
  .get(validate(providerValidation.getProviders), adminController.getProviders)
  .post(validate(providerValidation.createProvider), adminController.createProvider);

router
  .route('/providers/:providerId')
  .get(validate(providerValidation.getProvider), adminController.getProvider)
  .patch(validate(providerValidation.updateProvider), adminController.updateProvider)
  .delete(validate(providerValidation.deleteProvider), adminController.deleteProvider);

// Provider testing endpoint
router.post('/providers/:providerId/test', validate(providerValidation.testProvider), adminController.testProvider);

// Provider health check endpoint
router.post('/providers/:providerId/health', validate(providerValidation.checkProviderHealth), adminController.checkProviderHealth);

// Error handling middleware
router.use(errorConverter);
router.use(errorHandler);

module.exports = router;