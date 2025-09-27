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
router.use(apiKeyRateLimit);

// Add request start time for duration tracking
router.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// OpenAI-compatible endpoints with specific permission requirements
router.get('/models', apiKeyAuth(['models']), v1Controller.getModels);
router.post('/chat/completions', apiKeyAuth(['chat']), v1Controller.chatCompletions);
router.post('/embeddings', apiKeyAuth(['embeddings']), v1Controller.embeddings);

// Error handling middleware (OpenAI-compatible format)
router.use(errorConverter);
router.use(errorHandler);

module.exports = router;