/**
 * Security Routes
 * Admin routes for security monitoring and management
 */

const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const securityController = require('../controllers/security.controller');
const { securityValidation } = require('../validations');

const router = express.Router();

// All security routes require admin authentication
router.use(auth('admin'));

/**
 * @swagger
 * /admin/security/status:
 *   get:
 *     summary: Get security status
 *     description: Get current security configuration and scan status
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Security status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 data:
 *                   type: object
 *                   properties:
 *                     scanning:
 *                       type: object
 *                     configuration:
 *                       type: object
 *                     policies:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/status', securityController.getSecurityStatus);

/**
 * @swagger
 * /admin/security/scan:
 *   post:
 *     summary: Trigger security scan
 *     description: Start a comprehensive security vulnerability scan
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       202:
 *         description: Security scan started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Security scan started
 *                 scanId:
 *                   type: string
 *                   example: scan_1234567890
 *                 estimatedDuration:
 *                   type: string
 *                   example: 2-5 minutes
 *       409:
 *         description: Scan already in progress
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/scan', securityController.triggerSecurityScan);

/**
 * @swagger
 * /admin/security/scan/{scanId}:
 *   get:
 *     summary: Get security scan results
 *     description: Retrieve results from a specific security scan
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scanId
 *         required: true
 *         schema:
 *           type: string
 *         description: Scan ID or 'latest' for most recent scan
 *         example: latest
 *     responses:
 *       200:
 *         description: Scan results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 data:
 *                   type: object
 *                   properties:
 *                     scanId:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     summary:
 *                       type: object
 *                     scans:
 *                       type: object
 *       404:
 *         description: Scan results not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/scan/:scanId', securityController.getSecurityScanResults);

/**
 * @swagger
 * /admin/security/metrics:
 *   get:
 *     summary: Get security metrics
 *     description: Retrieve security-related metrics and statistics
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Security metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 data:
 *                   type: object
 *                   properties:
 *                     requests:
 *                       type: object
 *                     vulnerabilities:
 *                       type: object
 *                     security:
 *                       type: object
 *                     alerts:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/metrics', securityController.getSecurityMetrics);

/**
 * @swagger
 * /admin/security/config:
 *   patch:
 *     summary: Update security configuration
 *     description: Update runtime security configuration settings
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               config:
 *                 type: object
 *                 properties:
 *                   rateLimit.max:
 *                     type: number
 *                     example: 1000
 *                   ddos.enabled:
 *                     type: boolean
 *                     example: true
 *                   validation.maxRequestSize:
 *                     type: number
 *                     example: 10485760
 *     responses:
 *       200:
 *         description: Security configuration updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Security configuration updated
 *                 updates:
 *                   type: object
 *                 note:
 *                   type: string
 *       400:
 *         description: Invalid configuration
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.patch('/config', securityController.updateSecurityConfig);

/**
 * @swagger
 * /admin/security/audit:
 *   get:
 *     summary: Get security audit log
 *     description: Retrieve security audit log entries
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *         description: Number of entries to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of entries to skip
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter by severity level
 *     responses:
 *       200:
 *         description: Audit log retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     offset:
 *                       type: number
 *                     entries:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/audit', securityController.getSecurityAuditLog);

module.exports = router;