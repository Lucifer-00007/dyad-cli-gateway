/**
 * Docker Sandbox Helper
 * Provides secure containerized execution for CLI commands
 */

const { spawn } = require('child_process');
const crypto = require('crypto');
const logger = require('../../config/logger');

class DockerSandbox {
  constructor(options = {}) {
    this.defaultImage = options.image || 'alpine:latest';
    this.defaultTimeout = options.timeout || 30000; // 30 seconds
    this.defaultMemoryLimit = options.memoryLimit || '128m';
    this.defaultCpuLimit = options.cpuLimit || '0.5';
    this.workDir = options.workDir || '/tmp';
  }

  /**
   * Execute a command in a Docker container
   * @param {string} command - Command to execute
   * @param {Array} args - Command arguments
   * @param {Object} options - Execution options
   * @param {string} options.input - Input to pass to stdin
   * @param {AbortSignal} options.signal - Cancellation signal
   * @param {number} options.timeout - Timeout in milliseconds
   * @param {string} options.image - Docker image to use
   * @returns {Promise<Object>} - Execution result
   */
  async execute(command, args = [], options = {}) {
    const containerId = `gateway-${crypto.randomBytes(4).toString('hex')}`;
    const timeout = options.timeout || this.defaultTimeout;
    const image = options.image || this.defaultImage;
    const input = options.input || '';
    
    // Sanitize command and args for logging
    const sanitizedCommand = this.sanitizeForLogging(command);
    const sanitizedArgs = args.map(arg => this.sanitizeForLogging(arg));
    
    logger.info('Docker sandbox execution', {
      containerId,
      command: sanitizedCommand,
      args: sanitizedArgs,
      image,
      timeout
    });

    return new Promise((resolve, reject) => {
      let isResolved = false;
      let timeoutId;
      let dockerProcess;

      const cleanup = async () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        // Kill the container if it's still running
        try {
          await this.killContainer(containerId);
        } catch (error) {
          logger.warn('Failed to kill container during cleanup', { containerId, error: error.message });
        }
      };

      const resolveOnce = async (result) => {
        if (isResolved) return;
        isResolved = true;
        await cleanup();
        resolve(result);
      };

      const rejectOnce = async (error) => {
        if (isResolved) return;
        isResolved = true;
        await cleanup();
        reject(error);
      };

      // Set up timeout
      timeoutId = setTimeout(async () => {
        logger.warn('Docker sandbox execution timeout', { containerId, timeout });
        await rejectOnce(new Error(`Command execution timeout after ${timeout}ms`));
      }, timeout);

      // Handle cancellation signal
      if (options.signal) {
        options.signal.addEventListener('abort', async () => {
          logger.info('Docker sandbox execution cancelled', { containerId });
          await rejectOnce(new Error('Command execution cancelled'));
        });
      }

      // Build docker run command
      const dockerArgs = [
        'run',
        '--rm',
        '--name', containerId,
        '--memory', this.defaultMemoryLimit,
        '--cpus', this.defaultCpuLimit,
        '--network', 'none', // No network access
        '--user', 'nobody', // Run as non-root user
        '--workdir', this.workDir,
        '-i', // Interactive (for stdin)
        image,
        command,
        ...args
      ];

      // Spawn docker process
      dockerProcess = spawn('docker', dockerArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      // Collect stdout
      dockerProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Collect stderr
      dockerProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process completion
      dockerProcess.on('close', async (code) => {
        logger.info('Docker sandbox execution completed', {
          containerId,
          exitCode: code,
          stdoutLength: stdout.length,
          stderrLength: stderr.length
        });

        await resolveOnce({
          exitCode: code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          success: code === 0
        });
      });

      // Handle process errors
      dockerProcess.on('error', async (error) => {
        logger.error('Docker sandbox execution error', {
          containerId,
          error: error.message
        });
        await rejectOnce(error);
      });

      // Send input to stdin if provided
      if (input) {
        dockerProcess.stdin.write(input);
      }
      dockerProcess.stdin.end();
    });
  }

  /**
   * Kill a running container
   * @param {string} containerId - Container ID to kill
   */
  async killContainer(containerId) {
    return new Promise((resolve) => {
      const killProcess = spawn('docker', ['kill', containerId], {
        stdio: 'ignore'
      });
      
      killProcess.on('close', () => {
        resolve();
      });
      
      killProcess.on('error', () => {
        // Ignore errors - container might already be stopped
        resolve();
      });
    });
  }

  /**
   * Execute a command in a Docker container with streaming support
   * @param {string} command - Command to execute
   * @param {Array} args - Command arguments
   * @param {Object} options - Execution options
   * @returns {AsyncGenerator} - Stream of response chunks
   */
  async *executeStream(command, args = [], options = {}) {
    const containerId = `gateway-stream-${crypto.randomBytes(4).toString('hex')}`;
    const timeout = options.timeout || this.defaultTimeout;
    const image = options.image || this.defaultImage;
    const input = options.input || '';
    const requestId = options.requestId;
    
    // Sanitize command and args for logging
    const sanitizedCommand = this.sanitizeForLogging(command);
    const sanitizedArgs = args.map(arg => this.sanitizeForLogging(arg));
    
    logger.info('Docker sandbox streaming execution', {
      containerId,
      command: sanitizedCommand,
      args: sanitizedArgs,
      image,
      timeout,
      requestId
    });

    let dockerProcess;
    let isFinished = false;
    let timeoutId;

    const cleanup = async () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Kill the container if it's still running
      try {
        await this.killContainer(containerId);
      } catch (error) {
        logger.warn('Failed to kill container during streaming cleanup', { 
          containerId, 
          error: error.message,
          requestId 
        });
      }
    };

    try {
      // Set up timeout
      timeoutId = setTimeout(async () => {
        logger.warn('Docker sandbox streaming execution timeout', { containerId, timeout, requestId });
        isFinished = true;
        await cleanup();
      }, timeout);

      // Handle cancellation signal
      if (options.signal) {
        options.signal.addEventListener('abort', async () => {
          logger.info('Docker sandbox streaming execution cancelled', { containerId, requestId });
          isFinished = true;
          await cleanup();
        });
      }

      // Build docker run command
      const dockerArgs = [
        'run',
        '--rm',
        '--name', containerId,
        '--memory', this.defaultMemoryLimit,
        '--cpus', this.defaultCpuLimit,
        '--network', 'none', // No network access
        '--user', 'nobody', // Run as non-root user
        '--workdir', this.workDir,
        '-i', // Interactive (for stdin)
        image,
        command,
        ...args
      ];

      // Spawn docker process
      dockerProcess = spawn('docker', dockerArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stderr = '';

      // Collect stderr
      dockerProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Send input to stdin if provided
      if (input) {
        dockerProcess.stdin.write(input);
      }
      dockerProcess.stdin.end();

      // Stream stdout data
      let buffer = '';
      let chunkIndex = 0;

      for await (const chunk of dockerProcess.stdout) {
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
        dockerProcess.on('close', (code) => {
          logger.info('Docker sandbox streaming execution completed', {
            containerId,
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

        dockerProcess.on('error', (error) => {
          logger.error('Docker sandbox streaming execution error', {
            containerId,
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
      await cleanup();
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
      model: 'docker-cli',
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
      model: 'docker-cli',
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
      model: 'docker-cli',
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'stop'
      }]
    };
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
}

module.exports = DockerSandbox;