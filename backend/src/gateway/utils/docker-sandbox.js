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