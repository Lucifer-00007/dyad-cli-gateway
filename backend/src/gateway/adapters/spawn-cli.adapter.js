/**
 * Spawn-CLI Adapter
 * Executes CLI commands in a sandboxed Docker container
 */

const BaseAdapter = require('./base.adapter');
const DockerSandbox = require('../utils/docker-sandbox');
const logger = require('../../config/logger');
const monitoringService = require('../services/monitoring.service');
const structuredLogger = require('../services/structured-logger.service');
const crypto = require('crypto');

class SpawnCliAdapter extends BaseAdapter {
  constructor(providerConfig, credentials) {
    super(providerConfig, credentials);
    
    // Enable streaming if explicitly configured
    this.supportsStreaming = providerConfig.supportsStreaming === true;
    
    // Initialize Docker sandbox if enabled
    this.useDocker = providerConfig.dockerSandbox !== false;
    if (this.useDocker) {
      this.sandbox = new DockerSandbox({
        image: providerConfig.sandboxImage || 'alpine:latest',
        timeout: (providerConfig.timeoutSeconds || 60) * 1000,
        memoryLimit: providerConfig.memoryLimit || '512m',
        cpuLimit: providerConfig.cpuLimit || '0.5'
      });
    }
    
    // Validate required config
    if (!providerConfig.command) {
      throw new Error('SpawnCliAdapter requires command in providerConfig');
    }
  }

