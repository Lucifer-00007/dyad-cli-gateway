/**
 * Spawn-CLI Adapter
 * Executes CLI commands in a sandboxed Docker container
 */

const BaseAdapter = require('./base.adapter');
const DockerSandbox = require('../utils/docker-sandbox');
const logger = require('../../config/logger');
const crypto = require('crypto');

class SpawnCliAdapter extends BaseAdapter {
  constructor(providerConfig, credentials) {
    super(providerConfig, credentials);
    
    this.supportsStreaming = false; // CLI adapters typically don't support streaming
    
    // Initialize Docker sandbox
    this.sandbox = new DockerSandbox({
      image: providerConfig.sandboxImage || 'alpine:latest',
      timeout: (providerConfig.timeoutSeconds || 60) * 1000,
      memoryLimit: providerConfig.memoryLimit || '512m',
      cpuLimit: providerConfig.cpuLimit || '0.5'
    });
    
    // Validate required config
    if (!providerConfig.command) {
      throw new Error('SpawnCliAdapter requires command in providerConfig');
    }
  }

  /**
   * Handle chat completion request
   */
  async handleChat({ messages, options, requestMeta, signal }) {
    const requestId = requestMeta?.requestId || crypto.randomBytes(8).toString('hex');
    
    logger.info('SpawnCliAdapter handling chat request', {
      requestId,
      messageCount: messages.length,
      command: this.providerConfig.command
    });

    try {
      // Prepare input for CLI command
      const input = this.prepareInput(messages, options);
      
      // Execute command in sandbox
      const result = await this.sandbox.execute(
        this.providerConfig.command,
        this.providerConfig.args || [],
        {
          input,
          signal,
          timeout: (this.providerConfig.timeoutSeconds || 60) * 1000,
          image: this.providerConfig.sandboxImage
        }
      );

      if (!result.success) {
        throw new Error(`CLI command failed with exit code ${result.exitCode}: ${result.stderr}`);
      }

      // Parse and normalize the output
      return this.parseOutput(result.stdout, requestId);
      
    } catch (error) {
      logger.error('SpawnCliAdapter chat request failed', {
        requestId,
        error: error.message,
        command: this.providerConfig.command
      });
      throw error;
    }
  }

  /**
   * Handle embeddings request (not supported by default CLI adapter)
   */
  async handleEmbeddings({ input, options }) {
    throw new Error('Embeddings not supported by SpawnCliAdapter');
  }

  /**
   * Test adapter connectivity
   */
  async testConnection() {
    try {
      // Test with a simple echo command
      const testMessages = [
        { role: 'user', content: 'test connection' }
      ];
      
      const result = await this.handleChat({
        messages: testMessages,
        options: { max_tokens: 10 },
        requestMeta: { requestId: 'test-connection' }
      });

      return {
        success: true,
        message: 'Connection test successful',
        details: {
          responseReceived: !!result,
          hasContent: !!(result.choices && result.choices[0] && result.choices[0].message)
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Connection test failed',
        error: error.message
      };
    }
  }

  /**
   * Get adapter models
   */
  getModels() {
    // Return models from provider config
    return this.providerConfig.models || [];
  }

  /**
   * Validate adapter configuration
   */
  validateConfig() {
    const errors = [];
    
    if (!this.providerConfig.command) {
      errors.push('command is required');
    }
    
    if (this.providerConfig.timeoutSeconds !== undefined && this.providerConfig.timeoutSeconds < 1) {
      errors.push('timeoutSeconds must be at least 1');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Prepare input for CLI command
   * @param {Array} messages - Chat messages
   * @param {Object} options - Chat options
   * @returns {string} - Formatted input
   */
  prepareInput(messages, options) {
    // For echo adapter, we'll send JSON input
    const input = {
      messages,
      options: options || {}
    };
    
    return JSON.stringify(input, null, 2);
  }

  /**
   * Parse CLI output into OpenAI-compatible response
   * @param {string} output - Raw CLI output
   * @param {string} requestId - Request ID
   * @returns {Object} - OpenAI-compatible response
   */
  parseOutput(output, requestId) {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(output);
      
      // If it's already in OpenAI format, return it
      if (parsed.choices && Array.isArray(parsed.choices)) {
        return {
          id: requestId,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: this.providerConfig.models?.[0]?.dyadModelId || 'unknown',
          ...parsed
        };
      }
    } catch (error) {
      // Not JSON, treat as plain text
    }

    // For echo adapter, create a simple response that echoes back the input
    const lastMessage = output.trim();
    
    return {
      id: requestId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: this.providerConfig.models?.[0]?.dyadModelId || 'echo-model',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: `Echo: ${lastMessage}`
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: this.estimateTokens(output),
        completion_tokens: this.estimateTokens(`Echo: ${lastMessage}`),
        total_tokens: this.estimateTokens(output) + this.estimateTokens(`Echo: ${lastMessage}`)
      }
    };
  }

  /**
   * Simple token estimation (rough approximation)
   * @param {string} text - Text to estimate tokens for
   * @returns {number} - Estimated token count
   */
  estimateTokens(text) {
    if (!text) return 0;
    // Rough approximation: 1 token per 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Docker containers are automatically cleaned up with --rm flag
    // No additional cleanup needed
  }
}

module.exports = SpawnCliAdapter;