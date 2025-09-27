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
   * Cleanup resources
   */
  async cleanup() {
    // Docker containers are automatically cleaned up with --rm flag
    // No additional cleanup needed for direct execution
  }
}

module.exports = SpawnCliAdapter;