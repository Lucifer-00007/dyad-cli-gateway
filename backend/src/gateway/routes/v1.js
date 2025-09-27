const express = require('express');
const { apiKeyAuth, requestLogger, gatewayRateLimit, apiKeyRateLimit, errorConverter, errorHandler } = require('../middlewares');
const { v1Controller } = require('../controllers');

const router = express.Router();

// Apply middleware stack to all /v1 routes
router.use(requestLogger);
// Skip express-rate-limit in test environment to avoid interference
if (process.env.NODE_ENV !== 'test') {
  router.use(gatewayRateLimit);
}
router.use(apiKeyAuth(['chat', 'models'])); // Require chat and models permissions
router.use(apiKeyRateLimit);

// Add request start time for duration tracking
router.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// OpenAI-compatible endpoints
router.get('/models', v1Controller.getModels);
router.post('/chat/completions', v1Controller.chatCompletions);
router.post('/embeddings', v1Controller.embeddings);

// Error handling middleware (OpenAI-compatible format)
router.use(errorConverter);
router.use(errorHandler);

module.exports = router;