/**
 * Secrets Management Routes
 * Admin routes for secrets manager and key rotation
 */

const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const secretsController = require('../controllers/secrets.controller');
const secretsValidation = require('../validations/secrets.validation');

const router = express.Router();

// All secrets management routes require admin authentication
router.use(auth('admin'));

// Secrets Manager Health and Status
router.get('/health', secretsController.getSecretsHealth);
router.post('/test-connection', secretsController.testSecretsConnection);
router.post('/clear-cache', secretsController.clearSecretsCache);

// Key Rotation Management
router.get('/key-rotation/status', secretsController.getKeyRotationStatus);
router.post('/key-rotation/perform', validate(secretsValidation.performKeyRotation), secretsController.performKeyRotation);
router.post('/key-rotation/test', secretsController.testKeyRotation);
router.get('/key-rotation/history', secretsController.getKeyRotationHistory);
router.post('/key-rotation/toggle', validate(secretsValidation.toggleKeyRotation), secretsController.toggleKeyRotation);

// Provider Credential Management
router.get('/providers/:providerId/credentials/metadata', validate(secretsValidation.providerParams), secretsController.getProviderCredentialMetadata);
router.post('/providers/:providerId/credentials/validate', validate(secretsValidation.providerParams), secretsController.validateProviderCredentials);

module.exports = router;