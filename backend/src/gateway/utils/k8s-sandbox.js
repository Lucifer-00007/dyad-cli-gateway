/**
 * Kubernetes Job-based Sandbox Implementation
 * Alternative to Docker socket mounting for secure CLI execution
 */

const k8s = require('@kubernetes/client-node');
const logger = require('../../config/logger');
const { v4: uuidv4 } = require('uuid');

class KubernetesSandbox {
  constructor(config = {}) {
    this.config = {
      namespace: config.namespace || process.env.K8S_SANDBOX_NAMESPACE || 'dyad-gateway-sandbox',
      image: config.image || process.env.K8S_SANDBOX_IMAGE || 'alpine:3.18',
      cpuLimit: config.cpuLimit || process.env.K8S_SANDBOX_CPU_LIMIT || '500m',
      memoryLimit: config.memoryLimit || process.env.K8S_SANDBOX_MEMORY_LIMIT || '512Mi',
      timeout: config.timeout || parseInt(process.env.K8S_SANDBOX_TIMEOUT) || 300,
      ttlSecondsAfterFinished: config.ttlSecondsAfterFinished || parseInt(process.env.K8S_SANDBOX_TTL_SECONDS) || 600,
      gvisorEnabled: config.gvisorEnabled || process.env.GVISOR_ENABLED === 'true',
      gvisorRuntimeClass: config.gvisorRuntimeClass || process.env.GVISOR_RUNTIME_CLASS || 'gvisor',
      ...config
    };

    // Initialize Kubernetes client
    this.kc = new k8s.KubeConfig();
    
    try {
      // Try to load in-cluster config first (when running in K8s)
      this.kc.loadFromCluster();
    } catch (error) {
      try {
        // Fallback to default kubeconfig (for development)
        this.kc.loadFromDefault();
      } catch (fallbackError) {
        logger.error('Failed to load Kubernetes configuration:', fallbackError);
        throw new Error('Unable to initialize Kubernetes client');
      }
    }

    this.batchV1Api = this.kc.makeApiClient(k8s.BatchV1Api);
    this.coreV1Api = this.kc.makeApiClient(k8s.CoreV1Api);
  }

