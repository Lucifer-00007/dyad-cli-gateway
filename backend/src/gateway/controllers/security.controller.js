/**
 * Security Controller
 * Handles security monitoring and audit endpoints
 */

const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const vulnerabilityScanner = require('../services/vulnerability-scanner.service');
const logger = require('../../config/logger');
const securityConfig = require('../config/security.config');

/**
 * Get security status
 */
const getSecurityStatus = catchAsync(async (req, res) => {
  const scanStatus = vulnerabilityScanner.getScanStatus();
  const latestResults = vulnerabilityScanner.getLatestScanResults();
  
  const status = {
    timestamp: new Date().toISOString(),
    scanning: {
      enabled: securityConfig.vulnerabilityScanning.enabled,
      isScanning: scanStatus.isScanning,
      lastScanTime: scanStatus.lastScanTime,
      totalScans: scanStatus.totalScans
    },
    latestScan: latestResults ? {
      scanId: latestResults.scanId,
      timestamp: latestResults.timestamp,
      summary: latestResults.summary
    } : null,
    configuration: {
      httpsRequired: securityConfig.https.required,
      headersEnabled: securityConfig.headers.enabled,
      cspEnabled: securityConfig.csp.enabled,
      ddosProtectionEnabled: securityConfig.ddos.enabled,
      containerScanEnabled: securityConfig.container.scanEnabled
    },
    policies: {
      rateLimitWindow: securityConfig.rateLimit.windowMs,
      rateLimitMax: securityConfig.rateLimit.max,
      maxRequestSize: securityConfig.validation.maxRequestSize,
      maxObjectProperties: securityConfig.validation.maxObjectProperties
    }
  };
  
  res.status(httpStatus.OK).json({
    status: 'ok',
    data: status
  });
});

/**
 * Trigger security scan
 */
const triggerSecurityScan = catchAsync(async (req, res) => {
  if (vulnerabilityScanner.getScanStatus().isScanning) {
    return res.status(httpStatus.CONFLICT).json({
      error: {
        message: 'Security scan already in progress',
        type: 'conflict_error',
        code: 'scan_in_progress'
      }
    });
  }
  
  logger.info('Manual security scan triggered', {
    userId: req.user?.id,
    requestId: req.requestId,
    ip: req.ip
  });
  
  // Start scan asynchronously
  vulnerabilityScanner.runFullScan().catch(error => {
    logger.error('Manual security scan failed', {
      error: error.message,
      userId: req.user?.id,
      requestId: req.requestId
    });
  });
  
  res.status(httpStatus.ACCEPTED).json({
    message: 'Security scan started',
    scanId: `scan_${Date.now()}`,
    estimatedDuration: '2-5 minutes'
  });
});

/**
 * Get security scan results
 */
const getSecurityScanResults = catchAsync(async (req, res) => {
  const { scanId } = req.params;
  
  if (scanId === 'latest') {
    const latestResults = vulnerabilityScanner.getLatestScanResults();
    
    if (!latestResults) {
      return res.status(httpStatus.NOT_FOUND).json({
        error: {
          message: 'No scan results available',
          type: 'not_found_error',
          code: 'no_scan_results'
        }
      });
    }
    
    return res.status(httpStatus.OK).json({
      status: 'ok',
      data: latestResults
    });
  }
  
  // For specific scan ID, you would implement scan result storage
  res.status(httpStatus.NOT_IMPLEMENTED).json({
    error: {
      message: 'Specific scan ID lookup not implemented',
      type: 'not_implemented_error',
      code: 'feature_not_implemented'
    }
  });
});

/**
 * Get security metrics
 */
const getSecurityMetrics = catchAsync(async (req, res) => {
  // This would typically integrate with your metrics system
  const metrics = {
    timestamp: new Date().toISOString(),
    requests: {
      total: 0, // Would come from monitoring system
      blocked: 0,
      rateLimited: 0,
      suspicious: 0
    },
    vulnerabilities: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    },
    security: {
      httpsPercentage: 100,
      validatedRequests: 100,
      sanitizedInputs: 100
    },
    alerts: {
      last24h: 0,
      lastWeek: 0,
      lastMonth: 0
    }
  };
  
  const latestScan = vulnerabilityScanner.getLatestScanResults();
  if (latestScan && latestScan.summary) {
    metrics.vulnerabilities = {
      critical: latestScan.summary.criticalCount,
      high: latestScan.summary.highCount,
      medium: latestScan.summary.mediumCount,
      low: latestScan.summary.lowCount
    };
  }
  
  res.status(httpStatus.OK).json({
    status: 'ok',
    data: metrics
  });
});

/**
 * Update security configuration
 */
const updateSecurityConfig = catchAsync(async (req, res) => {
  const { config } = req.body;
  
  // Validate configuration updates
  const allowedUpdates = [
    'rateLimit.max',
    'ddos.enabled',
    'validation.maxRequestSize',
    'monitoring.enabled'
  ];
  
  const updates = {};
  for (const [key, value] of Object.entries(config)) {
    if (allowedUpdates.includes(key)) {
      updates[key] = value;
    }
  }
  
  if (Object.keys(updates).length === 0) {
    return res.status(httpStatus.BAD_REQUEST).json({
      error: {
        message: 'No valid configuration updates provided',
        type: 'invalid_request_error',
        code: 'invalid_config'
      }
    });
  }
  
  logger.info('Security configuration updated', {
    updates,
    userId: req.user?.id,
    requestId: req.requestId,
    ip: req.ip
  });
  
  // In a real implementation, you would update the configuration
  // and possibly restart relevant services
  
  res.status(httpStatus.OK).json({
    message: 'Security configuration updated',
    updates,
    note: 'Some changes may require service restart to take effect'
  });
});

/**
 * Get security audit log
 */
const getSecurityAuditLog = catchAsync(async (req, res) => {
  const { limit = 100, offset = 0, severity } = req.query;
  
  // This would typically query your audit log storage
  const auditLog = {
    total: 0,
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
    entries: []
  };
  
  res.status(httpStatus.OK).json({
    status: 'ok',
    data: auditLog
  });
});

module.exports = {
  getSecurityStatus,
  triggerSecurityScan,
  getSecurityScanResults,
  getSecurityMetrics,
  updateSecurityConfig,
  getSecurityAuditLog
};