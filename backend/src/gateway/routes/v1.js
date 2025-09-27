const express = require('express');
const { apiKeyAuth, requestLogger, gatewayRateLimit, apiKeyRateLimit } = require('../middlewares');
const ApiError = require('../../utils/ApiError');

const router = express.Router();

// Apply middleware stack to all /v1 routes
router.use(requestLogger);
// Skip express-rate-limit in test environment to avoid interference
if (process.env.NODE_ENV !== 'test') {
  router.use(gatewayRateLimit);
}
router.use(apiKeyAuth(['chat', 'models'])); // Require chat and models permissions
router.use(apiKeyRateLimit);

// Example /v1/models endpoint
router.get('/models', async (req, res) => {
  try {
    // Mock response for now - will be implemented in future tasks
    const models = [
      {
        id: 'gpt-3.5-turbo',
        object: 'model',
        created: 1677610602,
        owned_by: 'openai',
        permission: [],
        root: 'gpt-3.5-turbo',
        parent: null
      }
    ];

    res.json({
      object: 'list',
      data: models
    });
  } catch (error) {
    res.status(500).json({
      error: {
        message: 'Internal server error',
        type: 'internal_error',
        code: 'internal_server_error'
      }
    });
  }
});

// Example /v1/chat/completions endpoint
router.post('/chat/completions', async (req, res) => {
  try {
    const { model, messages, max_tokens, temperature, stream } = req.body;

    // Basic validation
    if (!model || !messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: {
          message: 'Missing required fields: model and messages',
          type: 'invalid_request_error',
          code: 'invalid_request'
        }
      });
    }

    // Check if API key can access this model
    if (!req.apiKey.canAccessModel(model)) {
      return res.status(403).json({
        error: {
          message: `Access denied for model: ${model}`,
          type: 'permission_error',
          code: 'model_access_denied'
        }
      });
    }

    // Mock response for now - will be implemented in future tasks
    const response = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a mock response from the gateway. Actual implementation will be added in future tasks.'
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      }
    };

    // Update API key usage
    await req.apiKey.updateUsage(response.usage.total_tokens);

    res.json(response);
  } catch (error) {
    res.status(500).json({
      error: {
        message: 'Internal server error',
        type: 'internal_error',
        code: 'internal_server_error'
      }
    });
  }
});

// Error handling middleware
router.use((err, req, res, next) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      message: err.message,
      type: err.type || 'error',
      code: err.code || 'unknown_error'
    });
  }

  // Handle other errors
  return res.status(500).json({
    message: 'Internal server error',
    type: 'internal_error',
    code: 'internal_server_error'
  });
});

module.exports = router;