  /**
   * Handle chat completion request
   */
  async handleChat({ messages, options, requestMeta, signal, stream = false }) {
    const requestId = requestMeta?.requestId || crypto.randomBytes(8).toString('hex');
    
    logger.info('SpawnCliAdapter handling chat request', {
      requestId,
      messageCount: messages.length,
      command: this.providerConfig.command,
      stream
    });

    // If streaming is requested but not supported, fall back to non-streaming
    if (stream && !this.supportsStreaming) {
      logger.warn('Streaming requested but not supported by adapter, falling back to non-streaming', {
        requestId,
        command: this.providerConfig.command
      });
      stream = false;
    }

    if (stream) {
      return this.handleChatStream({ messages, options, requestMeta, signal });
    }

    try {
      // Prepare input for CLI command
      const input = this.prepareInput(messages, options, stream);
      
      let result;
      
      if (this.useDocker) {
        // Execute command in Docker sandbox
        result = await this.sandbox.execute(
          this.providerConfig.command,
          this.providerConfig.args || [],
          {
            input,
            signal,
            timeout: (this.providerConfig.timeoutSeconds || 60) * 1000,
            image: this.providerConfig.sandboxImage
          }
        );
      } else {
        // Execute command directly (for testing or when Docker is not available)
        result = await this.executeDirectly(
          this.providerConfig.command,
          this.providerConfig.args || [],
          {
            input,
            signal,
            timeout: (this.providerConfig.timeoutSeconds || 60) * 1000
          }
        );
      }

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
   * Handle streaming chat completion request
   */
  async *handleChatStream({ messages, options, requestMeta, signal }) {
    const requestId = requestMeta?.requestId || crypto.randomBytes(8).toString('hex');
    
    if (!this.supportsStreaming) {
      throw new Error('Streaming not supported by this adapter');
    }

    logger.info('SpawnCliAdapter handling streaming chat request', {
      requestId,
      messageCount: messages.length,
      command: this.providerConfig.command
    });

    try {
      // Prepare input for CLI command with streaming flag
      const input = this.prepareInput(messages, options, true);
      
      if (this.useDocker) {
        // Execute command in Docker sandbox with streaming
        yield* this.sandbox.executeStream(
          this.providerConfig.command,
          this.providerConfig.args || [],
          {
            input,
            signal,
            timeout: (this.providerConfig.timeoutSeconds || 60) * 1000,
            image: this.providerConfig.sandboxImage,
            requestId
          }
        );
      } else {
        // Execute command directly with streaming
        yield* this.executeDirectlyStream(
          this.providerConfig.command,
          this.providerConfig.args || [],
          {
            input,
            signal,
            timeout: (this.providerConfig.timeoutSeconds || 60) * 1000,
            requestId
          }
        );
      }
      
    } catch (error) {
      logger.error('SpawnCliAdapter streaming chat request failed', {
        requestId,
        error: error.message,
        command: this.providerConfig.command
      });
      throw error;
    }
  }

  /**
   * Handle embeddings request
   */
  async handleEmbeddings({ input, options }) {
    const requestId = crypto.randomBytes(8).toString('hex');
    
    logger.info('SpawnCliAdapter handling embeddings request', {
      requestId,
      inputType: Array.isArray(input) ? 'array' : 'string',
      inputLength: Array.isArray(input) ? input.length : input.length,
      command: this.providerConfig.command
    });

    try {
      // Check if embeddings are supported by this provider configuration
      if (!this.providerConfig.supportsEmbeddings) {
        throw new Error('Embeddings not supported by this CLI adapter configuration');
      }

      // Prepare input for CLI command
      const embeddingsInput = this.prepareEmbeddingsInput(input, options);
      
      let result;
      
      if (this.useDocker) {
        // Execute command in Docker sandbox
        result = await this.sandbox.execute(
          this.providerConfig.command,
          [...(this.providerConfig.args || []), '--embeddings'],
          {
            input: embeddingsInput,
            timeout: (this.providerConfig.timeoutSeconds || 60) * 1000,
            image: this.providerConfig.sandboxImage
          }
        );
      } else {
        // Execute command directly (for testing or when Docker is not available)
        result = await this.executeDirectly(
          this.providerConfig.command,
          [...(this.providerConfig.args || []), '--embeddings'],
          {
            input: embeddingsInput,
            timeout: (this.providerConfig.timeoutSeconds || 60) * 1000
          }
        );
      }

      if (!result.success) {
        throw new Error(`CLI embeddings command failed with exit code ${result.exitCode}: ${result.stderr}`);
      }

      // Parse and normalize the output
      return this.parseEmbeddingsOutput(result.stdout, requestId);
      
    } catch (error) {
      logger.error('SpawnCliAdapter embeddings request failed', {
        requestId,
        error: error.message,
        command: this.providerConfig.command
      });
      throw error;
    }
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
   * @param {boolean} stream - Whether this is for streaming
   * @returns {string} - Formatted input
   */
  prepareInput(messages, options, stream = false) {
    // For echo adapter, we'll send JSON input
    const input = {
      messages,
      options: options || {},
      stream
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
   * Execute command directly without Docker (for testing or when Docker unavailable)
   * @param {string} command - Command to execute
   * @param {Array} args - Command arguments
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Execution result
   */
  async executeDirectly(command, args = [], options = {}) {
    const { spawn } = require('child_process');
    const timeout = options.timeout || 30000;
    const input = options.input || '';
    
    logger.info('Direct command execution', {
      command: this.sanitizeForLogging(command),
      args: args.map(arg => this.sanitizeForLogging(arg)),
      timeout
    });

    return new Promise((resolve, reject) => {
      let isResolved = false;
      let timeoutId;
      let childProcess;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (childProcess && !childProcess.killed) {
          childProcess.kill('SIGTERM');
        }
      };

      const resolveOnce = (result) => {
        if (isResolved) return;
        isResolved = true;
        cleanup();
        resolve(result);
      };

      const rejectOnce = (error) => {
        if (isResolved) return;
        isResolved = true;
        cleanup();
        reject(error);
      };

      // Set up timeout
      timeoutId = setTimeout(() => {
        logger.warn('Direct command execution timeout', { command, timeout });
        rejectOnce(new Error(`Command execution timeout after ${timeout}ms`));
      }, timeout);

      // Handle cancellation signal
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          logger.info('Direct command execution cancelled', { command });
          rejectOnce(new Error('Command execution cancelled'));
        });
      }

      // Spawn process
      childProcess = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      // Collect stdout
      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Collect stderr
      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process completion
      childProcess.on('close', (code) => {
        logger.info('Direct command execution completed', {
          command,
          exitCode: code,
          stdoutLength: stdout.length,
          stderrLength: stderr.length
        });

        resolveOnce({
          exitCode: code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          success: code === 0
        });
      });

      // Handle process errors
      childProcess.on('error', (error) => {
        logger.error('Direct command execution error', {
          command,
          error: error.message
        });
        rejectOnce(error);
      });

      // Send input to stdin if provided
      if (input) {
        childProcess.stdin.write(input);
      }
      childProcess.stdin.end();
    });
  }

  /**
   * Sanitize sensitive data for logging
   * @param {string} text - Text to sanitize
   * @returns {string} - Sanitized text
   */
  sanitizeForLogging(text) {
    if (typeof text !== 'string') {
      return text;
    }
    
    // Replace potential sensitive patterns
    return text
      .replace(/--?api[_-]?key[=\s]+[^\s]+/gi, '--api-key=***')
      .replace(/--?token[=\s]+[^\s]+/gi, '--token=***')
      .replace(/--?password[=\s]+[^\s]+/gi, '--password=***')
      .replace(/--?secret[=\s]+[^\s]+/gi, '--secret=***');
  }

  /**
   * Execute command directly with streaming support
   * @param {string} command - Command to execute
   * @param {Array} args - Command arguments
   * @param {Object} options - Execution options
   * @returns {AsyncGenerator} - Stream of response chunks
   */
  async *executeDirectlyStream(command, args = [], options = {}) {
    const { spawn } = require('child_process');
    const timeout = options.timeout || 30000;
    const input = options.input || '';
    const requestId = options.requestId;
    
    logger.info('Direct command execution with streaming', {
      command: this.sanitizeForLogging(command),
      args: args.map(arg => this.sanitizeForLogging(arg)),
      timeout,
      requestId
    });

    let childProcess;
    let isFinished = false;
    let timeoutId;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (childProcess && !childProcess.killed) {
        logger.info('Killing child process due to cleanup', { requestId, command });
        childProcess.kill('SIGTERM');
        // Force kill after grace period
        setTimeout(() => {
          if (!childProcess.killed) {
            logger.warn('Force killing child process', { requestId, command });
            childProcess.kill('SIGKILL');
          }
        }, 2000);
      }
    };

    try {
      // Set up timeout
      timeoutId = setTimeout(() => {
        logger.warn('Direct command execution timeout during streaming', { command, timeout, requestId });
        isFinished = true;
        cleanup();
      }, timeout);

      // Handle cancellation signal
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          logger.info('Direct command execution cancelled during streaming', { command, requestId });
          isFinished = true;
          cleanup();
        });
      }

      // Spawn process
      childProcess = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stderr = '';

      // Collect stderr
      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Send input to stdin if provided
      if (input) {
        childProcess.stdin.write(input);
      }
      childProcess.stdin.end();

      // Stream stdout data
      let buffer = '';
      let chunkIndex = 0;

      for await (const chunk of childProcess.stdout) {
        if (isFinished) break;

        buffer += chunk.toString();
        
        // Try to parse complete JSON lines for streaming
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              // Try to parse as streaming JSON
              const parsed = JSON.parse(line.trim());
              if (parsed.type === 'chunk' || parsed.delta) {
                yield this.formatStreamChunk(parsed, requestId, chunkIndex++);
              }
            } catch (e) {
              // Not JSON, treat as text chunk
              yield this.formatTextChunk(line.trim(), requestId, chunkIndex++);
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim() && !isFinished) {
        try {
          const parsed = JSON.parse(buffer.trim());
          if (parsed.type === 'chunk' || parsed.delta) {
            yield this.formatStreamChunk(parsed, requestId, chunkIndex++);
          }
        } catch (e) {
          yield this.formatTextChunk(buffer.trim(), requestId, chunkIndex++);
        }
      }

      // Wait for process to complete
      await new Promise((resolve, reject) => {
        childProcess.on('close', (code) => {
          logger.info('Direct command execution completed during streaming', {
            command,
            exitCode: code,
            stderrLength: stderr.length,
            requestId
          });

          if (code !== 0) {
            reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
          } else {
            resolve();
          }
        });

        childProcess.on('error', (error) => {
          logger.error('Direct command execution error during streaming', {
            command,
            error: error.message,
            requestId
          });
          reject(error);
        });
      });

      // Send final chunk
      yield this.formatFinalChunk(requestId);

    } finally {
      isFinished = true;
      cleanup();
    }
  }

  /**
   * Format streaming chunk for OpenAI compatibility
   * @param {Object} parsed - Parsed chunk data
   * @param {string} requestId - Request ID
   * @param {number} index - Chunk index
   * @returns {Object} - Formatted chunk
   */
  formatStreamChunk(parsed, requestId, index) {
    return {
      id: requestId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: this.providerConfig.models?.[0]?.dyadModelId || 'unknown',
      choices: [{
        index: 0,
        delta: parsed.delta || { content: parsed.content || '' },
        finish_reason: parsed.finish_reason || null
      }]
    };
  }

  /**
   * Format text chunk for OpenAI compatibility
   * @param {string} text - Text content
   * @param {string} requestId - Request ID
   * @param {number} index - Chunk index
   * @returns {Object} - Formatted chunk
   */
  formatTextChunk(text, requestId, index) {
    return {
      id: requestId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: this.providerConfig.models?.[0]?.dyadModelId || 'unknown',
      choices: [{
        index: 0,
        delta: { content: text },
        finish_reason: null
      }]
    };
  }

  /**
   * Format final chunk to indicate completion
   * @param {string} requestId - Request ID
   * @returns {Object} - Final chunk
   */
  formatFinalChunk(requestId) {
    return {
      id: requestId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: this.providerConfig.models?.[0]?.dyadModelId || 'unknown',
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'stop'
      }]
    };
  }

  /**
   * Prepare input for CLI embeddings command
   * @param {string|Array} input - Input text(s) for embeddings
   * @param {Object} options - Embeddings options
   * @returns {string} - Formatted input
   */
  prepareEmbeddingsInput(input, options) {
    // For embeddings, we'll send JSON input
    const embeddingsInput = {
      input,
      options: options || {},
      type: 'embeddings'
    };
    
    return JSON.stringify(embeddingsInput, null, 2);
  }

  /**
   * Parse CLI embeddings output into OpenAI-compatible response
   * @param {string} output - Raw CLI output
   * @param {string} requestId - Request ID
   * @returns {Object} - OpenAI-compatible embeddings response
   */
  parseEmbeddingsOutput(output, requestId) {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(output);
      
      // If it's already in OpenAI embeddings format, return it
      if (parsed.object === 'list' && Array.isArray(parsed.data)) {
        return {
          object: 'list',
          model: this.providerConfig.models?.[0]?.dyadModelId || 'unknown',
          ...parsed
        };
      }

      // If it's an array of embeddings
      if (Array.isArray(parsed)) {
        return {
          object: 'list',
          data: parsed.map((embedding, index) => ({
            object: 'embedding',
            embedding: Array.isArray(embedding) ? embedding : embedding.embedding || [],
            index
          })),
          model: this.providerConfig.models?.[0]?.dyadModelId || 'unknown',
          usage: {
            prompt_tokens: this.estimateTokens(JSON.stringify(parsed)),
            total_tokens: this.estimateTokens(JSON.stringify(parsed))
          }
        };
      }

      // If it's a single embedding
      if (parsed.embedding || Array.isArray(parsed)) {
        return {
          object: 'list',
          data: [{
            object: 'embedding',
            embedding: parsed.embedding || parsed,
            index: 0
          }],
          model: this.providerConfig.models?.[0]?.dyadModelId || 'unknown',
          usage: {
            prompt_tokens: this.estimateTokens(JSON.stringify(parsed)),
            total_tokens: this.estimateTokens(JSON.stringify(parsed))
          }
        };
      }
    } catch (error) {
      // Not JSON, treat as error
      logger.warn('Failed to parse embeddings output as JSON', {
        error: error.message,
        output: output.substring(0, 200)
      });
    }

    // Fallback: return error response
    throw new Error(`Invalid embeddings output format: ${output.substring(0, 100)}`);
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Docker containers are automatically cleaned up with --rm flag
    // No additional cleanup needed for direct execution
  }
}

module.exports = SpawnCliAdapter;