  /**
   * Execute a command in a Kubernetes Job
   * @param {string} command - Command to execute
   * @param {string[]} args - Command arguments
   * @param {string} input - Input to pass via stdin
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executeCommand(command, args = [], input = '', options = {}) {
    const jobId = `sandbox-${uuidv4().substring(0, 8)}`;
    const jobName = `dyad-cli-${jobId}`;
    
    logger.info(`Creating Kubernetes job: ${jobName}`);

    try {
      // Create the job
      const job = await this.createJob(jobName, command, args, input, options);
      
      // Wait for job completion
      const result = await this.waitForJobCompletion(jobName, options.timeout || this.config.timeout);
      
      // Get job logs
      const logs = await this.getJobLogs(jobName);
      
      return {
        success: result.success,
        stdout: logs.stdout,
        stderr: logs.stderr,
        exitCode: result.exitCode,
        jobName,
        duration: result.duration
      };
    } catch (error) {
      logger.error(`Kubernetes sandbox execution failed for job ${jobName}:`, error);
      
      // Attempt cleanup on error
      try {
        await this.cleanupJob(jobName);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup job ${jobName}:`, cleanupError);
      }
      
      throw error;
    }
  }

  /**
   * Create a Kubernetes Job for command execution
   */
  async createJob(jobName, command, args, input, options) {
    const jobSpec = {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: jobName,
        namespace: this.config.namespace,
        labels: {
          'app.kubernetes.io/name': 'dyad-gateway',
          'app.kubernetes.io/component': 'sandbox',
          'dyad.gateway/job-type': 'cli-execution',
          'dyad.gateway/job-id': jobName
        }
      },
      spec: {
        ttlSecondsAfterFinished: this.config.ttlSecondsAfterFinished,
        backoffLimit: 0, // Don't retry failed jobs
        activeDeadlineSeconds: options.timeout || this.config.timeout,
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': 'dyad-gateway',
              'app.kubernetes.io/component': 'sandbox',
              'dyad.gateway/job-type': 'cli-execution'
            }
          },
          spec: {
            restartPolicy: 'Never',
            securityContext: {
              runAsNonRoot: true,
              runAsUser: 65534, // nobody user
              runAsGroup: 65534,
              fsGroup: 65534,
              seccompProfile: {
                type: 'RuntimeDefault'
              }
            },
            containers: [{
              name: 'sandbox',
              image: this.config.image,
              command: ['/bin/sh'],
              args: ['-c', this.buildExecutionScript(command, args, input)],
              resources: {
                limits: {
                  cpu: this.config.cpuLimit,
                  memory: this.config.memoryLimit,
                  'ephemeral-storage': '1Gi'
                },
                requests: {
                  cpu: '50m',
                  memory: '64Mi',
                  'ephemeral-storage': '100Mi'
                }
              },
              securityContext: {
                allowPrivilegeEscalation: false,
                readOnlyRootFilesystem: true,
                capabilities: {
                  drop: ['ALL']
                }
              },
              volumeMounts: [{
                name: 'tmp',
                mountPath: '/tmp'
              }]
            }],
            volumes: [{
              name: 'tmp',
              emptyDir: {
                sizeLimit: '100Mi'
              }
            }]
          }
        }
      }
    };

    // Add gVisor runtime class if enabled
    if (this.config.gvisorEnabled) {
      jobSpec.spec.template.spec.runtimeClassName = this.config.gvisorRuntimeClass;
    }

    const response = await this.batchV1Api.createNamespacedJob(this.config.namespace, jobSpec);
    return response.body;
  }

  /**
   * Build the execution script that will run in the container
   */
  buildExecutionScript(command, args, input) {
    const escapedInput = input.replace(/'/g, "'\"'\"'");
    const fullCommand = [command, ...args].join(' ');
    
    return `
      set -e
      echo '${escapedInput}' | ${fullCommand}
      echo "EXIT_CODE: $?" >&2
    `;
  }

  /**
   * Wait for job completion and return result
   */
  async waitForJobCompletion(jobName, timeout = 300) {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds
    
    while (Date.now() - startTime < timeout * 1000) {
      try {
        const jobResponse = await this.batchV1Api.readNamespacedJobStatus(jobName, this.config.namespace);
        const job = jobResponse.body;
        
        if (job.status.conditions) {
          const completedCondition = job.status.conditions.find(c => c.type === 'Complete');
          const failedCondition = job.status.conditions.find(c => c.type === 'Failed');
          
          if (completedCondition && completedCondition.status === 'True') {
            return {
              success: true,
              exitCode: 0,
              duration: Date.now() - startTime
            };
          }
          
          if (failedCondition && failedCondition.status === 'True') {
            return {
              success: false,
              exitCode: 1,
              duration: Date.now() - startTime,
              reason: failedCondition.reason
            };
          }
        }
        
        await this.sleep(pollInterval);
      } catch (error) {
        logger.warn(`Error checking job status for ${jobName}:`, error.message);
        await this.sleep(pollInterval);
      }
    }
    
    // Timeout reached
    throw new Error(`Job ${jobName} timed out after ${timeout} seconds`);
  }

  /**
   * Get logs from the job's pod
   */
  async getJobLogs(jobName) {
    try {
      // Find the pod created by the job
      const podsResponse = await this.coreV1Api.listNamespacedPod(
        this.config.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        `job-name=${jobName}`
      );
      
      if (podsResponse.body.items.length === 0) {
        return { stdout: '', stderr: 'No pod found for job' };
      }
      
      const podName = podsResponse.body.items[0].metadata.name;
      
      // Get pod logs
      const logsResponse = await this.coreV1Api.readNamespacedPodLog(
        podName,
        this.config.namespace,
        'sandbox'
      );
      
      const logs = logsResponse.body;
      
      // Split stdout and stderr (stderr contains our EXIT_CODE marker)
      const lines = logs.split('\n');
      const stderrLines = lines.filter(line => line.includes('EXIT_CODE:'));
      const stdoutLines = lines.filter(line => !line.includes('EXIT_CODE:'));
      
      return {
        stdout: stdoutLines.join('\n').trim(),
        stderr: stderrLines.join('\n').trim()
      };
    } catch (error) {
      logger.warn(`Failed to get logs for job ${jobName}:`, error.message);
      return { stdout: '', stderr: `Failed to retrieve logs: ${error.message}` };
    }
  }

  /**
   * Clean up a job and its associated resources
   */
  async cleanupJob(jobName) {
    try {
      // Delete the job (this will also delete associated pods due to ownerReferences)
      await this.batchV1Api.deleteNamespacedJob(
        jobName,
        this.config.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        'Background' // Use background deletion
      );
      
      logger.info(`Cleaned up Kubernetes job: ${jobName}`);
    } catch (error) {
      if (error.response && error.response.statusCode === 404) {
        logger.info(`Job ${jobName} already deleted`);
      } else {
        logger.error(`Failed to cleanup job ${jobName}:`, error);
        throw error;
      }
    }
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobName) {
    try {
      // Delete the job to cancel it
      await this.cleanupJob(jobName);
      logger.info(`Cancelled Kubernetes job: ${jobName}`);
    } catch (error) {
      logger.error(`Failed to cancel job ${jobName}:`, error);
      throw error;
    }
  }

  /**
   * Health check for Kubernetes connectivity
   */
  async healthCheck() {
    try {
      // Try to list jobs in the sandbox namespace
      await this.batchV1Api.listNamespacedJob(this.config.namespace);
      return { healthy: true, message: 'Kubernetes API accessible' };
    } catch (error) {
      return { 
        healthy: false, 
        message: `Kubernetes API error: ${error.message}` 
      };
    }
  }

  /**
   * Utility function for sleeping
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = KubernetesSandbox;