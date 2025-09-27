/**
 * BaseAdapter - Abstract base class for all gateway adapters
 * Defines the standard interface that all adapters must implement
 */

class BaseAdapter {
  constructor(providerConfig, credentials) {
    if (this.constructor === BaseAdapter) {
      throw new Error('BaseAdapter is abstract and cannot be instantiated directly');
    }
    
    this.providerConfig = providerConfig;
    this.credentials = credentials;
    this.supportsStreaming = false; // Override in subclasses
  }

  /**
   * Handle chat completion request
   * @param {Object} params - Chat parameters
   * @param {Array} params.messages - Array of chat messages
   * @param {Object} params.options - Chat options (max_tokens, temperature, etc.)
   * @param {Object} params.requestMeta - Request metadata (requestId, etc.)
   * @param {AbortSignal} params.signal - Cancellation signal
   * @returns {Promise<Object>} - Chat completion response
   */
  async handleChat({ messages, options, requestMeta, signal }) {
    throw new Error('handleChat method must be implemented by subclass');
  }

  /**
   * Handle embeddings request
   * @param {Object} params - Embeddings parameters
   * @param {string|Array} params.input - Input text or array of texts
   * @param {Object} params.options - Embeddings options
   * @returns {Promise<Object>} - Embeddings response
   */
  async handleEmbeddings({ input, options }) {
    throw new Error('handleEmbeddings method must be implemented by subclass');
  }

  /**
   * Test adapter connectivity and configuration
   * @returns {Promise<Object>} - Test result with status and details
   */
  async testConnection() {
    throw new Error('testConnection method must be implemented by subclass');
  }

  /**
   * Get adapter-specific model information
   * @returns {Array} - Array of model objects with metadata
   */
  getModels() {
    throw new Error('getModels method must be implemented by subclass');
  }

  /**
   * Validate adapter configuration
   * @returns {Object} - Validation result
   */
  validateConfig() {
    return {
      valid: true,
      errors: []
    };
  }

  /**
   * Clean up resources (override if needed)
   */
  async cleanup() {
    // Default implementation - no cleanup needed
  }
}

module.exports = BaseAdapter;